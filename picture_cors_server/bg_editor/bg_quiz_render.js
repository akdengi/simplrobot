(function() {
    // Создаем элемент style и добавляем CSS
    const style = document.createElement('style');
    style.textContent = `
    /* Основные стили canvas */
    canvas {
        image-rendering: -moz-crisp-edges;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
        -ms-interpolation-mode: nearest-neighbor;
    }

    /* Стили для контейнеров */
    .game-container {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .scale-container {
        position: relative;
        margin: 0 auto;
        cursor: pointer;
        transition: transform 0.2s;
    }

    .layers-container {
        position: relative;
        width: 100%;
        height: 100%;
    }

    /* Стили для панели головоломок */
    .puzzle-panel {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
        order: -1; /* Помещаем панель перед игровым полем */
    }

    .puzzle-icon {
        width: 40px;
        height: 40px;
        object-fit: contain;
        border: 2px solid #ccc;
        border-radius: 5px;
        padding: 2px;
        background-color: white;
    }

    /* Стили для оверлея */
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.9);
        z-index: 1000;
        overflow: hidden;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .overlay.mobile {
        align-items: flex-start;
        padding-top: 60px;
        -webkit-overflow-scrolling: touch;
    }

    .close-btn {
        position: fixed;
        top: 15px;
        right: 15px;
        color: white;
        font-size: 24px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1001;
        text-shadow: 0 0 5px black;
        background-color: rgba(0,0,0,0.5);
        border-radius: 50%;
    }

    .zoom-container {
        position: relative;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        transform: translateZ(0);
    }

    .zoom-container.mobile {
        margin: 20px;
        width: calc(100% - 40px);
        box-sizing: border-box;
    }

    .zoom-canvas {
        image-rendering: pixelated;
        transform: translateZ(0);
    }

    .mobile-canvas {
        display: block;
        margin: 0 auto;
        touch-action: pan-x pan-y;
    }

    .scroll-container {
        width: 100%;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        max-height: calc(100vh - 120px);
    }
    `;
    document.head.appendChild(style);

    // Конфигурация изображений
    const IMAGE_BASE_URL = 'https://22176.hostkey.in:34172/pictures/bg_editor/';
    const TOKEN_IMAGES = {
        'ВП': 'water.png', 'ПВ': 'portal.png', 'ВК': 'water.png', 'КВ': 'stone.png',
        'Л': 'ice.png', 'Б': 'barell.png', 'Ц': 'goal.png', 'К↑': 'red_up.png',
        'К1': 'red_up.png', 'C↑': 'blue_up.png', 'C1': 'blue_up.png', 'З↑': 'green_up.png',
        'З1': 'green_up.png', 'Ж↑': 'yellow_up.png', 'Ж1': 'yellow_up.png',
        'ПЛ': 'line_straight.png', 'УЛ': 'line_corner.png', 'ВУТ': 'duck.png', 'ПРЖ': 'spring.png'
    };
    const FIELD_IMAGES = {
        "4x4": ["pole_4x4.png", "pole_4x4_alt.png"],
        "2x4_1": ["pole_2x4_1.png", "pole_2x4_1_alt.png"],
        "2x4_2": ["pole_2x4_2.png", "pole_2x4_2_alt.png"],
        "4x2_1": ["pole_4x2_1.png", "pole_4x2_1_alt.png"],
        "4x2_2": ["pole_4x2_2.png", "pole_4x2_2_alt.png"]
    };
    const PUZZLE_ICONS = {
        'lvl1': 'lvl1.png', 'lvl2': 'lvl2.png', 'lvl3': 'lvl3.png', 'lvl4': 'lvl4.png',
        'lvl5': 'lvl5.png', 'repeat2': 'repeat2.png', 'condition': 'condition.png',
        'attack': 'attack.png', 'defense': 'defense.png', 'bot1': 'bot1.png', 'bot2': 'bot2.png',
        'line1': 'line1.png', 'line2': 'line2.png', 'line3': 'line3.png', 'line4': 'line4.png',
        'line5': 'line5.png', 'line6': 'line6.png', 'lineN': 'lineN.png'
    };

    // Кэш для изображений
    const imageCache = {};

    // Функция для загрузки изображения с кэшированием
    function loadImage(url) {
        if (imageCache[url]) {
            return imageCache[url];
        }
        
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.error('Failed to load image:', url);
                reject(new Error(`Failed to load image: ${url}`));
            };
            img.src = url;
        });
        
        imageCache[url] = promise;
        return promise;
    }

    // Предварительная загрузка всех изображений
    async function preloadImages() {
        const allImages = [];
        
        Object.values(FIELD_IMAGES).forEach(variants => {
            variants.forEach(img => allImages.push(IMAGE_BASE_URL + img));
        });
        
        Object.values(TOKEN_IMAGES).forEach(img => {
            allImages.push(IMAGE_BASE_URL + img);
        });
        
        Object.values(PUZZLE_ICONS).forEach(img => {
            allImages.push(IMAGE_BASE_URL + img);
        });
        
        const uniqueImages = [...new Set(allImages)];
        await Promise.all(uniqueImages.map(url => 
            loadImage(url).catch(e => console.error('Preload error:', url, e))
        ));
    }

    // Основная функция рендеринга - теперь ищет JSON в любых элементах
    function findAndRenderJSON() {
        // Ищем все текстовые узлы на странице
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim().startsWith('{') && node.nodeValue.trim().endsWith('}')) {
                textNodes.push(node);
            }
        }

        // Обрабатываем найденные JSON
        textNodes.forEach(textNode => {
            try {
                const jsonData = JSON.parse(textNode.nodeValue.trim());
                if (jsonData.grid) {
                    // Создаем контейнер для замены текстового узла
                    const container = document.createElement('div');
                    container.className = 'json-game-container';
                    
                    // Заменяем текстовый узел на наш контейнер
                    textNode.parentNode.replaceChild(container, textNode);
                    
                    // Рендерим игру в контейнер
                    renderGameContainer(jsonData, container);
                }
            } catch (e) {
                console.error('JSON parse error:', e);
            }
        });
    }

    // Создание canvas для слоя
    function createLayerCanvas(bounds, cellSize) {
        const canvas = document.createElement('canvas');
        canvas.width = bounds.width * cellSize;
        canvas.height = bounds.height * cellSize;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        return canvas;
    }

    // Создание контейнера для рендеринга
    async function renderGameContainer(jsonData, container) {
        const {bounds, cellSize} = calculateFieldSize(jsonData, container.offsetWidth || window.innerWidth);
        
        // Создаем основной контейнер
        const gameContainer = document.createElement('div');
        gameContainer.className = 'game-container';
        
        // Панель головоломок (добавляем первой)
        let puzzlePanelContainer = null;
        if (jsonData.editorMode === 'puzzle' && jsonData.puzzleIcons) {
            puzzlePanelContainer = document.createElement('div');
            const puzzlePanel = await renderPuzzlePanel(jsonData.puzzleIcons, cellSize * 0.5);
            puzzlePanelContainer.appendChild(puzzlePanel);
            gameContainer.appendChild(puzzlePanelContainer);
        }
        
        // Контейнер для масштабирования
        const scaleContainer = document.createElement('div');
        scaleContainer.className = 'scale-container';
        scaleContainer.style.width = `${bounds.width * cellSize}px`;
        scaleContainer.style.height = `${bounds.height * cellSize}px`;
        
        // Контейнер для слоев
        const layersContainer = document.createElement('div');
        layersContainer.className = 'layers-container';
        
        // Создаем canvas для каждого слоя
        const layer0 = createLayerCanvas(bounds, cellSize);
        const layer1 = createLayerCanvas(bounds, cellSize);
        const layer2 = createLayerCanvas(bounds, cellSize);
        const layer3 = createLayerCanvas(bounds, cellSize);
        
        layersContainer.appendChild(layer0);
        layersContainer.appendChild(layer1);
        layersContainer.appendChild(layer2);
        layersContainer.appendChild(layer3);
        
        // Рендерим сетку
        const gridCanvas = createLayerCanvas(bounds, cellSize);
        renderGridLayer(gridCanvas.getContext('2d'), bounds, cellSize);
        layersContainer.appendChild(gridCanvas);
        
        scaleContainer.appendChild(layersContainer);
        gameContainer.appendChild(scaleContainer);
        container.appendChild(gameContainer);

        // Рендерим слои
        await renderBackgroundLayer(layer0.getContext('2d'), jsonData, bounds, cellSize);
        await renderTokenLayer(layer1.getContext('2d'), jsonData, bounds, cellSize, 0);
        await renderTokenLayer(layer2.getContext('2d'), jsonData, bounds, cellSize, 1);
        await renderTokenLayer(layer3.getContext('2d'), jsonData, bounds, cellSize, 2);

        // Обработчик клика для увеличения/уменьшения
        let isZoomed = false;
        let overlay = null;
        
        scaleContainer.addEventListener('click', async function() {
            if (isZoomed) {
                document.body.removeChild(overlay);
                isZoomed = false;
                overlay = null;
                return;
            }

            const originalWidth = bounds.width * cellSize;
            const originalHeight = bounds.height * cellSize;
            const isMobile = window.innerWidth <= 768;
            
            // Создаем оверлей
            overlay = document.createElement('div');
            overlay.className = 'overlay' + (isMobile ? ' mobile' : '');
            
            // Кнопка закрытия
            const closeBtn = document.createElement('div');
            closeBtn.className = 'close-btn';
            closeBtn.innerHTML = '&times;';

            // Основной контейнер
            const zoomContainer = document.createElement('div');
            zoomContainer.className = 'zoom-container' + (isMobile ? ' mobile' : '');

            if (isMobile) {
                const scale = 1.5; // Фиксированный масштаб для мобильных
                const canvasWidth = originalWidth * scale;
                const canvasHeight = originalHeight * scale;

                // Создаем контейнер для прокрутки
                const scrollContainer = document.createElement('div');
                scrollContainer.className = 'scroll-container';
                
                const zoomCanvas = document.createElement('canvas');
                zoomCanvas.className = 'zoom-canvas mobile-canvas';
                zoomCanvas.width = canvasWidth;
                zoomCanvas.height = canvasHeight;
                zoomCanvas.style.width = `${canvasWidth}px`;
                zoomCanvas.style.height = `${canvasHeight}px`;

                // Рендеринг
                const ctx = zoomCanvas.getContext('2d');
                ctx.scale(scale, scale);
                await renderBackgroundLayer(ctx, jsonData, bounds, cellSize);
                await renderTokenLayer(ctx, jsonData, bounds, cellSize, 0);
                await renderTokenLayer(ctx, jsonData, bounds, cellSize, 1);
                await renderTokenLayer(ctx, jsonData, bounds, cellSize, 2);
                renderGridLayer(ctx, bounds, cellSize);

                scrollContainer.appendChild(zoomCanvas);
                zoomContainer.appendChild(scrollContainer);

                // Центрируем после отрисовки
                setTimeout(() => {
                    const scrollWidth = scrollContainer.scrollWidth;
                    const clientWidth = scrollContainer.clientWidth;
                    scrollContainer.scrollLeft = (scrollWidth - clientWidth) / 2;
                }, 50);
            } else {
                // Десктопная версия
                const maxWidth = window.innerWidth * 0.8;
                const maxHeight = window.innerHeight * 0.8;
                const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
                const displayWidth = originalWidth * scale;
                const displayHeight = originalHeight * scale;

                const zoomCanvas = document.createElement('canvas');
                zoomCanvas.className = 'zoom-canvas';
                zoomCanvas.width = originalWidth;
                zoomCanvas.height = originalHeight;
                zoomCanvas.style.width = `${displayWidth}px`;
                zoomCanvas.style.height = `${displayHeight}px`;

                const ctx = zoomCanvas.getContext('2d');
                await renderBackgroundLayer(ctx, jsonData, bounds, cellSize);
                await renderTokenLayer(ctx, jsonData, bounds, cellSize, 0);
                await renderTokenLayer(ctx, jsonData, bounds, cellSize, 1);
                await renderTokenLayer(ctx, jsonData, bounds, cellSize, 2);
                renderGridLayer(ctx, bounds, cellSize);

                zoomContainer.appendChild(zoomCanvas);
            }

            // Панель головоломок
            if (puzzlePanelContainer && jsonData.puzzleIcons) {
                const puzzlePanel = await renderPuzzlePanel(
                    jsonData.puzzleIcons, 
                    cellSize * 0.5 * (isMobile ? 1 : 1)
                );
                puzzlePanel.style.backgroundColor = 'rgba(255,255,255,0.9)';
                puzzlePanel.style.padding = '10px';
                puzzlePanel.style.borderRadius = '5px';
                puzzlePanel.style.marginBottom = '15px';
                puzzlePanel.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                zoomContainer.insertBefore(puzzlePanel, zoomContainer.firstChild);
            }

            overlay.appendChild(zoomContainer);
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);
            isZoomed = true;

            // Закрытие оверлея
            function closeOverlay() {
                document.body.removeChild(overlay);
                isZoomed = false;
                overlay = null;
            }

            overlay.addEventListener('click', function(e) {
                if (e.target === overlay || e.target === closeBtn) {
                    closeOverlay();
                }
            });
        });
    }

    // Рендерим сетку
    function renderGridLayer(ctx, bounds, cellSize) {
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 1;
        
        // Вертикальные линии
        for (let x = 0; x <= bounds.width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, bounds.height * cellSize);
            ctx.stroke();
        }
        
        // Горизонтальные линии
        for (let y = 0; y <= bounds.height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(bounds.width * cellSize, y * cellSize);
            ctx.stroke();
        }
    }

    // Расчет размеров поля
    function calculateFieldSize(jsonData, containerWidth) {
        let minRow = 9, maxRow = 0, minCol = 9, maxCol = 0;
        let hasContent = false;

        // Проверяем токены
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                if (jsonData.grid[row][col].some(layer => layer !== '')) {
                    hasContent = true;
                    minRow = Math.min(minRow, row);
                    maxRow = Math.max(maxRow, row);
                    minCol = Math.min(minCol, col);
                    maxCol = Math.max(maxCol, col);
                }
            }
        }

        // Проверяем фоновые поля
        if (jsonData.checkboxes) {
            Object.entries(jsonData.checkboxes).forEach(([field, checked]) => {
                if (checked) {
                    hasContent = true;
                    const pos = jsonData.userFieldPositions?.[field] || getDefaultFieldPosition(field);
                    const size = getFieldSize(field);
                    minRow = Math.min(minRow, pos.row);
                    maxRow = Math.max(maxRow, pos.row + size.height - 1);
                    minCol = Math.min(minCol, pos.col);
                    maxCol = Math.max(maxCol, pos.col + size.width - 1);
                }
            });
        }

        // Если поле пустое, показываем центральную область
        if (!hasContent) {
            minRow = 3; maxRow = 6;
            minCol = 3; maxCol = 6;
        }

        // Рассчитываем размеры поля в клетках
        const widthInCells = maxCol - minCol + 1;
        const heightInCells = maxRow - minRow + 1;

        // Рассчитываем оптимальный размер клетки (максимум 150px)
        const availableWidth = containerWidth - 40;
        const cellSize = Math.min(150, Math.max(30, Math.floor(availableWidth / widthInCells)));

        return {
            bounds: {
                minRow, maxRow, minCol, maxCol,
                width: widthInCells,
                height: heightInCells
            },
            cellSize
        };
    }

    // Позиции полей по умолчанию
    function getDefaultFieldPosition(field) {
        const positions = {
            "4x4": {row: 0, col: 3},
            "2x4_1": {row: 0, col: 0},
            "2x4_2": {row: 0, col: 8},
            "4x2_1": {row: 0, col: 0},
            "4x2_2": {row: 0, col: 6}
        };
        return positions[field] || {row: 0, col: 0};
    }

    // Размеры полей
    function getFieldSize(field) {
        const sizes = {
            "4x4": {width: 4, height: 4},
            "2x4_1": {width: 2, height: 4},
            "2x4_2": {width: 2, height: 4},
            "4x2_1": {width: 4, height: 2},
            "4x2_2": {width: 4, height: 2}
        };
        return sizes[field] || {width: 1, height: 1};
    }

    // Рендеринг фонового слоя (поля)
    async function renderBackgroundLayer(ctx, jsonData, bounds, cellSize) {
        const {minRow, minCol} = bounds;
        
        if (!jsonData.checkboxes) return;

        const renderPromises = [];
        
        Object.entries(jsonData.checkboxes).forEach(([field, checked]) => {
            if (checked) {
                const pos = jsonData.userFieldPositions?.[field] || getDefaultFieldPosition(field);
                const size = getFieldSize(field);
                
                // Проверяем, попадает ли поле в видимую область
                if (pos.row + size.height <= minRow || pos.row >= minRow + bounds.height ||
                    pos.col + size.width <= minCol || pos.col >= minCol + bounds.width) {
                    return;
                }

                const imageIndex = jsonData.fieldImageIndices?.[field] || 0;
                const imageUrl = IMAGE_BASE_URL + FIELD_IMAGES[field][imageIndex];
                
                renderPromises.push(
                    loadImage(imageUrl).then(img => {
                        ctx.drawImage(
                            img,
                            (pos.col - minCol) * cellSize,
                            (pos.row - minRow) * cellSize,
                            size.width * cellSize,
                            size.height * cellSize
                        );
                    }).catch(e => {
                        console.error('Error rendering background:', field, e);
                    })
                );
            }
        });
        
        await Promise.all(renderPromises);
    }

    // Рендеринг слоя с токенами
    async function renderTokenLayer(ctx, jsonData, bounds, cellSize, layerIndex) {
        const {minRow, minCol} = bounds;
        const renderPromises = [];
        
        for (let row = minRow; row <= minRow + bounds.height - 1; row++) {
            for (let col = minCol; col <= minCol + bounds.width - 1; col++) {
                const tokenName = jsonData.grid[row][col][layerIndex];
                if (tokenName) {
                    const imageUrl = IMAGE_BASE_URL + TOKEN_IMAGES[tokenName];
                    
                    renderPromises.push(
                        loadImage(imageUrl).then(img => {
                            // Позиция токена
                            const x = (col - minCol + 0.5) * cellSize;
                            const y = (row - minRow + 0.5) * cellSize;
                            
                            // Поворот
                            const rotationKey = `rotation_${row}_${col}_${tokenName}_layer${layerIndex+1}`;
                            const rotation = jsonData.rotations?.[rotationKey] || 0;
                            
                            // Размер токена (80% от размера ячейки)
                            const size = cellSize * 0.8;
                            
                            // Сохраняем текущее состояние canvas
                            ctx.save();
                            
                            // Перемещаем начало координат в центр токена
                            ctx.translate(x, y);
                            
                            // Применяем поворот
                            if (rotation) {
                                ctx.rotate(rotation * Math.PI / 180);
                            }
                            
                            // Рисуем изображение
                            ctx.drawImage(
                                img,
                                -size/2, -size/2,
                                size, size
                            );
                            
                            // Восстанавливаем состояние canvas
                            ctx.restore();
                        }).catch(e => {
                            console.error('Error rendering token:', tokenName, e);
                        })
                    );
                }
            }
        }
        
        await Promise.all(renderPromises);
    }

    // Рендерим панель головоломок
    async function renderPuzzlePanel(puzzleIcons, iconSize) {
        const panel = document.createElement('div');
        panel.className = 'puzzle-panel';

        const iconPromises = puzzleIcons.map(async iconKey => {
            if (iconKey) {
                const imageUrl = IMAGE_BASE_URL + PUZZLE_ICONS[iconKey];
                try {
                    const img = await loadImage(imageUrl);
                    const icon = document.createElement('img');
                    icon.className = 'puzzle-icon';
                    icon.src = img.src;
                    icon.style.width = `${iconSize}px`;
                    icon.style.height = `${iconSize}px`;
                    panel.appendChild(icon);
                } catch (e) {
                    console.error('Failed to load puzzle icon:', iconKey, e);
                }
            }
        });

        await Promise.all(iconPromises);
        return panel;
    }

    // Безопасная функция для обработки блока с предисловием
    function handlePrefaceBlock() {
        try {
            const prefaceBlocks = document.querySelectorAll('.t-redactor__preface');
            if (!prefaceBlocks.length) return;

            prefaceBlocks.forEach(prefaceBlock => {
                if (prefaceBlock.dataset.processed) return;
                
                const originalContent = prefaceBlock.innerHTML;
                
                // Ищем позицию слова "Решение:" (регистронезависимо)
                const solutionIndex = originalContent.toLowerCase().indexOf('решение:');
                
                // Если "Решение:" не найдено, пропускаем блок
                if (solutionIndex === -1) return;
                
                // Разделяем контент на часть до "Решение:" и после
                const visiblePart = originalContent.substring(0, solutionIndex + 'Решение:'.length);
                const hiddenPart = originalContent.substring(solutionIndex + 'Решение:'.length);
                
                // Создаем скрытую версию (только скрытая часть заменяется на ▒)
                const hiddenContent = visiblePart + '▒'.repeat(20);
                
                // Сохраняем оригинал
                prefaceBlock.dataset.original = originalContent;
                prefaceBlock.innerHTML = hiddenContent;
                prefaceBlock.style.cursor = 'pointer';
                prefaceBlock.title = 'Нажмите, чтобы показать решение';
                prefaceBlock.dataset.processed = 'true';
                
                // Переключение при клике
                prefaceBlock.addEventListener('click', () => {
                    if (prefaceBlock.dataset.hidden === 'true') {
                        prefaceBlock.innerHTML = prefaceBlock.dataset.original;
                        prefaceBlock.dataset.hidden = 'false';
                        prefaceBlock.title = 'Нажмите, чтобы скрыть решение';
                    } else {
                        prefaceBlock.innerHTML = hiddenContent;
                        prefaceBlock.dataset.hidden = 'true';
                        prefaceBlock.title = 'Нажмите, чтобы показать решение';
                    }
                });
                
                prefaceBlock.dataset.hidden = 'true'; // Изначально скрыто
            });
        } catch (e) {
            console.error('Error in handlePrefaceBlock:', e);
        }
    }

    // Безопасная инициализация
    function safeInit() {
        try {
            // Запускаем обработку предисловий сразу
            handlePrefaceBlock();
            
            // Остальную инициализацию запускаем с задержкой
            setTimeout(() => {
                preloadImages().then(() => {
                    findAndRenderJSON();
                    
                    // Наблюдатель только для новых предисловий
                    new MutationObserver(function(mutations) {
                        handlePrefaceBlock();
                        findAndRenderJSON();
                    }).observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: false,
                        characterData: false
                    });
                }).catch(console.error);
            }, 50);
        } catch (e) {
            console.error('Initialization error:', e);
        }
    }

    // Запускаем безопасную инициализацию
    if (document.readyState === 'complete') {
        safeInit();
    } else {
        document.addEventListener('DOMContentLoaded', safeInit);
    }
})();