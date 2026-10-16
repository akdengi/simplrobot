# Развертывание на сервере Ubuntu 22.04 (nginx)

Ниже — готовый рецепт. Игра полностью статическая, поэтому на сервере
достаточен nginx, Node/Java/БД не нужны.

## 1. Установка nginx
\`\`\`bash
sudo apt update
sudo apt install -y nginx
\`\`\`

## 2. Копирование файлов
Разложите содержимое папки \`Golems_Puzzles/\` в, например, \`/var/www/golems/\`:
\`\`\`bash
sudo mkdir -p /var/www/golems
sudo cp -r /tmp/Golems_Puzzles/* /var/www/golems/
sudo chown -R www-data:www-data /var/www/golems
sudo chmod -R 755 /var/www/golems
\`\`\`
_(Путь `/tmp/Golems_Puzzles` — пример; используйте ваш локальный путь/архив.)_

## 3. Конфигурация nginx
Создайте файл `/etc/nginx/sites-available/golems`:
\`\`\`nginx
server {
    listen 80;
    server_name golems.yourdomain.ru;   # или ваш домен

    root /var/www;
    index index.html;

    location /golems/ {
        try_files $uri $uri/ =404;
    }

    # Красивые сжатые answer.js и images
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml text/xml;
    gzip_min_length 1024;

    # Кэшируем статику
    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|stl)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
\`\`\`

Включите сайт и перезапустите nginx:
\`\`\`bash
sudo ln -s /etc/nginx/sites-available/golems /etc/nginx/sites-enabled/golems
sudo nginx -t
sudo systemctl reload nginx
\`\`\`

## 4. HTTPS (опционально, рекомендуется)
\`\`\`bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d golems.yourdomain.ru
\`\`\`

## 5. Проверка
- Открыть \`https://golems.yourdomain.ru/golems/\`
- DevTools (F12 → Network): все запросы `200 OK` (особенно `lib/three.min.js`, `js/data/levels.js`, `stl/*`, `cards/*`).
- Консоль без ошибок `404` / `CORS` / `THREE`.
- Прогресс сохраняется в `localStorage` браузера, поэтому данные не теряются при обновлении страницы, но бэкенда они не касаются.

## 6. Если ошибка загрузок
- **404 на `stl/...` или `cards/...`**: убедитесь, что папки реально находятся в `/var/www/golems/stl` и `.../cards`; имена файлов чувствительны к регистру и пробелам (например, «Barell New Low 2.stl», «Вперед Красный.png»).
- **Пустой вид на `file://`**: открывайте обязательно по `http(s)://`, иначе XHR к STL блокируется CORS. 
- **WebGL не работает на сервере**: почти всегда проблема браузера пользователя (нужен современный браузер с поддержкой WebGL), а не сервера.

## 7. Обновление игры
Перезаписать файлы в `/var/www/golems` и сделать `sudo systemctl reload nginx`. Кэши должны подхватить изменения.
> Важно: после изменения статики у пользователей обычно хватает жёсткого обновления (Ctrl+F5), чтобы убрать старый кэш картинок.
`