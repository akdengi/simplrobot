import logging
import random
import asyncio
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputFile
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from io import BytesIO
from PIL import Image

# === Настройки ===
TELEGRAM_BOT_TOKEN = "7456579868:AAF2QIKjkoQ34u4f_c9VUmePewC1Jw26lD0"
IMAGE_BASE_URL = "https://22176.hostkey.in:34172/pictures/bot_image/"

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# === База данных карт (теперь с URL) ===
cart_dict = {
    1: ("*Прямой Проводник* или *Угловой Проводник*", "pryamoy_uglovoy_provodnik.jpg"),
    2: ("*Скрещивающиеся Проводники* или *Проводник с Двумя углами*", "skreschivayuschiesya_provodniki.jpg"),
    3: ("*Лампа* или *Геркон*", "lampa_gerkon.jpg"),
    4: ("*Светодиод* или *Магнит*", "svetodiod_magnit.jpg"),
    5: ("*Резистор*", "rezistor.jpg"),
    6: ("*Диод*", "diod.jpg")
}

# === Функция загрузки и изменения размера изображения из интернета ===
async def resize_photo_from_url(image_url, target_width=390):
    try:
        # Скачивание изображения
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()

        image = Image.open(BytesIO(response.content))
        original_width, original_height = image.size
        ratio = target_width / original_width
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)

        resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        bio = BytesIO()
        bio.name = "image.jpg"
        resized_image.save(bio, format="JPEG")
        bio.seek(0)
        return bio
    except Exception as e:
        logger.error(f"Ошибка при загрузке или изменении размера изображения {image_url}: {e}")
        return None

# === Функция для экранирования только опасных символов в MarkdownV2 ===
def escape_markdown_v2(text):
    """Экранирует только те символы, которые могут вызвать ошибку в MarkdownV2"""
    # Символы, которые нужно экранировать (кроме тех, что используются для форматирования)
    chars_to_escape = ['.', '!', '(', ')', '-', '+']
    for char in chars_to_escape:
        # Заменяем символ на экранированную версию, только если он не часть форматирования
        # Это простая реализация - в реальных условиях может потребоваться более сложный парсинг
        text = text.replace(char, '\\' + char)
    return text

# === Обработка раунда ===
async def play_round(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    round_number = context.user_data.get('round', 1)
    Dice1 = random.randint(1, 6)
    Dice2 = random.randint(1, 6)
    Dice3 = random.randint(1, 6)

    Cart, cart_image_filename = cart_dict[Dice3]
    cart_image_url = IMAGE_BASE_URL + cart_image_filename
    nomer_stolbca_image_url = f"{IMAGE_BASE_URL}Nomer_stolbca_{Dice2}.jpg"

    keyboard = [
        [InlineKeyboardButton("Следующий раунд", callback_data='next_round')],
        [InlineKeyboardButton("Закончить игру", callback_data='end_game')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    if Dice1 in [2, 3, 4, 5]:
        text = (
            f"**Раунд {round_number}**\n\n"
            f"*Мой ход:*\n\n"
            f"Уберите из Столбца {Dice2} игрового поля одну любую карточку {Cart}. "
            f"Если в данном столбце нет подходящей карточки, то Автомата в данном раунде ничего не делает.\n\n"
            f"_После того, как выполните ход за меня (Автомату), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД_. "
            f"_Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз._"
        )
    elif Dice1 == 1:
        text = (
            f"**Раунд {round_number}**\n\n"
            f"*Мой ход:*\n\n"
            f"Достаньте из мешка карточку и положите ее на любое место столбца {Dice2} "
            f"так, чтобы она минимум одной гранью продолжала электрическую цепь.\n\n"
            f"Выкладывать карточку нужно даже в том случае, если этим действием вы создаете замкнутую цепь "
            f"вплоть до короткого замыкания.\n\n"
            f"Если при этом вы зажгли лампочки или светодиоды, которые приносят очки, то выложите на эти "
            f"светящиеся элементы жетоны свечения Автоматы. Если выложить карточку по правилу невозможно, "
            f"отправьте ее в сброс.\n\n"
            f"_После того, как выполните ход за меня (Автомату), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД_. "
            f"_Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз._"
        )
    elif Dice1 == 6:
        text = (
            f"**Раунд {round_number}**\n\n"
            f"*Мой ход:*\n\n"
            f"Достаньте из мешка карточку и положите ее на любое место выпавшего столбца {Dice2} по "
            f"стандартным правилам игры. Если выложить карточку невозможно, отправьте ее в Сброс.\n\n"
            f"_После того, как выполните ход за меня (Автомату), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД_. "
            f"_Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз._"
        )

    # Экранируем только опасные символы
    escaped_text = escape_markdown_v2(text)

    await query.message.reply_text("Кидаю кубики для нового раунда...")
    await asyncio.sleep(2)

    # Загрузка и обработка изображений
    cart_bio = await resize_photo_from_url(cart_image_url)
    nomer_bio = await resize_photo_from_url(nomer_stolbca_image_url)

    if cart_bio is None or nomer_bio is None:
        await query.message.reply_text("❌ Ошибка загрузки изображений. Проверьте соединение или URL.")
        return

    # Отправка первой картинки или текста
    if Dice1 in [2, 3, 4, 5]:
        await query.message.reply_photo(
            photo=InputFile(cart_bio),
            caption=escaped_text,
            parse_mode="MarkdownV2"
        )
    else:
        await query.message.reply_text(escaped_text, parse_mode="MarkdownV2")

    # Отправка второй картинки с кнопками
    await query.message.reply_photo(
        photo=InputFile(nomer_bio),
        reply_markup=reply_markup
    )

    # Закрытие буферов
    cart_bio.close()
    nomer_bio.close()


# === Команда /start ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [
        [InlineKeyboardButton("Начать игру", callback_data='start_game')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    text = (
        "Приветствую тебя, игрок. Я — Автомата, и я буду играть против тебя. "
        "Попробуй набрать максимальное число очков за минимальное число раундов.\n\n"
        "Но тебе нужно помочь мне выполнять ходы физически, так как у меня нет рук. Начнём?\n\n"
        "📖 Правила соло-режима можно найти по ссылке: "
        "[Правила игры](https://disk.yandex.ru/i/18I-YHiivSOrKQ)"
    )
    
    # Экранируем только опасные символы
    escaped_text = escape_markdown_v2(text)

    if update.message:
        await update.message.reply_text(escaped_text, reply_markup=reply_markup, parse_mode="MarkdownV2", disable_web_page_preview=False)
    else:
        await update.callback_query.message.reply_text(escaped_text, reply_markup=reply_markup, parse_mode="MarkdownV2", disable_web_page_preview=False)


# === Обработка начала игры ===
async def start_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data['round'] = 1
    await play_round(update, context)


# === Следующий раунд ===
async def next_round(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data['round'] += 1
    await play_round(update, context)


# === Завершение игры ===
async def end_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    round_number = context.user_data.get('round', 1)
    
    # Формируем текст с форматированием
    end_text = f"🎮 Игра закончена!\n\nВы прошли её за **{round_number}** раунда(ов)."
    # Экранируем только опасные символы
    escaped_end_text = escape_markdown_v2(end_text)
    
    # Отправляем сообщение как новое, а не редактируем старое
    await query.message.reply_text(escaped_end_text, parse_mode="MarkdownV2")

    await asyncio.sleep(2)

    # Предложение начать заново
    keyboard = [[InlineKeyboardButton("Начать игру", callback_data='start_game')]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    restart_text = "Хочешь сыграть ещё раз?"
    # Экранируем только опасные символы
    escaped_restart_text = escape_markdown_v2(restart_text)
    await query.message.reply_text(escaped_restart_text, reply_markup=reply_markup, parse_mode="MarkdownV2")


# === Запуск бота ===
def main() -> None:
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CallbackQueryHandler(start_game, pattern='start_game'))
    application.add_handler(CallbackQueryHandler(next_round, pattern='next_round'))
    application.add_handler(CallbackQueryHandler(end_game, pattern='end_game'))

    logger.info("Бот запущен и готов к работе.")
    application.run_polling()


if __name__ == '__main__':
    main()
