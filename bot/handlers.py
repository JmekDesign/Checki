from __future__ import annotations

import os
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import CommandStart, Command

import db
import gpt

router = Router()
SUPPORT_GROUP_ID = int(os.environ["SUPPORT_GROUP_ID"])

# ── helpers ───────────────────────────────────────────────────────────────────

def _lang(msg: Message) -> str:
    code = (msg.from_user.language_code or "en")[:2]
    return code if code in ("ru", "ka") else "en"


def _feedback_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="👍", callback_data="fb:good"),
        InlineKeyboardButton(text="👎", callback_data="fb:bad"),
        InlineKeyboardButton(text="👤 Оператор", callback_data="fb:human"),
    ]])


async def _escalate(bot_instance, thread: dict, history: list[dict], last_user_text: str) -> None:
    lines = [f"[Checki Support #{thread['id']} | @{thread.get('tg_username') or '—'} | {thread.get('tg_first_name','')}]", ""]
    for m in history[-8:]:
        icon = "👤" if m["role"] == "user" else ("🤖" if m["role"] == "bot" else "🧑‍💼")
        lines.append(f"{icon} {m['text']}")
    lines += ["", f"❓ {last_user_text}"]
    text = "\n".join(lines)
    sent = await bot_instance.send_message(SUPPORT_GROUP_ID, text)
    db.update_thread(thread["id"], escalated=True, group_msg_id=sent.message_id)


# ── /start ────────────────────────────────────────────────────────────────────

@router.message(CommandStart())
async def cmd_start(msg: Message) -> None:
    lang = _lang(msg)
    thread = db.get_or_create_thread(
        msg.from_user.id,
        msg.from_user.first_name or "",
        msg.from_user.username,
        lang,
    )
    greetings = {
        "ru": "Привет! Я помогу с вопросами по Checki. Просто напишите — что случилось?",
        "en": "Hi! I'm the Checki support bot. What can I help you with?",
        "ka": "გამარჯობა! მე ვარ Checki-ს მხარდაჭერის ბოტი. რით შემიძლია დაგეხმაროთ?",
    }
    await msg.answer(greetings.get(lang, greetings["en"]))


# ── /pay — subscription extension ─────────────────────────────────────────────

@router.message(Command("pay"))
async def cmd_pay(msg: Message) -> None:
    lang = _lang(msg)
    prompts = {
        "ru": "Введите ваш логин от Checki (тот, что используете для входа):",
        "en": "Enter your Checki login (the one you use to sign in):",
        "ka": "შეიყვანეთ თქვენი Checki-ს ლოგინი:",
    }
    thread = db.get_or_create_thread(
        msg.from_user.id, msg.from_user.first_name or "",
        msg.from_user.username, lang,
    )
    db.update_thread(thread["id"], escalated=False)
    db.save_message(thread["id"], "user", "/pay")
    await msg.answer(prompts.get(lang, prompts["en"]))
    db.update_thread(thread["id"], group_msg_id=None)  # reset escalation state, wait for login


# ── incoming user messages ────────────────────────────────────────────────────

@router.message(F.chat.type == "private")
async def user_message(msg: Message) -> None:
    if not msg.text:
        return
    lang = _lang(msg)
    thread = db.get_or_create_thread(
        msg.from_user.id, msg.from_user.first_name or "",
        msg.from_user.username, lang,
    )
    db.save_message(thread["id"], "user", msg.text)

    # Check if we're waiting for login (after /pay)
    history = db.get_history(thread["id"])
    last_bot = next((m for m in reversed(history[:-1]) if m["role"] == "bot"), None)
    waiting_login = last_bot and "логин" in last_bot["text"].lower() or (last_bot and "login" in last_bot["text"].lower())

    if waiting_login and not thread.get("venue_id"):
        await _handle_login(msg, thread, lang)
        return

    # GPT answer
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


async def _handle_login(msg: Message, thread: dict, lang: str) -> None:
    venue = db.find_venue_by_login(msg.text.strip())
    if not venue:
        not_found = {
            "ru": "Логин не найден. Попробуйте ещё раз или напишите /pay снова.",
            "en": "Login not found. Try again or type /pay to restart.",
            "ka": "ლოგინი ვერ მოიძებნა. სცადეთ ისევ ან დაწერეთ /pay.",
        }
        await msg.answer(not_found.get(lang, not_found["en"]))
        return

    db.update_thread(thread["id"], venue_id=venue["id"])

    from datetime import datetime, timezone
    sub_exp = venue.get("subscription_expires_at")
    now = datetime.now(timezone.utc)
    is_expired = (not venue.get("is_free")) and (sub_exp is None or sub_exp.astimezone(timezone.utc) < now)

    if is_expired:
        confirm_kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Да, продлить на 30 дней", callback_data=f"extend:{venue['id']}:30"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="extend:cancel"),
        ]])
        exp_str = sub_exp.strftime("%-d %b %Y") if sub_exp else "—"
        msgs = {
            "ru": f"Заведение: *{venue['name']}*\nПодписка истекла: {exp_str}\n\nПродлить на 30 дней (49 ₾)?",
            "en": f"Venue: *{venue['name']}*\nSubscription expired: {exp_str}\n\nExtend for 30 days (49 ₾)?",
            "ka": f"დაწესებულება: *{venue['name']}*\nგამოწერა ამოიწურა: {exp_str}\n\nგავახანგრძლივოთ 30 დღით (49 ₾)?",
        }
        await msg.answer(msgs.get(lang, msgs["en"]), parse_mode="Markdown", reply_markup=confirm_kb)
    else:
        exp_str = sub_exp.strftime("%-d %b %Y") if sub_exp else "активна"
        ok_msgs = {
            "ru": f"Заведение: *{venue['name']}*\nПодписка активна до {exp_str}. Всё хорошо!",
            "en": f"Venue: *{venue['name']}*\nSubscription active until {exp_str}. All good!",
            "ka": f"დაწესებულება: *{venue['name']}*\nგამოწერა აქტიურია {exp_str}-მდე.",
        }
        await msg.answer(ok_msgs.get(lang, ok_msgs["en"]), parse_mode="Markdown")


# ── reply from support group → forward to user ────────────────────────────────

@router.message(F.chat.id == SUPPORT_GROUP_ID, F.reply_to_message)
async def group_reply(msg: Message) -> None:
    if msg.from_user.is_bot:
        return
    reply_to_id = msg.reply_to_message.message_id
    conn_row = _find_thread_by_group_msg(reply_to_id)
    if not conn_row:
        return
    db.save_message(conn_row["id"], "agent", msg.text or "")
    await msg.bot.send_message(conn_row["tg_user_id"], f"🧑‍💼 {msg.text}")


def _find_thread_by_group_msg(group_msg_id: int) -> dict | None:
    import psycopg2, psycopg2.extras, contextlib
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
        thread = db.get_or_create_thread(
            cb.from_user.id, cb.from_user.first_name or "",
            cb.from_user.username, lang,
        )
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
        "ru": f"✅ Подписка продлена на {days} дней! Спасибо за оплату.",
        "en": f"✅ Subscription extended by {days} days! Thank you.",
        "ka": f"✅ გამოწერა გახანგრძლივდა {days} დღით! გმადლობთ.",
    }
    await cb.message.edit_text(ok_msgs.get(lang, ok_msgs["en"]))
    await cb.answer()
