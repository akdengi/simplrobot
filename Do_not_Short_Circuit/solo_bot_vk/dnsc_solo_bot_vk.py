# локация бота в <host>/vk_solo_bot через nginx

import vk_api
import random
import requests
import hashlib
import threading
import traceback
from vk_api import VkUpload
from vk_api.keyboard import VkKeyboard
from io import BytesIO
from PIL import Image
import json
from flask import Flask, request

# === Настройки ===
VK_TOKEN = "vk1.a.kFfsHIYWdzbxhX7kccC02PkBOmnLawxAz7LQV1EirK7CwMkRhf49AQhTbSJThJAayxzbWO2YZI6-HfCUUEvCXgSmrXkHhZM_hlMWLhdZodGaK9tZZ4BiPHPXUYCoKk-Ow7Qmp6AptgzwQXAJGMUHxnoeWrlyITWaFHLDny4SPPJ_hm14bHItvIWyTNR4DyrPF99Rwp6eV8dHWrd8URuh0A"
VK_SECRET = "df549dfg55605fpormvd8035"
VK_CONFIRMATION_TOKEN = "25dd3ebc"
IMAGE_BASE_URL = "https://invapi.online/pictures/solo_bot_image/"

# Инициализация VK API
vk_session = vk_api.VkApi(token=VK_TOKEN, api_version='5.199')
vk = vk_session.get_api()
upload = VkUpload(vk_session)

app = Flask(__name__)

# === База данных карт ===
cart_dict = {
    1: ("[Прямой Проводник] или [Угловой Проводник]", "pryamoy_uglovoy_provodnik.jpg"),
    2: ("[Скрещивающиеся Проводники] или [Проводник с Двумя углами]", "skreschivayuschiesya_provodniki.jpg"),
    3: ("[Лампа] или [Геркон]", "lampa_gerkon.jpg"),
    4: ("[Светодиод] или [Магнит]", "svetodiod_magnit.jpg"),
    5: ("[Резистор]", "rezistor.jpg"),
    6: ("[Диод]", "diod.jpg")
}

# Хранилище состояний пользователей
user_states = {}

# Блокировка для потокобезопасного доступа к user_states
states_lock = threading.Lock()


# === Функция загрузки и изменения размера изображения ===
def resize_photo_force_size(image_url, target_width=800, target_height=450):
    try:
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))

        if image.mode in ('RGBA', 'P'):
            bg = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'RGBA':
                bg.paste(image, mask=image.split()[-1])
            else:
                image_rgba = image.convert('RGBA')
                bg.paste(image_rgba, mask=image_rgba.split()[-1])
            image = bg

        original_width, original_height = image.size
        new_height = int(original_height * (target_width / original_width))
        resized_image = image.resize((target_width, new_height), Image.Resampling.LANCZOS)

        final_image = Image.new('RGB', (target_width, target_height), (255, 255, 255))

        if new_height < target_height:
            paste_y = (target_height - new_height) // 2
            final_image.paste(resized_image, (0, paste_y))
        elif new_height > target_height:
            crop_y = (new_height - target_height) // 2
            cropped_resized = resized_image.crop((0, crop_y, target_width, crop_y + target_height))
            final_image.paste(cropped_resized, (0, 0))
        else:
            final_image.paste(resized_image, (0, 0))

        bio = BytesIO()
        bio.name = "image.jpg"
        final_image.save(bio, format="JPEG", quality=95, optimize=True)
        bio.seek(0)
        return bio

    except Exception as e:
        print(f"Ошибка при загрузке/изменении изображения {image_url}: {e}")
        return None


# === Отправка изображения ===
def upload_image_to_vk(image_url):
    try:
        image_bytes = resize_photo_force_size(image_url, target_width=800, target_height=450)
        if image_bytes:
            photo = upload.photo_messages(photos=image_bytes)[0]
            return f"photo{photo['owner_id']}_{photo['id']}"
    except Exception as e:
        print(f"Ошибка загрузки изображения: {e}")
    return None


# === Отправка сообщения с клавиатурой ===
def send_message(user_id, message, keyboard=None, attachment=None):
    try:
        params = {
            'user_id': user_id,
            'message': message,
            'random_id': random.randint(1, 2**31),
        }
        if keyboard:
            params['keyboard'] = keyboard.get_keyboard()
        if attachment:
            params['attachment'] = attachment

        vk.messages.send(**params)
    except Exception as e:
        print(f"Ошибка отправки сообщения: {e}")


# === Начало игры ===
def start_game(user_id):
    with states_lock:
        if user_id in user_states:
            del user_states[user_id]
        user_states[user_id] = {'round': 1}
    play_round(user_id)


# === Игровой раунд ===
def play_round(user_id):
    with states_lock:
        state = user_states.get(user_id, {'round': 1})
        round_number = state['round']

    Dice1 = random.randint(1, 6)
    Dice2 = random.randint(1, 6)
    Dice3 = random.randint(1, 6)

    Cart, cart_image_filename = cart_dict[Dice3]
    cart_image_url = IMAGE_BASE_URL + cart_image_filename
    nomer_stolbca_image_url = f"{IMAGE_BASE_URL}Nomer_stolbca_{Dice2}.jpg"

    keyboard = VkKeyboard(inline=True)
    keyboard.add_callback_button('Следующий раунд', payload={'action': 'next_round'})
    keyboard.add_line()
    keyboard.add_callback_button('Закончить игру', payload={'action': 'end_game'})

    if Dice1 in [2, 3, 4, 5]:
        text = (
            f"Раунд {round_number}\n\n"
            f"Мой ход:\n\n"
            f"Уберите из Столбца {Dice2} игрового поля одну любую карточку {Cart}. "
            f"Если в данном столбце нет подходящей карточки, то Автомата в данном раунде ничего не делает.\n\n"
            f"После того, как выполните ход за меня (Автомату), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД. "
            f"Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз."
        )
    elif Dice1 == 1:
        text = (
            f"Раунд {round_number}\n\n"
            f"Мой ход:\n\n"
            f"Достаньте из мешка карточку и положите ее на любое место столбца {Dice2} "
            f"так, чтобы она минимум одной гранью продолжала электрическую цепь.\n\n"
            f"Выкладывать карточку нужно даже в том случае, если этим действием вы создаете замкнутую цепь "
            f"вплоть до короткого замыкания.\n\n"
            f"Если при этом вы зажгли лампочки или светодиоды, которые приносят очки, то выложите на эти "
            f"светящиеся элементы жетоны свечения Автоматы. Если выложить карточку по правилу невозможно, "
            f"отправьте ее в сброс.\n\n"
            f"После того, как выполните ход за меня (Автомату), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД. "
            f"Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз."
        )
    else:  # Dice1 == 6
        text = (
            f"Раунд {round_number}\n\n"
            f"Мой ход:\n\n"
            f"Достаньте из мешка карточку и положите ее на любое место выпавшего столбца {Dice2} по "
            f"стандартным правилам игры. Если выложить карточку невозможно, отправьте ее в Сброс.\n\n"
            f"После того, как выполните ход за меня (Автомату), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД. "
            f"Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз."
        )

    send_message(user_id, "🎲 Кидаю кубики для нового раунда...")

    if Dice1 in [2, 3, 4, 5]:
        cart_attachment = upload_image_to_vk(cart_image_url)
        send_message(user_id, text, attachment=cart_attachment)
    else:
        send_message(user_id, text)

    nomer_attachment = upload_image_to_vk(nomer_stolbca_image_url)
    send_message(user_id, "", keyboard=keyboard, attachment=nomer_attachment)


# === Следующий раунд ===
def next_round(user_id):
    with states_lock:
        if user_id not in user_states:
            user_states[user_id] = {'round': 1}
        user_states[user_id]['round'] += 1
    play_round(user_id)


# === Завершение игры ===
def end_game(user_id):
    with states_lock:
        round_number = user_states.get(user_id, {}).get('round', 1)
        # Удаляем состояние, чтобы пользователь начал заново
        if user_id in user_states:
            del user_states[user_id]

    send_message(user_id, f"🎮 Игра закончена!\nВы прошли её за {round_number} раунда(ов).")
    send_message(user_id, f"⚠️ Обнуляю состояние игрового раунда и перезапускаюсь!")
    send_welcome(user_id)


# === Приветствие игрока ===
def send_welcome(user_id):
    text = (
        "Приветствую тебя, игрок. Я — Автомата, и я буду играть против тебя. "
        "Попробуй набрать максимальное число очков за минимальное число раундов.\n\n"
        "Но тебе нужно помочь мне выполнять ходы физически, так как у меня нет рук. "
        "Начнём?\n\n"
        "📖 Правила соло-режима можно найти по ссылке: https://disk.yandex.ru/i/18I-YHiivSOrKQ"
    )
    keyboard = VkKeyboard(inline=True)
    keyboard.add_callback_button('Начать игру', payload={'action': 'start_game'})
    send_message(user_id, text, keyboard=keyboard)


# === Фоновые обработчики ===
def handle_message_event(user_id, event_id, peer_id, action):
    """Выполняется в отдельном потоке после возврата ok в VK."""
    try:
        if action == 'next_round':
            next_round(user_id)
        elif action == 'end_game':
            end_game(user_id)
        elif action == 'start_game':
            start_game(user_id)
        elif action == 'rules':
            send_welcome(user_id)
        else:
            send_message(user_id, "Неизвестное действие.")
    except Exception as e:
        print(f"handle_message_event error: {e}")
        traceback.print_exc()
    finally:
        # Подтверждение нажатия кнопки — убирает "крутилку" на кнопке
        try:
            vk_session.method('messages.sendMessageEventAnswer', {
                'event_id': event_id,
                'user_id': user_id,
                'peer_id': peer_id,
            })
        except Exception as e:
            print(f"sendMessageEventAnswer error: {e}")


def handle_message_new(user_id, payload):
    """Выполняется в отдельном потоке после возврата ok в VK."""
    try:
        action = payload.get('action') if isinstance(payload, dict) else None
        if action == 'start_game':
            start_game(user_id)
        elif action == 'next_round':
            next_round(user_id)
        elif action == 'end_game':
            end_game(user_id)
        else:
            with states_lock:
                in_game = user_id in user_states
            if not in_game:
                send_welcome(user_id)
            else:
                send_message(user_id, "Используйте кнопки под сообщением.")
    except Exception as e:
        print(f"handle_message_new error: {e}")
        traceback.print_exc()


# === Обработка событий Callback API ===
@app.route('/', methods=['POST'])
def callback():
    data = request.get_json(silent=True)

    if not data or 'type' not in data:
        return 'not vk', 200

    # Подтверждение сервера
    if data['type'] == 'confirmation':
        return VK_CONFIRMATION_TOKEN, 200

    # Проверка секрета
    if VK_SECRET and data.get('secret') != VK_SECRET:
        return 'bad secret', 403

    event_type = data.get('type')

    # === message_event: нажатия на callback-кнопки ===
    if event_type == 'message_event':
        obj = data.get('object', {})
        user_id = obj.get('user_id')
        event_id = obj.get('event_id')
        peer_id = obj.get('peer_id')
        action = (obj.get('payload') or {}).get('action')

        if user_id is None or event_id is None or peer_id is None:
            return 'ok'

        threading.Thread(
            target=handle_message_event,
            args=(user_id, event_id, peer_id, action),
            daemon=True
        ).start()

        return 'ok'

    # === message_new: новые сообщения ===
    if event_type == 'message_new':
        obj = data.get('object', {}).get('message', {})

        # ⚠️ ГЛАВНЫЙ ФИЛЬТР: игнорируем сообщения, отправленные самим ботом
        if obj.get('out') == 1:
            print("[FILTER] Игнорирую исходящее сообщение бота")
            return 'ok'

        # ⚠️ Дополнительный фильтр: если from_id отрицательный — это сообщество,
        # то есть сам бот или другой бот. Игнорируем.
        user_id = obj.get('from_id')
        if user_id is None or user_id < 0:
            print(f"[FILTER] Игнорирую сообщение с from_id={user_id}")
            return 'ok'

        payload_str = obj.get('payload') or '{}'
        try:
            payload = json.loads(payload_str)
        except (json.JSONDecodeError, TypeError):
            payload = {}

        # ⚠️ Логируем каждое входящее сообщение — чтобы видеть, что именно приходит
        print(f"[MSG_NEW] from_id={user_id} payload={payload}")

        threading.Thread(
            target=handle_message_new,
            args=(user_id, payload),
            daemon=True
        ).start()

        return 'ok'

    # Любой другой тип события — молча подтверждаем
    print(f"[IGNORED] Тип события: {event_type}")
    return 'ok', 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6467, debug=False, threaded=True)
