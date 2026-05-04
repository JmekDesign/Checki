from __future__ import annotations

import os
import pathlib
from openai import AsyncOpenAI

_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
_KB = (pathlib.Path(__file__).parent / "support_kb.md").read_text()

ESCALATION_KEYWORDS = {"человек", "оператор", "помогите", "баг", "bug", "помоги", "support",
                       "operator", "human", "ადამიანი", "დახმარება"}

SYSTEM_PROMPT = f"""You are a friendly support assistant for Checki — a web app for bars, cafes and restaurants.
Answer questions based on the knowledge base below. Be concise (2-4 sentences max).
If you are not confident or the question is outside the knowledge base, reply ONLY with the word: ESCALATE
Do not make up information. Respond in the same language as the user.

Knowledge base:
{_KB}"""


async def get_reply(history: list[dict[str, str]], user_text: str) -> tuple[str, bool]:
    """Returns (reply_text, should_escalate)."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history[-6:]:
        role = "assistant" if msg["role"] in ("bot", "agent") else "user"
        messages.append({"role": role, "content": msg["text"]})
    messages.append({"role": "user", "content": user_text})

    resp = await _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=300,
        temperature=0.4,
    )
    text = resp.choices[0].message.content or ""

    if text.strip().upper() == "ESCALATE":
        return "", True

    lower = user_text.lower()
    should_escalate = any(kw in lower for kw in ESCALATION_KEYWORDS)
    return text.strip(), should_escalate
