from __future__ import annotations

import io
import os
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import CommandStart, Command

import db
import gpt
import payment_verify

router = Router()
SUPPORT_GROUP_ID = int(os.environ["SUPPORT_GROUP_ID"])

# ── in-memory state ───────────────────────────────────────────────────────────
# {tg_user_id: login_str_or_None}  — None means waiting for login, str means waiting for screenshot
_pay_state: dict[int, str | None] = {}
_awaiting_login: set[int] = set()  # after /pay command


# ── helpers ───────────────────────────────────────────────────────────────────

def _lang(msg: Message) -> str:
    text = msg.text or msg.caption or ""
    if any("\u10d0" <= c <= "\u10ff" for c in text):
        return "ka"
    if any("\u0400" <= c <= "\u04ff" for c in text):
        return "ru"
    code = (msg.from_user.language_code or "en")[:2]
    return code if code in ("ru", "ka") else "en"


def _feedback_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="👍", callback_data="fb:good"),
        InlineKeyboardButton(text="👎", callback_data="fb:bad"),
        InlineKeyboardButton(text="👤 Оператор", callback_data="fb:human"),
    ]])


async def _forward_to_group(bot: Bot, thread: dict, text: str) -> int:
    """Forward user message to support group, return new message id."""
    header = f"[#{thread['id']} @{thread.get('tg_username') or '—'} {thread.get('tg_first_name','')}]"
    sent = await bot.send_message(SUPPORT_GROUP_ID, f"{header}\n👤 {text}")
    db.update_thread(thread["id"], group_msg_id=sent.message_id)
    return sent.message_id


async def _escalate(bot: Bot, thread: dict, history: list[dict], last_text: str) -> None:
    lines = [f"[Checki Support #{thread['id']} | @{thread.get('tg_username') or '—'} | {thread.get('tg_first_name','')}]", ""]
    for m in history[-8:]:
        icon = "👤" if m["role"] == "user" else ("🤖" if m["role"] == "bot" else "🧑‍💼")
        lines.append(f"{icon} {m['text']}")
    lines += ["", f"❓ {last_text}"]
    sent = await bot.send_message(SUPPORT_GROUP_ID, "\n".join(lines))
    db.update_thread(thread["id"], escalated=True, group_msg_id=sent.message_id)


# ── /start ────────────────────────────────────────────────────────────────────

@router.message(CommandStart())
async def cmd_start(msg: Message) -> None:
    lang = _lang(msg)
    thread = db.get_or_create_thread(msg.from_user.id, msg.from_user.first_name or "", msg.from_user.username, lang)
    greetings = {
        "ru": "Привет! Я помогу с вопросами по Checki. Что случилось?",
        "en": "Hi! I'm the Checki support bot. What can I help you with?",
        "ka": "გამარჯობა! მე ვარ Checki-ს მხარდაჭერის ბოტი. რით შემიძლია დაგეხმაროთ?",
    }
    await msg.answer(greetings.get(lang, greetings["en"]))


# ── /pay command ──────────────────────────────────────────────────────────────

@router.message(Command("pay"))
async def cmd_pay(msg: Message) -> None:
    lang = _lang(msg)
    thread = db.get_or_create_thread(msg.from_user.id, msg.from_user.first_name or "", msg.from_user.username, lang)
    db.save_message(thread["id"], "user", "/pay")
    _pay_state[msg.from_user.id] = None  # waiting for login
    prompts = {
        "ru": "Введите логин, email или название заведения:",
        "en": "Enter your login, email or venue name:",
        "ka": "შეიყვანეთ ლოგინი, ელ.ფოსტა ან დაწესებულების სახელი:",
    }
    await msg.answer(prompts.get(lang, prompts["en"]))


# ── photos (payment screenshot) ───────────────────────────────────────────────

@router.message(F.chat.type == "private", F.photo)
async def user_photo(msg: Message) -> None:
    lang = _lang(msg)
    thread = db.get_or_create_thread(msg.from_user.id, msg.from_user.first_name or "", msg.from_user.username, lang)

    # If in payment flow and login is set — verify screenshot
    login = _pay_state.get(msg.from_user.id)
    if login is not None and isinstance(login, str):
        await _handle_payment_photo(msg, thread, lang, login)
        return

    # Escalated thread — forward photo to group
    if thread.get("escalated"):
        caption = msg.caption or ""
        file_id = msg.photo[-1].file_id
        await msg.bot.send_photo(SUPPORT_GROUP_ID,
            photo=file_id,
            caption=f"[#{thread['id']} @{thread.get('tg_username') or '—'}] 👤 {caption}")
        return

    await msg.answer("📎" if lang == "en" else "📎")


async def _handle_payment_photo(msg: Message, thread: dict, lang: str, login: str) -> None:
    wait_msgs = {"ru": "Проверяю скриншот...", "en": "Checking screenshot...", "ka": "ვამოწმებ..."}
    await msg.answer(wait_msgs.get(lang, wait_msgs["en"]))

    # Download photo
    file = await msg.bot.get_file(msg.photo[-1].file_id)
    buf = io.BytesIO()
    await msg.bot.download_file(file.file_path, buf)
    photo_bytes = buf.getvalue()

    result = await payment_verify.analyze_screenshot(photo_bytes)

    if result.get("valid"):
        venue = db.find_venue(login)
        if not venue:
            not_found = {"ru": "Заведение не найдено. Попробуйте ещё раз (/pay).",
                         "en": "Venue not found. Try again (/pay).",
                         "ka": "ვერ მოიძებნა. სცადეთ ისევ (/pay)."}
            await msg.answer(not_found.get(lang, not_found["en"]))
            _pay_state.pop(msg.from_user.id, None)
            return

        days = 365 if result.get("plan") == "year" else 30
        db.extend_subscription(str(venue["id"]), days)
        db.update_thread(thread["id"], venue_id=str(venue["id"]))
        _pay_state.pop(msg.from_user.id, None)

        ok_msgs = {
            "ru": f"✅ Подписка продлена на {days} дней! Заведение: *{venue['name']}*. Спасибо!",
            "en": f"✅ Subscription extended by {days} days! Venue: *{venue['name']}*. Thank you!",
            "ka": f"✅ გამოწერა გახანგრძლივდა {days} დღით! დაწ.: *{venue['name']}*. გმადლობთ!",
        }
        await msg.answer(ok_msgs.get(lang, ok_msgs["en"]), parse_mode="Markdown")
    else:
        _pay_state.pop(msg.from_user.id, None)
        reason = result.get("reason", "")
        if reason == "wrong_amount":
            amt = result.get("amount")
            fail_msgs = {
                "ru": f"Сумма на скриншоте ({amt} ₾) не совпадает с тарифом (49 или 490 ₾). Передаю оператору.",
                "en": f"Amount on screenshot ({amt} ₾) doesn't match pricing (49 or 490 ₾). Connecting operator.",
                "ka": f"თანხა ({amt} ₾) არ ემთხვევა ტარიფს. გადაგიყვანთ ოპერატორთან.",
            }
        else:
            fail_msgs = {
                "ru": "Не удалось распознать чек оплаты. Передаю оператору — разберёмся вручную.",
                "en": "Could not verify payment screenshot. Connecting to operator.",
                "ka": "ვერ დავადასტურეთ გადახდა. გადაგიყვანთ ოპერატორთან.",
            }
        reply = fail_msgs.get(lang, fail_msgs["en"])
        db.save_message(thread["id"], "bot", reply)
        await msg.answer(reply)
        history = db.get_history(thread["id"])
        # Forward screenshot to group with context
        file_id = msg.photo[-1].file_id
        header = f"[Checki #{thread['id']} | @{thread.get('tg_username') or '—'} | логин: {login}]\n💳 Скриншот оплаты — не прошёл автопроверку ({reason})"
        sent = await msg.bot.send_photo(SUPPORT_GROUP_ID, photo=file_id, caption=header)
        db.update_thread(thread["id"], escalated=True, group_msg_id=sent.message_id)


# ── text messages ─────────────────────────────────────────────────────────────

@router.message(F.chat.type == "private")
async def user_message(msg: Message) -> None:
    if not msg.text:
        return
    lang = _lang(msg)
    thread = db.get_or_create_thread(msg.from_user.id, msg.from_user.first_name or "", msg.from_user.username, lang)
    db.save_message(thread["id"], "user", msg.text)

    # /pay login step
    if msg.from_user.id in _awaiting_login:
        _awaiting_login.discard(msg.from_user.id)
        await _handle_pay_login(msg, thread, lang)
        return

    # payment flow — waiting for login
    if msg.from_user.id in _pay_state and _pay_state[msg.from_user.id] is None:
        _pay_state[msg.from_user.id] = msg.text.strip()
        photo_prompts = {
            "ru": "Логин принят. Теперь пришлите скриншот подтверждения оплаты из банковского приложения:",
            "en": "Login accepted. Now send a screenshot of the payment confirmation from your banking app:",
            "ka": "ლოგინი მიღებულია. გამოგზავნეთ გადახდის დადასტურების სკრინშოტი:",
        }
        await msg.answer(photo_prompts.get(lang, photo_prompts["en"]))
        return

    # escalated thread — forward to group, skip GPT
    if thread.get("escalated"):
        await _forward_to_group(msg.bot, thread, msg.text)
        db.save_message(thread["id"], "agent", f"[forwarded] {msg.text}")
        return

    # payment intent keyword
    lower = msg.text.lower()
    if any(kw in lower for kw in gpt.PAYMENT_KEYWORDS) and not thread.get("venue_id"):
        _pay_state[msg.from_user.id] = None
        prompts = {
            "ru": "Введите ваш логин от Checki:",
            "en": "Enter your Checki login:",
            "ka": "შეიყვანეთ Checki-ს ლოგინი:",
        }
        await msg.answer(prompts.get(lang, prompts["en"]))
        return

    # GPT answer
    history = db.get_history(thread["id"])
    reply_text, should_escalate = await gpt.get_reply(history[:-1], msg.text)

    if should_escalate or not reply_text:
        esc_msgs = {
            "ru": "Передаю вас живому оператору — ответим в ближайшее время.",
            "en": "Connecting you to a human agent — we'll reply shortly.",
            "ka": "გადაგიყვანთ ოპერატორთან — მალე გიპასუხებთ.",
        }
        reply_text = esc_msgs.get(lang, esc_msgs["en"])
        db.save_message(thread["id"], "bot", reply_text)
        await msg.answer(reply_text)
        await _escalate(msg.bot, thread, history, msg.text)
        return

    db.save_message(thread["id"], "bot", reply_text)
    await msg.answer(reply_text, reply_markup=_feedback_kb())


async def _handle_pay_login(msg: Message, thread: dict, lang: str) -> None:
    venue = db.find_venue(msg.text.strip())
    if not venue:
        not_found = {
            "ru": "Заведение не найдено. Попробуйте логин, email или точное название заведения.",
            "en": "Venue not found. Try your login, email or exact venue name.",
            "ka": "ვერ მოიძებნა. სცადეთ ლოგინი, ელ.ფოსტა ან დაწ. სახელი.",
        }
        await msg.answer(not_found.get(lang, not_found["en"]))
        return

    from datetime import datetime, timezone
    sub_exp = venue.get("subscription_expires_at")
    now = datetime.now(timezone.utc)
    is_expired = (not venue.get("is_free")) and (sub_exp is None or sub_exp.astimezone(timezone.utc) < now)

    if is_expired:
        confirm_kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Продлить на 30 дней (49 ₾)", callback_data=f"extend:{venue['id']}:30"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="extend:cancel"),
        ]])
        exp_str = sub_exp.strftime("%-d %b %Y") if sub_exp else "—"
        msgs = {
            "ru": f"Заведение: *{venue['name']}*\nПодписка истекла: {exp_str}\n\nПродлить на 30 дней (49 ₾)?",
            "en": f"Venue: *{venue['name']}*\nSubscription expired: {exp_str}\n\nExtend for 30 days (49 ₾)?",
            "ka": f"დაწ.: *{venue['name']}*\nგამოწერა ამოიწურა: {exp_str}\n\nგახანგრძლივება 30 დღით (49 ₾)?",
        }
        await msg.answer(msgs.get(lang, msgs["en"]), parse_mode="Markdown", reply_markup=confirm_kb)
    else:
        exp_str = sub_exp.strftime("%-d %b %Y") if sub_exp else "active"
        ok_msgs = {
            "ru": f"Заведение: *{venue['name']}*\nПодписка активна до {exp_str}. Всё хорошо!",
            "en": f"Venue: *{venue['name']}*\nSubscription active until {exp_str}. All good!",
            "ka": f"დაწ.: *{venue['name']}*\nგამოწერა აქტიურია {exp_str}-მდე.",
        }
        await msg.answer(ok_msgs.get(lang, ok_msgs["en"]), parse_mode="Markdown")


# ── /close in group ──────────────────────────────────────────────────────────

@router.message(F.chat.id == SUPPORT_GROUP_ID, Command("close"), F.reply_to_message)
async def group_close(msg: Message) -> None:
    thread = _find_thread_by_group_msg(msg.reply_to_message.message_id)
    if not thread:
        await msg.reply("Thread not found.")
        return
    db.close_thread(thread["id"])
    lang = thread.get("language_code", "en")
    bye_msgs = {
        "ru": "✅ Вопрос решён! Если появятся новые — пишите, всегда поможем.",
        "en": "✅ Issue resolved! Feel free to write again if you have more questions.",
        "ka": "✅ საკითხი მოგვარებულია! თუ კითხვები გექნებათ — მოგვმართეთ.",
    }
    await msg.bot.send_message(thread["tg_user_id"], bye_msgs.get(lang, bye_msgs["en"]))
    await msg.reply(f"✅ Thread #{thread['id']} closed. Bot mode restored.")


# ── group reply → forward to user ─────────────────────────────────────────────

@router.message(F.chat.id == SUPPORT_GROUP_ID, F.reply_to_message)
async def group_reply(msg: Message) -> None:
    if msg.from_user.is_bot:
        return
    thread = _find_thread_by_group_msg(msg.reply_to_message.message_id)
    if not thread:
        return
    db.save_message(thread["id"], "agent", msg.text or "")
    await msg.bot.send_message(thread["tg_user_id"], f"🧑‍💼 {msg.text}")


def _find_thread_by_group_msg(group_msg_id: int) -> dict | None:
    import psycopg2.extras, contextlib
    from db import _conn
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM support_threads WHERE group_msg_id=%s LIMIT 1", (group_msg_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        with contextlib.suppress(Exception):
            conn.close()


# ── feedback callbacks ─────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("fb:"))
async def feedback(cb: CallbackQuery) -> None:
    action = cb.data.split(":")[1]
    lang = (cb.from_user.language_code or "en")[:2]
    lang = lang if lang in ("ru", "ka") else "en"
    await cb.message.edit_reply_markup(reply_markup=None)

    if action == "good":
        thanks = {"ru": "Рады помочь! 😊", "en": "Glad to help! 😊", "ka": "სიამოვნებით! 😊"}
        await cb.answer(thanks.get(lang, thanks["en"]))
    else:
        thread = db.get_or_create_thread(cb.from_user.id, cb.from_user.first_name or "", cb.from_user.username, lang)
        history = db.get_history(thread["id"])
        last_user = next((m["text"] for m in reversed(history) if m["role"] == "user"), "")
        esc_msgs = {
            "ru": "Передаю оператору — ответим скоро.",
            "en": "Connecting you to an agent — reply coming soon.",
            "ka": "გადაგიყვანთ ოპერატორთან.",
        }
        reply = esc_msgs.get(lang, esc_msgs["en"])
        db.save_message(thread["id"], "bot", reply)
        await cb.message.answer(reply)
        await _escalate(cb.bot, thread, history, last_user)
        await cb.answer()


# ── extend subscription callback ──────────────────────────────────────────────

@router.callback_query(F.data.startswith("extend:"))
async def extend_cb(cb: CallbackQuery) -> None:
    parts = cb.data.split(":")
    lang = (cb.from_user.language_code or "en")[:2]
    lang = lang if lang in ("ru", "ka") else "en"

    if parts[1] == "cancel":
        cancel_msgs = {"ru": "Отменено.", "en": "Cancelled.", "ka": "გაუქმდა."}
        await cb.message.edit_text(cancel_msgs.get(lang, cancel_msgs["en"]))
        await cb.answer()
        return

    venue_id, days = parts[1], int(parts[2])
    db.extend_subscription(venue_id, days)
    ok_msgs = {
        "ru": f"✅ Подписка продлена на {days} дней! Спасибо.",
        "en": f"✅ Subscription extended by {days} days! Thank you.",
        "ka": f"✅ გამოწერა გახანგრძლივდა {days} დღით! გმადლობთ.",
    }
    await cb.message.edit_text(ok_msgs.get(lang, ok_msgs["en"]))
    await cb.answer()
