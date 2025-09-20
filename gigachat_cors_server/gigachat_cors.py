from flask import Flask, jsonify, request
import requests
import os
from dotenv import load_dotenv
import uuid
import json

# Загружаем переменные окружения из файла .env
load_dotenv()

app = Flask(__name__)

ALLOWED_ORIGIN = "https://simplrobot.ru"

@app.after_request
def after_request(response):
    # Убираем дублирование - устанавливаем заголовки только если они еще не установлены
    if 'Access-Control-Allow-Origin' not in response.headers:
        response.headers.add('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    if 'Access-Control-Allow-Headers' not in response.headers:
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    if 'Access-Control-Allow-Methods' not in response.headers:
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

# === Эндпоинт 1: Получение токена ===
@app.route('/gigachat_proxy/get-gigachat-token', methods=['GET', 'OPTIONS'])
def handle_gigachat_token():
    if request.method == 'OPTIONS':
        return '', 204  # Декоратор @app.after_request добавит нужные заголовки
    else:
        return get_gigachat_token()

def get_gigachat_token():
    try:
        rq_uid = str(uuid.uuid4())
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": rq_uid,
            "Authorization": f"Basic {GIGACHAT_AUTH_KEY}"
        }
        data = {"scope": "GIGACHAT_API_PERS"}

        response = requests.post(
            "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",  
            headers=headers,
            data=data,
            verify=False
        )

        if response.status_code != 200:
            error_detail = response.text
            print(f"Ошибка от GigaChat API: {response.status_code} - {error_detail}")
            return jsonify({
                "error": "Не удалось получить токен от GigaChat",
                "details": error_detail
            }), response.status_code

        token_data = response.json()
        access_token = token_data.get('access_token')

        if not access_token:
            return jsonify({"error": "В ответе отсутствует access_token"}), 500

        return jsonify({
            "access_token": access_token,
            "expires_at": token_data.get('expires_at')
        }), 200

    except requests.exceptions.SSLError as ssl_err:
        print(f"SSL ошибка: {str(ssl_err)}")
        return jsonify({"error": "SSL ошибка", "details": str(ssl_err)}), 500
    except Exception as e:
        print(f"Внутренняя ошибка: {str(e)}")
        return jsonify({"error": "Внутренняя ошибка сервера", "details": str(e)}), 500

# === Эндпоинт 2: Прокси для chat/completions ===
@app.route('/gigachat_proxy/chat/completions', methods=['POST', 'OPTIONS'])
def proxy_chat_completions():
    if request.method == 'OPTIONS':
        return '', 204  # Декоратор @app.after_request добавит нужные заголовки

    try:
        # Получаем токен
        token_response = get_gigachat_token()
        if isinstance(token_response, tuple):
            status_code = token_response[1]
            if status_code != 200:
                return token_response  # Возвращаем ошибку получения токена
            token_data = json.loads(token_response[0].get_data(as_text=True))
            access_token = token_data.get("access_token")
        else:
            return jsonify({"error": "Неизвестная ошибка получения токена"}), 500

        # Получаем данные от клиента
        client_data = request.get_json()
        if not client_data:
            return jsonify({"error": "Требуется JSON-тело запроса"}), 400

        # Отправляем запрос к GigaChat
        giga_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }

        giga_response = requests.post(
            "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
            headers=giga_headers,
            json=client_data,
            timeout=30
            verify=False
        )

        # Возвращаем ответ клиенту
        return jsonify(giga_response.json() if giga_response.content else {}), giga_response.status_code

    except Exception as e:
        print(f"Ошибка в proxy_chat_completions: {str(e)}")
        return jsonify({"error": "Ошибка прокси", "details": str(e)}), 500

# === Конфигурация ===
GIGACHAT_AUTH_KEY = os.getenv('GIGACHAT_AUTH_KEY')
if not GIGACHAT_AUTH_KEY:
    raise ValueError("Переменная окружения GIGACHAT_AUTH_KEY не установлена!")

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)

