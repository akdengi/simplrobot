from flask import Flask, request, jsonify
import logging
import random
from PIL import Image
import vk_api
from vk_api.upload import VkUpload
from vk_api.utils import get_random_id
import threading
import requests
import os

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === Настройки ===
GROUP_ID = 123456789  # Замени на ID своей группы ВК
ACCESS_TOKEN = 'vk1.a.your_access_token_here'  # Токен группы
CONFIRMATION_TOKEN = 'your_confirmation_token'  # Из настроек Callback
SERVER_URL = "https://22176.hostkey.in:34172/vk/"  # URL твоего сервера
# =================

app = Flask(__name__)

# Глобальная блокировка для потокобезопасности
user_lock = threading.Lock()

# Инициализация сессии ВК
vk_session = vk_api.VkApi(token=ACCESS_TOKEN)
vk = vk_session.get_api()
upload = VkUpload(vk_session)

# Карты и их изображения
cart_dict = {
    1: ("Прямой Проводник или Угловой Проводник", "bot_image/pryamoy_uglovoy_provodnik.jpg"),
    2: ("Скрещивающиеся Проводники или Проводник с Двумя углами", "bot_image/skreschivayuschiesya_provodniki.jpg"),
    3: ("Лампа или Геркон", "bot_image/lampa_gerkon.jpg"),
    4: ("Светодиод или Магнит", "bot_image/svetodiod_magnit.jpg"),
    5: ("Резистор", "bot_image/rezistor.jpg"),
    6: ("Диод", "bot_image/diod.jpg")
}

# Состояния пользователей: {user_id: {'round': 1, 'game_active': True}}
user_state = {}

def resize_photo(photo_path, target_width=390):
    try:
        image = Image.open(photo_path)
        original_width, original_height = image.size
        ratio = target_width / original_width
        new_size = (int(original_width * ratio), int(original_height * ratio))
        resized_image = image.resize(new_size, Image.Resampling.LANCZOS)
        resized_image.save(photo_path)
    except Exception as e:
        logger.error(f"Ошибка при изменении размера: {e}")

def upload_photo_to_vk(photo_path):
    try:
        photo = upload.photo_messages(photo_path)[0]
        return f"photo{photo['owner_id']}_{photo['id']}"
    except Exception as e:
        logger.error(f"Ошибка загрузки фото: {e}")
        return None

def send_message(user_id, message, attachment=None, keyboard=None):
    try:
        vk.messages.send(
            user_id=user_id,
            message=message,
            attachment=attachment,
            keyboard=keyboard,
            random_id=get_random_id()
        )
    except Exception as e:
        logger.error(f"Ошибка отправки сообщения: {e}")

def get_keyboard(buttons):
    keyboard = {"one_time": False, "buttons": []}
    row = []
    for label, payload in buttons:
        row.append({
            "action": {"type": "text", "label": label, "payload": f'"{payload}"'}
        })
    keyboard["buttons"].append(row)
    return json.dumps(keyboard, ensure_ascii=False)

def send_round(user_id):
    with user_lock:
        if user_id not in user_state:
            return
        round_number = user_state[user_id]['round']

    Dice1 = random.randint(1, 6)
    Dice2 = random.randint(1, 6)
    Dice3 = random.randint(1, 6)

    Cart, cart_image_path = cart_dict[Dice3]
    nomer_stolbca_image_path = f"bot_image/Nomer_stolbca_{Dice2}.jpg"

    # Проверяем существование файлов
    if not os.path.exists(cart_image_path):
        send_message(user_id, "Ошибка: не найдено изображение карты.")
        return
    if not os.path.exists(nomer_stolbca_image_path):
        send_message(user_id, "Ошибка: не найдено изображение номера столбца.")
        return

    resize_photo(cart_image_path)
    resize_photo(nomer_stolbca_image_path)

    cart_attachment = upload_photo_to_vk(cart_image_path)
    nomer_attachment = upload_photo_to_vk(nomer_stolbca_image_path)

    if Dice1 in [2, 3, 4, 5]:
        text = (f"Раунд {round_number}\n\n"
                f"*Мой ход:*\n"
                f"Уберите из Столбца {Dice2} карточку: {Cart}. "
                f"Если нет — Автомата пропускает ход.\n\n"
                f"_Выполни ход за меня, затем нажми 'Следующий раунд'_")
    elif Dice1 == 1:
        text = (f"Раунд {round_number}\n\n"
                f"*Мой ход:*\n"
                f"Достань карточку и положи её в столбец {Dice2}, чтобы продолжить цепь.\n"
                f"Даже если будет короткое замыкание — выкладывай.\n"
                f"Если зажглись лампы — положи жетоны свечения.\n\n"
                f"_После хода нажми 'Следующий раунд'_")
    elif Dice1 == 6:
        text = (f"Раунд {round_number}\n\n"
                f"*Мой ход:*\n"
                f"Достань карточку и положи её в столбец {Dice2} по правилам.\n"
                f"Если невозможно — отправь в сброс.\n\n"
                f"_После хода нажми 'Следующий раунд'_")

    # Отправляем ход
    if cart_attachment:
        send_message(user_id, text, attachment=cart_attachment)
    if nomer_attachment:
        send_message(
            user_id,
            "Мой ход завершён. Теперь твой. Готов к следующему раунду?",
            attachment=nomer_attachment,
            keyboard=get_keyboard([("Следующий раунд", "next"), ("Закончить игру", "end")])
        )

@app.route('/vk', methods=['POST'])
def vk_callback():
    data = request.get_json()
    logger.info(f"Получено событие: {data}")

    if not data:
        return 'ok', 200

    # Подтверждение сервера
    if data['type'] == 'confirmation':
        return CONFIRMATION_TOKEN, 200

    # Обработка нового сообщения
    if data['type'] == 'message_new':
        user_id = data['object']['message']['from_id']
        msg = data['object']['message']['text'].strip().lower()

        with user_lock:
            if msg in ['начать', 'start']:
                user_state[user_id] = {'round': 1, 'game_active': True}
                keyboard = get_keyboard([("Начать игру", "start_game")])
                send_message(
                    user_id,
                    f"Привет, игрок! Я — Автомата.\n"
                    f"Буду играть против тебя. Ты будешь выполнять ходы за меня.\n\n"
                    f"Правила: [ссылка](https://disk.yandex.ru/i/18I-YHiivSOrKQ)",
                    keyboard=keyboard
                )

            elif msg in ['начать игру', 'start_game']:
                if user_id not in user_state:
                    user_state[user_id] = {'round': 1, 'game_active': True}
                send_round(user_id)

            elif msg in ['следующий раунд', 'next']:
                if user_id in user_state and user_state[user_id]['game_active']:
                    user_state[user_id]['round'] += 1
                    send_round(user_id)
                else:
                    send_message(user_id, "Сначала начни игру командой 'начать'.")

            elif msg in ['закончить игру', 'end']:
                if user_id in user_state:
                    round_num = user_state[user_id]['round']
                    send_message(user_id, f"Игра закончена! Ты прошёл {round_num} раундов.")
                    del user_state[user_id]
                else:
                    send_message(user_id, "Игра не начата.")

        return 'ok', 200

    return 'ok', 200

@app.route('/')
def index():
    return "VK Bot is running!", 200

if __name__ == '__main__':
    import json  # Добавим json для сериализации клавиатуры
    app.run(host='127.0.0.1', port=8080, ssl_context=None)

#app.run(
#    host='0.0.0.0',
#    port=34172,
#    ssl_context=(
#        '/etc/letsencrypt/live/bot.yourgame.com/fullchain.pem',
#        '/etc/letsencrypt/live/bot.yourgame.com/privkey.pem'
#    )
#)