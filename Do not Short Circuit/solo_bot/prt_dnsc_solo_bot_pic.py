import logging
import random
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputFile, PhotoSize
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import asyncio
import requests
from io import BytesIO
from PIL import Image

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# Карты и их изображения
cart_dict = {
    1: ("*Прямой Проводник* или *Угловой Проводник*", "bot_image/pryamoy_uglovoy_provodnik.jpg"),
    2: ("*Скрещивающиеся Проводники* или *Проводник с Двумя углами*", "bot_image/skreschivayuschiesya_provodniki.jpg"),
    3: ("*Лампа* или *Геркон*", "bot_image/lampa_gerkon.jpg"),
    4: ("*Светодиод* или *Магнит*", "bot_image/svetodiod_magnit.jpg"),
    5: ("*Резистор*", "bot_image/rezistor.jpg"),
    6: ("*Диод*", "bot_image/diod.jpg")
}

async def resize_photo(photo_path, target_width=390):
    # Функция для уменьшения размера изображения пропорционально по ширине
    try:
        image = Image.open(photo_path)

        # Сохраняем аспектное соотношение
        original_width, original_height = image.size
        ratio = target_width / original_width

        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)

        resized_image = image.resize((new_width, new_height), Image.ANTIALIAS)
        resized_image.save(photo_path)
    except Exception as e:
        logger.error(f"Error resizing image: {e}")

async def play_round(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    round_number = context.user_data.get('round', 1)
    Dice1 = random.randint(1, 6)
    Dice2 = random.randint(1, 6)
    Dice3 = random.randint(1, 6)

    Cart, cart_image_path = cart_dict[Dice3]
    nomer_stolbca_image_path = f"bot_image/Nomer_stolbca_{Dice2}.jpg"

    keyboard = [
        [InlineKeyboardButton("Следующий раунд", callback_data='next_round')],
        [InlineKeyboardButton("Закончить игру", callback_data='end_game')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    if Dice1 in [2, 3, 4, 5]:
        text = f"**Раунд {round_number}**\n" \
               f"\n" \
               f"*Мой ход:*" \
               f"\n" \
               f"Уберите из Столбца {Dice2} игрового поля одну любую карточку {Cart}\. " \
               f"Если в данном столбце нет подходящей карточки, то Автомата в данном раунде ничего не делает\." \
               f"\n" \
               f"\n" \
               f"_После того, как выполните ход за меня \(Автомату\), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД_\. " \
               f"_Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз\._"
    elif Dice1 == 1:
        text = f"*Раунд {round_number}*\n" \
               f"\n" \
               f"*Мой ход:*" \
               f"\n" \
               f"Достаньте из мешка карточку и положите ее на любое место столбца {Dice2} " \
               f"так, чтобы она минимум одной гранью продолжала электрическую цепь\. " \
               f"\n" \
               f"\n" \
               f"Выкладывать карточку нужно даже в том случае, если этим действием вы создаете замкнутую цепь " \
               f"вплоть до короткого замыкания\. " \
               f"\n" \
               f"\n" \
               f"Если при этом вы зажгли лампочки или светодиоды, которые приносят очки, то выложите на эти " \
               f"светящиеся элементы жетоны свечения Автоматы\. Если выложить карточку по правилу невозможно, " \
               f"отправьте ее в сброс\." \
               f"\n" \
               f"\n" \
               f"_После того, как выполните ход за меня \(Автомату\), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД_\. " \
               f"_Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз\._"
    elif Dice1 == 6:
        text = f"*Раунд {round_number}*\n" \
               f"\n" \
               f"*Мой ход:*" \
               f"\n" \
               f"Достаньте из мешка карточку и положите ее на любое место выпавшего столбца {Dice2} по " \
               f"стандартным правилам игры\. Если выложить карточку невозможно, отправьте ее в Сброс\." \
               f"\n" \
               f"\n" \
               f"_После того, как выполните ход за меня \(Автомату\), сделайте свой ход и нажмите кнопку СЛЕДУЮЩИЙ РАУНД_\. " \
               f"_Если при нажатии кнопки, я зависну и не выдам новый ход, нажмите ее еще раз\._"

    await query.message.reply_text("Кидаю кубики для нового раунда...")
    await asyncio.sleep(2)

    # Уменьшаем размер изображений
    await resize_photo(cart_image_path)
    await resize_photo(nomer_stolbca_image_path)

    with open(cart_image_path, 'rb') as cart_photo_file:
        if Dice1 in [2, 3, 4, 5]:
            # Отсылаем первую картинку с подписью
            await query.message.reply_photo(
                photo=InputFile(cart_photo_file),
                caption=text,
                parse_mode="MarkdownV2"
            )
        else:
            # Отсылаем текст и ожидаем отправку второй картинки
            msg = await query.message.reply_text(text, parse_mode="MarkdownV2")

    with open(nomer_stolbca_image_path, 'rb') as nomer_stolbca_photo_file:
        # Отсылаем вторую картинку с подкручивающимися кнопками
        await query.message.reply_photo(
            photo=InputFile(nomer_stolbca_photo_file),
            reply_markup=reply_markup
        )

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [
        [InlineKeyboardButton("Начать игру", callback_data='start_game')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Приветствую тебя игрок. Я Автомата и я буду играть против тебя. Попробуй набрать максимальное число очков за минимальное число раундов.\n\n Но тебе нужно помочь мне выполнять физически ход за меня, так как я всего лишь компьютерный разум и у меня нет рук. Начнем?\n\n Правила соло-режима ты можешь найти <a href='https://disk.yandex.ru/i/18I-YHiivSOrKQ'>по этой ссылке</a>",
                                  reply_markup=reply_markup, parse_mode="html")

async def start_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data['round'] = 1
    await play_round(update, context)

async def next_round(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data['round'] += 1
    await play_round(update, context)

async def end_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    round_number = context.user_data['round']
    await update.callback_query.answer('Игра закончена! Вы прошли ее за {} раунда(ов).'.format(round_number))
    await asyncio.sleep(2)
    await start(update.callback_query, context)

def main() -> None:
    application = Application.builder().token("7456579868:AAF2QIKjkoQ34u4f_c9VUmePewC1Jw26lD0").build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CallbackQueryHandler(start_game, pattern='start_game'))
    application.add_handler(CallbackQueryHandler(next_round, pattern='next_round'))
    application.add_handler(CallbackQueryHandler(end_game, pattern='end_game'))

    application.run_polling()

if __name__ == '__main__':
    main()
