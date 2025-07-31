# локация бота в <host>/vk_solo_bot через nginx

import vk_api
import random
import requests
from vk_api import VkUpload
from vk_api.keyboard import VkKeyboard, VkKeyboardColor
from io import BytesIO
from PIL import Image
import json
import hashlib
import asyncio
import aiohttp
from flask import Flask, request, jsonify

# === Настройки ===
VK_TOKEN = "ВАШ_ТОКЕН_СООБЩЕСТВА"
VK_SECRET = "ВАШ_SECRET_КЛЮЧ_ДЛЯ_CALLBACK_API"  # Устанавливается в настройках Callback API
VK_CONFIRMATION_TOKEN = "СТРОКА_ПОДТВЕРЖДЕНИЯ"  # Устанавливается в настройках Callback API
IMAGE_BASE_URL = "https://22176.hostkey.in:34172/pictures/solo_bot_image/"

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

# Хранилище состояний пользователей (в реальном приложении используйте БД)
user_states = {}

# === Функция загрузки и изменения размера изображения ===
def resize_photo_force_size(image_url, target_width=800, target_height=450):
    try:
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))

        # Конвертируем в RGB, если нужно (например, для PNG с прозрачностью)
        if image.mode in ('RGBA', 'P'):
            # Создаем белый фон
            bg = Image.new('RGB', image.size, (255, 255, 255))
            # Вставляем исходное изображение, используя альфа-канал как маску (если есть)
            if image.mode == 'RGBA':
                bg.paste(image, mask=image.split()[-1]) # Используем альфа-канал
            else:
                 # Для режима 'P' (палитра) конвертируем сначала в RGBA, чтобы получить маску
                 image_rgba = image.convert('RGBA')
                 bg.paste(image_rgba, mask=image_rgba.split()[-1])
            image = bg # Теперь image - это RGB изображение с белым фоном

        # Получаем исходные размеры
        original_width, original_height = image.size

        # Вычисляем новый размер, сохраняя пропорции по ширине
        # Новая ширина = target_width
        # Новая высота = original_height * (target_width / original_width)
        new_height = int(original_height * (target_width / original_width))
        
        # Изменяем размер изображения с сохранением пропорций
        resized_image = image.resize((target_width, new_height), Image.Resampling.LANCZOS)

        # Создаем новое изображение с целевыми размерами и белым фоном
        final_image = Image.new('RGB', (target_width, target_height), (255, 255, 255))

        if new_height < target_height:
            # Если новая высота меньше целевой, центрируем по вертикали
            paste_y = (target_height - new_height) // 2
            final_image.paste(resized_image, (0, paste_y))
        elif new_height > target_height:
            # Если новая высота больше целевой, обрезаем сверху и снизу
            crop_y = (new_height - target_height) // 2
            # Обрезаем resized_image по вертикали
            cropped_resized = resized_image.crop((0, crop_y, target_width, crop_y + target_height))
            # Вставляем обрезанное изображение в центр final_image (по высоте)
            # Поскольку высоты теперь совпадают, вставляем в (0, 0)
            final_image.paste(cropped_resized, (0, 0))
        else:
            # Если высота совпала идеально, просто вставляем
             final_image.paste(resized_image, (0, 0))

        # Сохраняем результат в байтовый поток
        bio = BytesIO()
        bio.name = "image.jpg"
        # Используем высокое качество JPEG
        final_image.save(bio, format="JPEG", quality=95, optimize=True)
        bio.seek(0)
        return bio

    except Exception as e:
        print(f"Ошибка при загрузке или изменении размера изображения {image_url}: {e}")
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
#            'message': escaped_message,
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
    # Явно удаляем старое состояние, если оно есть
    if user_id in user_states:
        del user_states[user_id]
    # Создаём новое начальное состояние
    user_states[user_id] = {'round': 1}
    play_round(user_id)

# === Игровой раунд ===
def play_round(user_id):
    state = user_states.get(user_id, {'round': 1})
    round_number = state['round']
    Dice1 = random.randint(1, 6)
    Dice2 = random.randint(1, 6)
    Dice3 = random.randint(1, 6)

    Cart, cart_image_filename = cart_dict[Dice3]
    cart_image_url = IMAGE_BASE_URL + cart_image_filename
    nomer_stolbca_image_url = f"{IMAGE_BASE_URL}Nomer_stolbca_{Dice2}.jpg"

# Создание inline-клавиатуры для callback-кнопок
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
    elif Dice1 == 6:
        text = (
            f"Раунд {round_number}\n\n"
            f"Мой ход:\n\n"
            f"Достаньте из мешка карточку и положите ее на любое место выпавшего столбца {Dice2} по "
            f"стандартным правилам игры. Если выложить карточку невозможно, отправьте ее в Сброс.\n\n"
            f"После того, как выполните ход за меня (Автомату), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД. "
            f"Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз."
        )

    send_message(user_id, "🎲 Кидаю кубики для нового раунда...")
    
    # Отправка первой картинки или текста
    if Dice1 in [2, 3, 4, 5]:
        cart_attachment = upload_image_to_vk(cart_image_url)
        send_message(user_id, text, attachment=cart_attachment)
    else:
        send_message(user_id, text)

    # Загрузка и отправка второй картинки
    nomer_attachment = upload_image_to_vk(nomer_stolbca_image_url)
    send_message(user_id, "", keyboard=keyboard, attachment=nomer_attachment)

# === Следующий раунд ===
def next_round(user_id):
    if user_id not in user_states:
        user_states[user_id] = {'round': 1}
    user_states[user_id]['round'] += 1
    play_round(user_id)

# === Завершение игры ===
def end_game(user_id):
    round_number = user_states.get(user_id, {}).get('round', 1)
    send_message(user_id, f"🎮 Игра закончена!\nВы прошли её за {round_number} раунда(ов).")
    send_message(user_id, f"⚠️ Обнуляю состояние игрового раунда и перезапускаюсь!")

    send_welcome(user_id)

    # Инлайн-клавиатура с кнопкой "Начать игру"
    # keyboard = VkKeyboard(inline=True)
    #keyboard.add_callback_button('Начать игру', payload={'action': 'start_game'})
    #
    # send_message(user_id, "Хочешь сыграть ещё раз? Нажми на кнопку!", keyboard=keyboard)

# === Приветствие игрока ===
def send_welcome(user_id):
    text = (
        "Приветствую тебя, игрок. Я — Автомата, и я буду играть против тебя. "
        "Попробуй набрать максимальное число очков за минимальное число раундов.\n\n"
        "Но тебе нужно помочь мне выполнять ходы физически, так как у меня нет рук. "
        "Начнём?\n\n"
        "📖 Правила соло-режима можно найти по ссылке: https://disk.yandex.ru/i/18I-YHiivSOrKQ"
    )
    # Создаём инлайн-клавиатуру
    keyboard = VkKeyboard(inline=True)
    keyboard.add_callback_button('Начать игру', payload={'action': 'start_game'})
    
    send_message(user_id, text, keyboard=keyboard)

# === Обработка событий Callback API ===
@app.route('/', methods=['POST'])
def callback():
    data = request.get_json()
    
    # Если это не VK-запрос
    if 'type' not in data:
        return 'not vk', 200

    # Проверка секрета
    if VK_SECRET:
        if 'secret' not in data or data['secret'] != VK_SECRET:
            return 'bad secret', 403

    # Подтверждение сервера
    if data['type'] == 'confirmation':
        return VK_CONFIRMATION_TOKEN, 200

    # Обработка callback-событий
    elif data['type'] == 'message_event':
        event_data = data['object']
        user_id = event_data['user_id']
        event_id = event_data['event_id']
        peer_id = event_data['peer_id']
        payload = event_data.get('payload', {})
        action = payload.get('action')

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

            # Подтверждение обработки события
            vk_session.method('messages.sendMessageEventAnswer', {
                'event_id': event_id,
                'user_id': user_id,
                'peer_id': peer_id,
            })
        except Exception as e:
            print(f"Ошибка при обработке message_event: {e}")
            try:
                vk_session.method('messages.sendMessageEventAnswer', {
                    'event_id': event_id,
                    'user_id': user_id,
                    'peer_id': peer_id,
                })
            except:
                pass
        return 'ok'

    # Обработка новых сообщений
    elif data['type'] == 'message_new':
        obj = data['object']['message']
        user_id = obj['from_id']
        payload_str = obj.get('payload', '{}')
        try:
            payload = json.loads(payload_str)
            action = payload.get('action')
            if action == 'start_game':
                start_game(user_id)
            elif action == 'next_round':
                next_round(user_id)
            elif action == 'end_game':
                end_game(user_id)
            else:
                # Если пользователь не в игре — отправить приветствие с кнопкой
                if user_id not in user_states:
                    send_welcome(user_id)
                else:
                    send_message(user_id, "Используйте кнопки под сообщением.")
        except json.JSONDecodeError:
            # Если payload не JSON — значит, обычное текстовое сообщение
            if user_id not in user_states:
                send_welcome(user_id)
            else:
                send_message(user_id, "Пожалуйста, используйте кнопки.")
        return 'ok'

    # ⚠️ ЛЮБОЙ ДРУГОЙ ТИП СОБЫТИЯ
    else:
        print(f"Неизвестный тип события: {data['type']}")
        return 'ok', 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6467, debug=False)
