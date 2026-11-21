import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
import os
import requests
from pathlib import Path

env_path = Path(__file__).parent / '.env'
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

BOT_TOKEN = os.environ.get('BOT_TOKEN')
WEBAPP_URL = os.environ.get('WEBAPP_URL')

bot = telebot.TeleBot(BOT_TOKEN)

@bot.message_handler(commands=['start'])
def start(message):
    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("🎮 Открыть CYBER FACEIT", web_app=WebAppInfo(url=WEBAPP_URL)))
    bot.send_message(message.chat.id, "Нажми кнопку ниже:", reply_markup=kb)

@bot.callback_query_handler(func=lambda call: True)
def callback_inline(call):
    if call.data.startswith('validate_') or call.data.startswith('reject_'):
        action, mid = call.data.split('_')
        bot.answer_callback_query(call.id, "Обрабатываю...")
        
        try:
            if action == 'validate':
                requests.post(f'http://localhost:5000/api/matches/{mid}/status', json={'status': 'pending_validation'})
                text = f"✅ Матч #{mid} принят.\nЗаполните статистику в админ-панели."
            else:
                requests.post(f'http://localhost:5000/api/matches/{mid}/status', json={'status': 'rejected'})
                text = f"❌ Матч #{mid} отклонен."
                
            bot.edit_message_caption(chat_id=call.message.chat.id, message_id=call.message.message_id, caption=text)
            
            kb = InlineKeyboardMarkup()
            kb.add(InlineKeyboardButton("⚙️ Открыть Админ-панель", web_app=WebAppInfo(url=WEBAPP_URL)))
            bot.send_message(call.message.chat.id, "Перейдите в панель:", reply_markup=kb)
            
        except Exception as e:
            bot.send_message(call.message.chat.id, f"Ошибка связи с сервером: {e}")

if __name__ == '__main__':
    print("[bot] polling started", flush=True)
    bot.infinity_polling(timeout=30, long_polling_timeout=30)
