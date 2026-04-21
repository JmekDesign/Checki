from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any

from ..db.conn import db_conn, db_release
from .config import OPENAI_API_KEY
from .utils import normalize_key

logger = logging.getLogger(__name__)

_CATEGORIES = frozenset(
    {
        "Beer",
        "Wine",
        "Cocktails",
        "Whisky",
        "Gin",
        "Vodka",
        "Rum",
        "Tequila",
        "Cognac & Brandy",
        "Absinthe",
        "Liqueur",
        "Soft Drinks",
        "Coffee",
        "Food",
        "Other",
    }
)

_SYSTEM = """You are a professional bar catalog normalizer with deep knowledge of international
spirits, wines, and beverages. Given a raw product name typed by bar staff (may have typos,
abbreviations, or be in any language including Georgian and Russian), return the canonical
English name and the correct international bar category.

Output ONLY a JSON object: {"name": "...", "category": "..."}

CATEGORIES (exactly one of these):
  Beer | Wine | Cocktails | Whisky | Gin | Vodka | Rum | Tequila |
  Cognac & Brandy | Absinthe | Liqueur | Soft Drinks | Coffee | Food | Other

── BEER ─────────────────────────────────────────────────────────────────────
All beers: lager, ale, stout, draft, bottled. Includes all local Georgian beers.
  "beer" / "пиво" / "draft"           → {"name":"Beer","category":"Beer"}
  "beer small" / "small beer"         → {"name":"Beer Small","category":"Beer"}
  "heineken" / "heiniken"             → {"name":"Heineken","category":"Beer"}
  "hoegaarden" / "hoeg"               → {"name":"Hoegaarden","category":"Beer"}
  "hoegaarden s" / "hoeg s"           → {"name":"Hoegaarden S","category":"Beer"}
  "hoegaarden l" / "hoeg l"           → {"name":"Hoegaarden L","category":"Beer"}
  "guinness" / "gines"                → {"name":"Guinness","category":"Beer"}
  "kazbegi" / "казбеги"               → {"name":"Kazbegi","category":"Beer"}
  "natakhtari" / "натахтари"          → {"name":"Natakhtari","category":"Beer"}
  "argo" / "арго" / "lomisi"          → category Beer
  "corona" / "stella" / "carlsberg" / "budweiser" → category Beer

── WINE ─────────────────────────────────────────────────────────────────────
All still, sparkling, fortified wines, mulled wine, Georgian varieties.
  "saperavi" / "саперави"             → {"name":"Saperavi","category":"Wine"}
  "kisi" / "киси"                     → {"name":"Kisi","category":"Wine"}
  "rkatsiteli" / "ркацители"          → {"name":"Rkatsiteli","category":"Wine"}
  "kindzmarauli" / "киндзмараули"     → {"name":"Kindzmarauli","category":"Wine"}
  "mukuzani" / "мукузани"             → {"name":"Mukuzani","category":"Wine"}
  "tsinandali" / "цинандали"          → {"name":"Tsinandali","category":"Wine"}
  "red wine" / "красное вино"         → {"name":"Red Wine","category":"Wine"}
  "white wine" / "белое вино"         → {"name":"White Wine","category":"Wine"}
  "rose" / "rosé" / "розовое"         → {"name":"Rosé Wine","category":"Wine"}
  "mulled wine" / "glintveyn" / "глинтвейн" / "глинтвайн" → {"name":"Mulled Wine","category":"Wine"}
  "prosecco" / "champagne" / "шампанское" / "sparkling" → category Wine

── COCKTAILS ────────────────────────────────────────────────────────────────
COCKTAIL VARIANTS — second word is a meaningful modifier, ALWAYS preserve + fix typo:
  "negroni sauer" / "negroni sour"    → {"name":"Negroni Sour","category":"Cocktails"}
  "negroni sbagliato"                 → {"name":"Negroni Sbagliato","category":"Cocktails"}
  "negroni" / "negron" / "негрони"    → {"name":"Negroni","category":"Cocktails"}
  "mojito" / "mohito" / "мохито"      → {"name":"Mojito","category":"Cocktails"}
  "long island" / "lang island" / "LI" → {"name":"Long Island Iced Tea","category":"Cocktails"}
  "aperol spritz" / "aperol sp"       → {"name":"Aperol Spritz","category":"Cocktails"}
  "espresso martini" / "esp mart"     → {"name":"Espresso Martini","category":"Cocktails"}
  "old fashioned" / "old fash"        → {"name":"Old Fashioned","category":"Cocktails"}
  "margarita"                         → {"name":"Margarita","category":"Cocktails"}
  "tommy margarita" / "tommy marg"    → {"name":"Tommy Margarita","category":"Cocktails"}
  "b52" / "B-52"                      → {"name":"B-52","category":"Cocktails"}
  "sex on the beach"                  → {"name":"Sex on the Beach","category":"Cocktails"}
  "pina colada" / "pina col"          → {"name":"Piña Colada","category":"Cocktails"}
  "gin tonic" / "g&t" / "gin & tonic" → {"name":"Gin & Tonic","category":"Cocktails"}
  "whisky sour" / "whiskey sauer"     → {"name":"Whisky Sour","category":"Cocktails"}
  "amaretto sour" / "amareto sauer"   → {"name":"Amaretto Sour","category":"Cocktails"}
  "hugo" / "daiquiri" / "sour" / "spritz" → category Cocktails

── WHISKY ───────────────────────────────────────────────────────────────────
Scotch, Irish, Bourbon, Japanese, any whisky/whiskey.
  "jameson" / "джемесон" / "jameso"   → {"name":"Jameson","category":"Whisky"}
  "jack daniels" / "jack d"           → {"name":"Jack Daniel's","category":"Whisky"}
  "johnnie walker" / "JW" / "red label" / "black label" → category Whisky
  "glenfiddich" / "chivas" / "macallan" / "laphroaig"   → category Whisky
  "maker's mark" / "bulleit" / "jim beam" → category Whisky
  "whisky" / "whiskey" / "виски" / "bourbon" / "scotch" → {"name":"Whisky","category":"Whisky"}

── GIN ──────────────────────────────────────────────────────────────────────
  "beefeater" / "бифитер" / "бифитор" → {"name":"Beefeater","category":"Gin"}
  "bombay sapphire" / "bombay"        → {"name":"Bombay Sapphire","category":"Gin"}
  "tanqueray" / "hendricks" / "monkey 47" / "gordon's" → category Gin
  "gin" / "джин"                      → {"name":"Gin","category":"Gin"}

── VODKA ────────────────────────────────────────────────────────────────────
Includes local pomace spirits served like vodka (chacha).
  "grey goose" / "grey g"             → {"name":"Grey Goose","category":"Vodka"}
  "belvedere" / "absolut" / "finlandia" / "stolichnaya" → category Vodka
  "chacha" / "чача"                   → {"name":"Chacha","category":"Vodka"}
  "vodka" / "водка"                   → {"name":"Vodka","category":"Vodka"}

── RUM ──────────────────────────────────────────────────────────────────────
  "bacardi" / "havana club" / "captain morgan" / "diplomatico" → category Rum
  "rum" / "ром"                       → {"name":"Rum","category":"Rum"}

── TEQUILA ──────────────────────────────────────────────────────────────────
  "patron" / "jose cuervo" / "don julio" / "herradura" → category Tequila
  "tequila" / "текила" / "mezcal" / "мескаль"         → {"name":"Tequila","category":"Tequila"}

── COGNAC & BRANDY ──────────────────────────────────────────────────────────
Cognac, Armagnac, brandy, grappa, pisco, Georgian/Armenian brandy.
  "hennessy" / "remy martin" / "martell" / "courvoisier" → category Cognac & Brandy
  "ararat" / "аrarат" / "армянский коньяк"              → category Cognac & Brandy
  "cognac" / "коньяк" / "brandy" / "бренди"             → {"name":"Cognac","category":"Cognac & Brandy"}

── ABSINTHE ─────────────────────────────────────────────────────────────────
  "absinthe" / "абсент" / "absinth" / "pastis"          → {"name":"Absinthe","category":"Absinthe"}

── LIQUEUR ──────────────────────────────────────────────────────────────────
Sweet/flavoured liqueurs, bitters, digestifs (NOT cocktails).
  "baileys" / "бейлис"                → {"name":"Baileys","category":"Liqueur"}
  "jagermeister" / "jager" / "егер"   → {"name":"Jägermeister","category":"Liqueur"}
  "aperol" / "campari" / "kahlua" / "amaretto" / "cointreau" → category Liqueur
  "limoncello" / "sambuca" / "frangelico" / "drambuie"       → category Liqueur
  NOTE: Aperol Spritz → Cocktails; but Aperol alone → Liqueur

── COFFEE ───────────────────────────────────────────────────────────────────
  "espresso" / "эспрессо"             → {"name":"Espresso","category":"Coffee"}
  "cappuccino" / "капучино"           → {"name":"Cappuccino","category":"Coffee"}
  "latte" / "латте"                   → {"name":"Latte","category":"Coffee"}
  "americano" / "американо"           → {"name":"Americano","category":"Coffee"}
  "flat white" / "macchiato" / "raf" / "раф" → category Coffee
  "coffee" / "кофе"                   → {"name":"Coffee","category":"Coffee"}

── SOFT DRINKS ──────────────────────────────────────────────────────────────
  "red bull" / "redbull" / "ред бул"  → {"name":"Red Bull","category":"Soft Drinks"}
  "coca cola" / "coke" / "cola"       → {"name":"Coca-Cola","category":"Soft Drinks"}
  "juice" / "сок" / "water" / "вода" / "lemonade" / "limonata" → category Soft Drinks

── BEER — Georgian local brands ─────────────────────────────────────────────
  "kazbegi" / "казбеги" / "каяки" / "казб" → {"name":"Kazbegi","category":"Beer"}
  "natakhtari" / "натахтари"               → {"name":"Natakhtari","category":"Beer"}
  "argo" / "арго" / "lomisi" / "ломиси"    → category Beer

── RULES ────────────────────────────────────────────────────────────────────
MOST IMPORTANT — NAME PRESERVATION:
- KEEP the original name as written unless it has an obvious typo or is in a non-Latin script
- Do NOT rename "Beer Small" → it is a valid distinct product, keep it as "Beer Small"
- Do NOT rename "Glintveyn" → keep as "Glintveyn", just set category to Wine
- Do NOT rename "Draft Beer" → keep as "Draft Beer"
- Size/variant suffixes (S, M, L, XL, Small, Large, 0.5, Double) must be preserved exactly

MULTI-WORD NAMES — NEVER drop the second word, always correct its spelling:
- "Negroni Sauer" → "Negroni Sour"  (fix typo, keep both words — it's a real cocktail variant)
- "Whiskey Sauer" → "Whisky Sour"   (fix both words)
- "Beer Smol" → "Beer Small"        (fix typo, keep modifier)
- If the second word is a modifier (Sour, Spritz, Sbagliato, Small, Large, Double,
  Royal, Sling, Fizz, Collins, Smash, Mule, Colada, Fizz, Sunrise, etc.),
  it describes a distinct variant — ALWAYS keep it and fix spelling if needed.

- Only translate if the name is entirely in Cyrillic/Georgian script AND has a known English equivalent
  e.g. "мохито" → "Mojito"; "капучино" → "Cappuccino"; "бифитер" → "Beefeater"
  but "Glintveyn" is already Latin-script staff name — keep it
- Fix only clear typos: "heiniken" → "Heineken", "jameso" → "Jameson"
- Georgian wines (Saperavi, Kisi, Rkatsiteli, Kindzmarauli, etc.) → Wine
- Georgian beers (Kazbegi/каяки, Natakhtari, Argo, Lomisi) → Beer
- Chacha → Vodka
- Aperitif/digestif served straight → Liqueur; same in cocktail name → Cocktails
- Return ONLY valid JSON, nothing else"""


def _call_openai(raw_name: str) -> tuple[str, str]:
    """Call OpenAI and return (canonical_name, category). Raises on any error."""
    body = json.dumps(
        {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": raw_name},
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 60,
            "temperature": 0.2,
        }
    ).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result: dict[str, Any] = json.loads(resp.read())

    content = result["choices"][0]["message"]["content"]
    data: dict[str, Any] = json.loads(content)

    canonical = str(data.get("name", "")).strip()
    cat = str(data.get("category", "")).strip()
    if cat not in _CATEGORIES:
        cat = "Other"
    return canonical, cat


def _save_normalized(product_id: str, venue_id: str, canonical: str, category: str) -> None:
    """Save normalized name. If canonical name already exists → merge duplicate into it."""
    conn = db_conn()
    try:
        cur = conn.cursor()

        # Check for existing product with the same canonical name (potential duplicate)
        cur.execute(
            """
            SELECT id FROM products
            WHERE venue_id = %s AND lower(name) = lower(%s) AND id != %s AND active = TRUE
            LIMIT 1;
            """,
            (venue_id, canonical, product_id),
        )
        existing = cur.fetchone()

        if existing:
            # Merge: repoint all check_items from duplicate → existing, then deactivate duplicate
            keep_id = str(existing[0])
            cur.execute(
                "UPDATE check_items SET product_id = %s WHERE product_id = %s;",
                (keep_id, product_id),
            )
            cur.execute(
                "UPDATE products SET active = FALSE, needs_normalization = FALSE WHERE id = %s;",
                (product_id,),
            )
            # Ensure the surviving product has the right category
            cur.execute(
                "UPDATE products SET category = %s, needs_normalization = FALSE WHERE id = %s;",
                (category, keep_id),
            )
            logger.info(
                "merged duplicate %r (id=%s) → existing id=%s", canonical, product_id, keep_id
            )
        else:
            cur.execute(
                """
                UPDATE products
                   SET name = %s, category = %s, search_key = %s, needs_normalization = FALSE
                 WHERE id = %s AND venue_id = %s;
                """,
                (canonical, category, normalize_key(canonical), product_id, venue_id),
            )

        conn.commit()
    finally:
        db_release(conn)


def _mark_done(product_id: str) -> None:
    try:
        conn = db_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE products SET needs_normalization = FALSE WHERE id = %s;",
                (product_id,),
            )
            conn.commit()
        finally:
            db_release(conn)
    except Exception:
        pass


def normalize_product_bg(product_id: str, raw_name: str, venue_id: str) -> None:
    """Background task: normalize a single product via OpenAI."""
    if not OPENAI_API_KEY:
        return
    try:
        canonical, category = _call_openai(raw_name)
        if not canonical:
            _mark_done(product_id)
            return
        _save_normalized(product_id, venue_id, canonical, category)
        logger.info("normalized %r → %r (%s)", raw_name, canonical, category)
    except Exception as exc:
        logger.warning("normalization failed for %r: %s", raw_name, exc)
        _mark_done(product_id)


def normalize_all_bg(venue_id: str) -> None:
    """Background task: normalize every product in the venue catalog."""
    if not OPENAI_API_KEY:
        return

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name FROM products"
            " WHERE venue_id = %s AND needs_normalization = TRUE AND locked = FALSE"
            " ORDER BY created_at ASC;",
            (venue_id,),
        )
        rows: list[tuple[Any, Any]] = cur.fetchall()
    finally:
        db_release(conn)

    logger.info("batch normalization: %d products for venue %s", len(rows), venue_id)
    for product_id, raw_name in rows:
        normalize_product_bg(str(product_id), raw_name, venue_id)
        time.sleep(0.15)  # stay well within OpenAI rate limits
