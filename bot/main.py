from __future__ import annotations

import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties

import db
import handlers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SUPPORT_GROUP_ID = int(os.environ["SUPPORT_GROUP_ID"])
CHECK_INTERVAL   = 10 * 60   # check every 10 minutes
NUDGE_AFTER_MIN  = 15        # nudge if no reply for 15 minutes
AUTO_CLOSE_HOURS = 2         # auto-close after 2 hours of inactivity


async def _background_tasks(bot: Bot) -> None:
    while True:
        await asyncio.sleep(CHECK_INTERVAL)
        try:
            # Nudge operator if no reply in time
            for thread in db.get_threads_to_nudge(NUDGE_AFTER_MIN):
                lang = thread.get("language_code", "en")
                nudge_user = {
                    "ru": "Мы уже разбираемся с вашим вопросом — ответим в ближайшее время.",
                    "en": "We're looking into your question — will reply shortly.",
                    "ka": "ვმუშაობთ თქვენს კითხვაზე — მალე გიპასუხებთ.",
                }
                await bot.send_message(thread["tg_user_id"], nudge_user.get(lang, nudge_user["en"]))
                if thread.get("group_msg_id"):
                    await bot.send_message(
                        SUPPORT_GROUP_ID,
                        f"⏰ Thread #{thread['id']} (@{thread.get('tg_username') or '—'}) "
                        f"waiting {NUDGE_AFTER_MIN}+ min — no reply yet.",
                        reply_to_message_id=thread["group_msg_id"],
                    )
                from datetime import datetime, timezone
                db.update_thread(thread["id"], nudged_at=datetime.now(timezone.utc))
        except Exception as e:
            logging.warning("Nudge task error: %s", e)

        try:
            # Auto-close idle escalated threads
            for thread in db.get_threads_to_close(AUTO_CLOSE_HOURS):
                lang = thread.get("language_code", "en")
                close_msgs = {
                    "ru": "Диалог закрыт по таймауту. Если нужна помощь — просто напишите!",
                    "en": "Conversation closed due to inactivity. Feel free to write if you need help!",
                    "ka": "დიალოგი დაიხურა. თუ კითხვა გექნებათ — მოგვწერეთ!",
                }
                await bot.send_message(thread["tg_user_id"], close_msgs.get(lang, close_msgs["en"]))
                db.close_thread(thread["id"])
                logging.info("Auto-closed thread #%s", thread["id"])
        except Exception as e:
            logging.warning("Auto-close task error: %s", e)


async def main() -> None:
    bot = Bot(
        token=os.environ["BOT_TOKEN"],
        default=DefaultBotProperties(parse_mode=None),
    )
    dp = Dispatcher()
    dp.include_router(handlers.router)

    asyncio.create_task(_background_tasks(bot))

    logging.info("Checki support bot starting...")
    await dp.start_polling(bot, allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    asyncio.run(main())
