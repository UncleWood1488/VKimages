// ==UserScript==
// @name         VK images
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  Архивация фото, текста и видео из диалогов ВК + альбомы + анализ + выбор диапазона + разбивка на несколько ZIP-архивов + выбор видео для скачивания + тёмная тема
// @author       UncleWood
// @match        *://vk.com/im*
// @match        *://*.vk.com/im*
// @match        *://m.vk.com/im*
// @match        *://vk.com/album*
// @match        *://*.vk.com/album*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://unpkg.com/jszip@3.10.1/dist/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    const TOKEN_KEY = 'vk_access_token_manual';
    const DARK_THEME_KEY = 'vk_dark_theme_enabled';

    let accessToken = GM_getValue(TOKEN_KEY, '');
    let darkThemeEnabled = GM_getValue(DARK_THEME_KEY, false);

    // Добавляем CSS с поддержкой переменных и тёмной темы
    GM_addStyle(`
        :root {
            --vk-bg: #ffffff;
            --vk-text: #000000;
            --vk-border: #cccccc;
            --vk-input-bg: #ffffff;
            --vk-log-bg: #f5f5f5;
            --vk-hover-bg: #f0f0f0;
            --vk-btn-bg: #4a76a8;
            --vk-btn-hover: #3a5e87;
            --vk-shadow: rgba(0,0,0,0.2);
            --vk-overlay: rgba(0,0,0,0.5);
        }

        .vk-dark-theme {
            --vk-bg: #2d2d2d;
            --vk-text: #e0e0e0;
            --vk-border: #555555;
            --vk-input-bg: #444444;
            --vk-log-bg: #1e1e1e;
            --vk-hover-bg: #3a3a3a;
            --vk-btn-bg: #3a5e87;
            --vk-btn-hover: #2a4a6a;
            --vk-shadow: rgba(0,0,0,0.6);
            --vk-overlay: rgba(0,0,0,0.7);
        }

        #vk-archive-toggle {
            position: fixed;
            top: 70px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: var(--vk-btn-bg);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10001;
            box-shadow: 0 2px 10px var(--vk-shadow);
            font-size: 24px;
            transition: transform 0.2s;
        }
        #vk-archive-toggle:hover {
            transform: scale(1.1);
            background: var(--vk-btn-hover);
        }

        #vk-archive-menu {
            display: none;
            position: fixed;
            top: 130px;
            right: 20px;
            width: 420px;
            background: var(--vk-bg);
            border: 1px solid var(--vk-border);
            border-radius: 8px;
            box-shadow: 0 2px 10px var(--vk-shadow);
            padding: 15px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: var(--vk-text);
            max-height: 90vh;
            overflow-y: auto;
        }
        #vk-archive-menu h3 {
            margin: 0 0 10px;
            font-size: 16px;
            font-weight: 600;
            border-bottom: 1px solid var(--vk-border);
            padding-bottom: 5px;
            color: var(--vk-text);
        }
        #vk-archive-menu .section {
            margin-bottom: 20px;
            border-bottom: 1px solid var(--vk-border);
            padding-bottom: 10px;
        }
        #vk-archive-menu .field {
            margin-bottom: 10px;
        }
        #vk-archive-menu label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 4px;
            color: var(--vk-text);
        }
        #vk-archive-menu input[type="text"],
        #vk-archive-menu input[type="password"],
        #vk-archive-menu input[type="number"],
        #vk-archive-menu select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vk-border);
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 13px;
            background: var(--vk-input-bg);
            color: var(--vk-text);
        }
        #vk-archive-menu .checkbox-group {
            margin: 8px 0;
        }
        #vk-archive-menu .checkbox-group label {
            display: inline-block;
            margin-right: 15px;
            font-weight: normal;
            color: var(--vk-text);
        }
        #vk-archive-menu button {
            background: var(--vk-btn-bg);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            margin-right: 8px;
            margin-bottom: 5px;
        }
        #vk-archive-menu button:hover {
            background: var(--vk-btn-hover);
        }
        #vk-archive-menu .token-help {
            font-size: 12px;
            margin: 4px 0 8px;
            color: var(--vk-text);
            opacity: 0.8;
        }
        #vk-archive-menu .token-help a {
            color: var(--vk-btn-bg);
            text-decoration: none;
        }
        #vk-archive-menu .token-help a:hover {
            text-decoration: underline;
        }
        #vk-archive-menu #vk-log {
            background: var(--vk-log-bg);
            border: 1px solid var(--vk-border);
            border-radius: 4px;
            padding: 8px;
            height: 150px;
            overflow-y: auto;
            font-size: 12px;
            font-family: monospace;
            margin-top: 10px;
            white-space: pre-wrap;
            color: var(--vk-text);
        }
        #vk-archive-menu .progress {
            font-size: 12px;
            margin-top: 8px;
            font-weight: 500;
            color: var(--vk-text);
        }
        #vk-archive-menu .token-status {
            font-size: 13px;
            margin-bottom: 10px;
            color: ${accessToken ? 'green' : 'red'};
        }
        #vk-archive-menu .warning {
            color: #d32f2f;
            font-size: 12px;
            margin-top: 4px;
        }
        #vk-archive-menu .range-fields {
            display: flex;
            gap: 10px;
        }
        #vk-archive-menu .range-fields input {
            flex: 1;
        }
        #vk-archive-close {
            float: right;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            color: var(--vk-text);
            opacity: 0.6;
            margin-top: -5px;
        }
        #vk-archive-close:hover {
            opacity: 1;
        }
        #vk-video-quality {
            width: 100%;
            padding: 6px;
            border-radius: 4px;
            border: 1px solid var(--vk-border);
            background: var(--vk-input-bg);
            color: var(--vk-text);
        }

        /* Стили для диалога выбора видео */
        #vk-video-selection-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: var(--vk-overlay);
            z-index: 10002;
            display: none;
            justify-content: center;
            align-items: center;
        }
        #vk-video-selection-dialog {
            background: var(--vk-bg);
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 5px 30px var(--vk-shadow);
            color: var(--vk-text);
        }
        #vk-video-selection-dialog h3 {
            margin-top: 0;
            border-bottom: 1px solid var(--vk-border);
            padding-bottom: 10px;
            color: var(--vk-text);
        }
        #vk-video-list {
            flex: 1;
            overflow-y: auto;
            margin: 10px 0;
            padding-right: 5px;
        }
        #vk-video-list .video-item {
            display: flex;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid var(--vk-border);
        }
        #vk-video-list .video-item input[type="checkbox"] {
            margin-right: 10px;
            flex-shrink: 0;
        }
        #vk-video-list .video-item label {
            font-size: 13px;
            cursor: pointer;
            word-break: break-word;
            color: var(--vk-text);
        }
        #vk-video-selection-dialog .actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--vk-border);
        }
        #vk-video-selection-dialog .actions button {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        #vk-video-selection-dialog .actions .btn-primary {
            background: var(--vk-btn-bg);
            color: white;
        }
        #vk-video-selection-dialog .actions .btn-primary:hover {
            background: var(--vk-btn-hover);
        }
        #vk-video-selection-dialog .actions .btn-secondary {
            background: var(--vk-border);
            color: var(--vk-text);
        }
        #vk-video-selection-dialog .actions .btn-secondary:hover {
            background: var(--vk-hover-bg);
        }
        .select-all {
            margin-bottom: 8px;
        }
        .select-all label {
            font-weight: normal;
            font-size: 13px;
            cursor: pointer;
            color: var(--vk-text);
        }
        .theme-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 5px 0;
        }
        .theme-toggle label {
            font-weight: normal;
            cursor: pointer;
            color: var(--vk-text);
        }
    `);

    // Добавляем оверлей для выбора видео
    const selectionHTML = `
        <div id="vk-video-selection-overlay">
            <div id="vk-video-selection-dialog">
                <h3>Выберите видео для скачивания</h3>
                <div class="select-all">
                    <label><input type="checkbox" id="vk-select-all-videos" /> Выбрать все</label>
                </div>
                <div id="vk-video-list"></div>
                <div class="actions">
                    <button class="btn-secondary" id="vk-video-cancel">Отмена</button>
                    <button class="btn-primary" id="vk-video-download-selected">Скачать выбранные</button>
                </div>
            </div>
        </div>
    `;
    $('body').append(selectionHTML);

    const $overlay = $('#vk-video-selection-overlay');
    const $videoList = $('#vk-video-list');
    const $selectAll = $('#vk-select-all-videos');
    const $downloadSelected = $('#vk-video-download-selected');
    const $cancelBtn = $('#vk-video-cancel');

    // Функция показа диалога с видео
    function showVideoSelectionDialog(videos, quality) {
        return new Promise((resolve) => {
            // Очищаем список
            $videoList.empty();
            // Добавляем элементы
            videos.forEach((video, index) => {
                const title = video.title || `Видео #${video.id}`;
                const div = $('<div class="video-item"></div>');
                const checkbox = $('<input type="checkbox" data-index="' + index + '" />');
                const label = $('<label></label>').text(title);
                div.append(checkbox, label);
                $videoList.append(div);
            });

            // Событие "Выбрать все"
            $selectAll.prop('checked', false);
            $selectAll.off('change').on('change', function() {
                const checked = $(this).prop('checked');
                $videoList.find('input[type="checkbox"]').prop('checked', checked);
            });

            // Отмена
            $cancelBtn.off('click').on('click', function() {
                $overlay.hide();
                resolve(null); // отмена
            });

            // Скачать выбранные
            $downloadSelected.off('click').on('click', function() {
                const selected = [];
                $videoList.find('input[type="checkbox"]:checked').each(function() {
                    const idx = parseInt($(this).data('index'));
                    selected.push(videos[idx]);
                });
                $overlay.hide();
                resolve(selected);
            });

            // Показываем оверлей
            $overlay.show();
        });
    }

    // Закрытие по клику на фон
    $overlay.on('click', function(e) {
        if (e.target === this) {
            $overlay.hide();
        }
    });

    // Функция применения темы
    function applyTheme(isDark) {
        const $menu = $('#vk-archive-menu');
        const $dialog = $('#vk-video-selection-dialog');
        if (isDark) {
            $menu.addClass('vk-dark-theme');
            $dialog.addClass('vk-dark-theme');
        } else {
            $menu.removeClass('vk-dark-theme');
            $dialog.removeClass('vk-dark-theme');
        }
        // Сохраняем состояние
        GM_setValue(DARK_THEME_KEY, isDark);
        darkThemeEnabled = isDark;
        // Обновляем чекбокс
        $('#vk-theme-toggle').prop('checked', isDark);
    }

    const menuHTML = `
        <div id="vk-archive-menu">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin:0;">VK Images</h3>
                <span id="vk-archive-close" title="Закрыть">✖</span>
            </div>
            <div style="margin-bottom: 8px; text-align: right;">
                <a href="https://github.com/UncleWood1488/VKimages" target="_blank" style="color: var(--vk-btn-bg); text-decoration: none; font-size: 12px;">📦 GitHub</a>
            </div>
            <div class="token-status" id="vk-token-status">
                ${accessToken ? '✅ Токен установлен' : '❌ Токен не задан'}
            </div>

            <div class="section">
                <label>🔑 Токен доступа (права: messages, photos, video):</label>
                <input type="password" id="vk-token-input" value="${accessToken}" placeholder="Вставьте токен" />
                <div class="token-help">
                    ⚡ <a href="https://vkhost.github.io/" target="_blank">Получить токен</a> (выберите нужные права)
                </div>
                <button id="vk-save-token">Сохранить токен</button>
                <button id="vk-clear-token">Очистить</button>
            </div>

            <div class="section">
                <h4>Диалог</h4>
                <div class="field">
                    <label>Peer ID диалога (число):</label>
                    <input type="text" id="vk-peer-id" placeholder="Например: 12345678" />
                </div>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="vk-include-posts" /> Фото из репостов</label>
                </div>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="vk-save-twitter" checked /> Twitter/X</label>
                    <label><input type="checkbox" id="vk-save-hashtags" checked /> #</label>
                    <label><input type="checkbox" id="vk-save-mentions" checked /> @</label>
                </div>
                <div>
                    <button id="vk-analyze-dialog">Анализ диалога</button>
                </div>
            </div>

            <div class="section">
                <h4>Альбом</h4>
                <div class="field">
                    <label>Ссылка на альбом:</label>
                    <input type="text" id="vk-album-url" placeholder="https://vk.com/album-123_456" />
                </div>
                <button id="vk-fetch-album">Получить фото альбома</button>
            </div>

            <div class="section">
                <h4>Видео</h4>
                <div class="field">
                    <label>Разрешение видео:</label>
                    <select id="vk-video-quality">
                        <option value="best">Максимальное</option>
                        <option value="1080">1080p</option>
                        <option value="720">720p</option>
                        <option value="480">480p</option>
                        <option value="360">360p</option>
                        <option value="240">240p</option>
                    </select>
                </div>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="vk-include-video-posts" /> Видео из репостов</label>
                </div>
                <button id="vk-download-videos">Скачать видео из диалога</button>
            </div>

            <div class="section">
                <h4>Настройки скачивания</h4>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="vk-use-zip" checked /> Упаковать фото в ZIP-архив (разбивка по 1000 фото)</label>
                    <div class="warning" id="zip-warning" style="display:none;">⚠️ Скачивание по одному может быть заблокировано</div>
                </div>
                <div class="field">
                    <label>Диапазон фото (номера с 1, 0 = все):</label>
                    <div class="range-fields">
                        <input type="number" id="vk-range-start" value="0" min="0" placeholder="Начало" />
                        <input type="number" id="vk-range-end" value="0" min="0" placeholder="Конец" />
                    </div>
                </div>
                <button id="vk-start-archive">Скачать фото (диалог)</button>
                <button id="vk-clear-log">Очистить лог</button>
            </div>

            <div class="section">
                <h4>Оформление</h4>
                <div class="theme-toggle">
                    <label><input type="checkbox" id="vk-theme-toggle" ${darkThemeEnabled ? 'checked' : ''} /> Тёмная тема</label>
                </div>
            </div>

            <div class="progress">
                Найдено фото: <span id="vk-photo-count">0</span>
            </div>
            <div id="vk-log"></div>
        </div>
    `;

    $('body').append(menuHTML);
    $('body').append('<div id="vk-archive-toggle">📦</div>');

    const $menu = $('#vk-archive-menu');
    const $toggle = $('#vk-archive-toggle');
    const $close = $('#vk-archive-close');
    const $tokenStatus = $('#vk-token-status');
    const $tokenInput = $('#vk-token-input');
    const $saveToken = $('#vk-save-token');
    const $clearToken = $('#vk-clear-token');
    const $peerInput = $('#vk-peer-id');
    const $includePosts = $('#vk-include-posts');
    const $saveTwitter = $('#vk-save-twitter');
    const $saveHashtags = $('#vk-save-hashtags');
    const $saveMentions = $('#vk-save-mentions');
    const $useZip = $('#vk-use-zip');
    const $zipWarning = $('#zip-warning');
    const $rangeStart = $('#vk-range-start');
    const $rangeEnd = $('#vk-range-end');
    const $startBtn = $('#vk-start-archive');
    const $analyzeBtn = $('#vk-analyze-dialog');
    const $albumUrl = $('#vk-album-url');
    const $fetchAlbumBtn = $('#vk-fetch-album');
    const $clearLog = $('#vk-clear-log');
    const $log = $('#vk-log');
    const $photoCount = $('#vk-photo-count');
    const $videoQuality = $('#vk-video-quality');
    const $includeVideoPosts = $('#vk-include-video-posts');
    const $downloadVideosBtn = $('#vk-download-videos');
    const $themeToggle = $('#vk-theme-toggle');

    // Применяем сохранённую тему при загрузке
    applyTheme(darkThemeEnabled);

    // Обработчик переключения темы
    $themeToggle.on('change', function() {
        applyTheme($(this).prop('checked'));
    });

    $toggle.on('click', () => $menu.toggle());
    $close.on('click', () => $menu.hide());
    $useZip.on('change', function() { $zipWarning.toggle(!this.checked); });

    function log(msg) {
        $log.append($('<div>').text(msg));
        $log.scrollTop($log[0].scrollHeight);
        console.log('[VK Archiver]', msg);
    }

    function updateTokenStatus() {
        if (accessToken) {
            $tokenStatus.text('✅ Токен установлен').css('color', 'green');
        } else {
            $tokenStatus.text('❌ Токен не задан').css('color', 'red');
        }
    }

    $saveToken.on('click', function() {
        const newToken = $tokenInput.val().trim();
        if (newToken) {
            accessToken = newToken;
            GM_setValue(TOKEN_KEY, newToken);
            updateTokenStatus();
            log('Токен сохранён');
        } else {
            log('Введите токен');
        }
    });

    $clearToken.on('click', function() {
        accessToken = '';
        GM_deleteValue(TOKEN_KEY);
        $tokenInput.val('');
        updateTokenStatus();
        log('Токен удалён');
    });

    $clearLog.on('click', () => $log.empty());

    GM_registerMenuCommand('Показать/скрыть архиватор', () => $menu.toggle());

    function apiCall(method, params) {
        return new Promise((resolve, reject) => {
            const url = `https://api.vk.com/method/${method}?${params}&access_token=${accessToken}&v=5.131`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.error) {
                            reject(`Ошибка API: ${data.error.error_msg} (код ${data.error.error_code})`);
                        } else {
                            resolve(data.response);
                        }
                    } catch (e) {
                        reject('Ошибка парсинга ответа: ' + e);
                    }
                },
                onerror: reject
            });
        });
    }

    $analyzeBtn.on('click', async function() {
        if (!accessToken) { log('Ошибка: нет токена'); return; }
        const peerIdRaw = $peerInput.val().trim();
        const peerId = parseInt(peerIdRaw.replace(/\D/g, ''));
        if (isNaN(peerId)) { log('Ошибка: некорректный Peer ID'); return; }

        log('Анализ диалога...');
        let totalMessages = 0, messagesWithPhotos = 0, totalPhotos = 0, totalDocs = 0, totalLinks = 0;
        let offset = 0, count = 200, total = null;

        try {
            while (total === null || offset < total) {
                const resp = await apiCall('messages.getHistory', `peer_id=${peerId}&offset=${offset}&count=${count}`);
                if (total === null) total = resp.count;
                const items = resp.items;
                totalMessages += items.length;
                items.forEach(msg => {
                    if (msg.attachments) {
                        msg.attachments.forEach(att => {
                            if (att.type === 'photo') totalPhotos++;
                            else if (att.type === 'doc') totalDocs++;
                        });
                        if (msg.attachments.some(att => att.type === 'photo')) messagesWithPhotos++;
                    }
                    if (msg.text && msg.text.match(/https?:\/\//)) totalLinks++;
                });
                offset += count;
                log(`Проанализировано ${totalMessages} из ${total} сообщений...`);
            }
            log('=== Анализ диалога ===');
            log(`Всего сообщений: ${totalMessages}`);
            log(`Сообщений с фото: ${messagesWithPhotos}`);
            log(`Всего фото: ${totalPhotos}`);
            log(`Всего документов: ${totalDocs}`);
            log(`Сообщений со ссылками: ${totalLinks}`);
            log('======================');
        } catch (e) { log('Ошибка при анализе: ' + e); }
    });

    $fetchAlbumBtn.on('click', async function() {
        if (!accessToken) { log('Ошибка: нет токена'); return; }
        const url = $albumUrl.val().trim();
        if (!url) { log('Введите ссылку на альбом'); return; }

        let match = url.match(/album([\-0-9]+)_([0-9]+)/);
        if (!match) { log('Не удалось распознать альбом. Формат: https://vk.com/album-123_456'); return; }
        const owner_id = parseInt(match[1]), album_id = parseInt(match[2]);

        log(`Загружаем фото из альбома: owner_id=${owner_id}, album_id=${album_id}`);
        try {
            const photos = [];
            let offset = 0, count = 1000, total = null;
            while (total === null || offset < total) {
                const resp = await apiCall('photos.get', `owner_id=${owner_id}&album_id=${album_id}&offset=${offset}&count=${count}`);
                if (total === null) total = resp.count;
                const items = resp.items;
                items.forEach(photo => {
                    const url = getMaxSizePhotoUrl(photo);
                    if (url) photos.push(url);
                });
                offset += items.length;
                log(`Загружено ${photos.length} из ${total} фото...`);
            }
            log(`Найдено фото в альбоме: ${photos.length}`);
            $photoCount.text(photos.length);
            if (photos.length > 0) {
                const useZip = $useZip.prop('checked');
                const start = parseInt($rangeStart.val()) || 0;
                const end = parseInt($rangeEnd.val()) || 0;
                const selectedPhotos = selectRange(photos, start, end);
                log(`Выбрано для скачивания: ${selectedPhotos.length} фото`);
                if (useZip) await downloadPhotosAsZip(selectedPhotos);
                else await downloadPhotosSequential(selectedPhotos);
            } else { log('Нет фото для скачивания'); }
        } catch (e) { log('Ошибка при загрузке альбома: ' + e); }
    });

    $startBtn.on('click', async function() {
        if (!accessToken) { log('Ошибка: нет токена'); return; }
        const peerIdRaw = $peerInput.val().trim();
        const peerId = parseInt(peerIdRaw.replace(/\D/g, ''));
        if (isNaN(peerId)) { log('Ошибка: некорректный Peer ID'); return; }
        const includePosts = $includePosts.prop('checked');
        const saveTwitter = $saveTwitter.prop('checked');
        const saveHashtags = $saveHashtags.prop('checked');
        const saveMentions = $saveMentions.prop('checked');
        const useZip = $useZip.prop('checked');
        const start = parseInt($rangeStart.val()) || 0;
        const end = parseInt($rangeEnd.val()) || 0;
        log('Начинаем сбор сообщений...');
        await startArchiving(peerId, accessToken, includePosts, saveTwitter, saveHashtags, saveMentions, useZip, start, end);
    });

    // Обработчик для видео с выбором
    $downloadVideosBtn.on('click', async function() {
        if (!accessToken) { log('Ошибка: нет токена'); return; }
        const peerIdRaw = $peerInput.val().trim();
        const peerId = parseInt(peerIdRaw.replace(/\D/g, ''));
        if (isNaN(peerId)) { log('Ошибка: некорректный Peer ID'); return; }
        const includePosts = $includeVideoPosts.prop('checked');
        const quality = $videoQuality.val();

        log('Сбор видео из диалога...');
        const videos = await collectVideosFromDialog(peerId, accessToken, includePosts);
        if (videos.length === 0) {
            log('Видео не найдены.');
            return;
        }
        log(`Найдено видео: ${videos.length}`);

        // Показываем диалог выбора
        const selectedVideos = await showVideoSelectionDialog(videos, quality);
        if (!selectedVideos || selectedVideos.length === 0) {
            log('Выбор видео отменён или ничего не выбрано.');
            return;
        }
        log(`Выбрано для скачивания: ${selectedVideos.length} видео`);

        // Скачиваем выбранные
        await downloadSelectedVideos(selectedVideos, quality);
    });

    // Функция сбора видео из диалога (возвращает массив объектов video)
    async function collectVideosFromDialog(peerId, token, includePosts) {
        let allMessages = [], offset = 0, count = 200, total = null;
        try {
            while (total === null || offset < total) {
                const resp = await apiCall('messages.getHistory', `peer_id=${peerId}&offset=${offset}&count=${count}`);
                if (total === null) total = resp.count;
                allMessages = allMessages.concat(resp.items);
                offset += count;
                log(`Загружено ${allMessages.length} из ${total} сообщений...`);
            }
        } catch (e) {
            log('Ошибка при загрузке сообщений: ' + e);
            return [];
        }

        const videos = [];
        allMessages.forEach(msg => {
            const attachments = msg.attachments || [];
            attachments.forEach(att => {
                if (att.type === 'video') {
                    videos.push(att.video);
                } else if (att.type === 'wall' && includePosts) {
                    const postAttachments = att.wall.attachments || [];
                    postAttachments.forEach(postAtt => {
                        if (postAtt.type === 'video') {
                            videos.push(postAtt.video);
                        }
                    });
                }
            });
        });
        return videos;
    }

    // Функция скачивания выбранных видео
    async function downloadSelectedVideos(videos, quality) {
        let successCount = 0;
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const downloadUrl = getVideoDownloadUrl(video, quality);
            if (!downloadUrl) {
                log(`[${i+1}/${videos.length}] Видео ${video.id} не имеет доступных форматов, пропускаем`);
                continue;
            }
            const title = video.title || `video_${video.id}`;
            const filename = `vk_video_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${video.id}.mp4`;
            log(`[${i+1}/${videos.length}] Скачиваем: ${title}`);
            try {
                await downloadSingleFile(downloadUrl, filename);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                log(`[${i+1}/${videos.length}] Ошибка скачивания: ${e.message}`);
            }
        }
        log(`Скачано видео: ${successCount} из ${videos.length}`);
    }

    // Получение ссылки на видео согласно выбранному качеству
    function getVideoDownloadUrl(video, quality) {
        const files = video.files;
        if (!files) return null;

        const qualities = ['1080', '720', '480', '360', '240'];
        let selectedQuality = quality;

        if (selectedQuality === 'best') {
            for (const q of qualities) {
                const key = 'mp4_' + q;
                if (files[key]) return files[key];
            }
            if (files.mp4) return files.mp4;
            if (files.flv) return files.flv;
            return null;
        } else {
            const target = parseInt(selectedQuality);
            const key = 'mp4_' + selectedQuality;
            if (files[key]) return files[key];
            const available = qualities.filter(q => files['mp4_' + q]).map(q => parseInt(q));
            if (available.length === 0) {
                if (files.mp4) return files.mp4;
                if (files.flv) return files.flv;
                return null;
            }
            available.sort((a,b) => b - a);
            for (const q of available) {
                if (q <= target) {
                    return files['mp4_' + q];
                }
            }
            const lowest = available[available.length - 1];
            return files['mp4_' + lowest];
        }
    }

    // Универсальная функция скачивания одного файла по URL
    function downloadSingleFile(url, filename) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onload: function(response) {
                    if (response.status !== 200) {
                        reject(new Error(`HTTP ${response.status}`));
                        return;
                    }
                    const blob = response.response;
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    resolve();
                },
                onerror: function(err) {
                    reject(new Error('Ошибка сети'));
                },
                ontimeout: function() {
                    reject(new Error('Таймаут'));
                }
            });
        });
    }

    function selectRange(array, start, end) {
        if (start <= 0 && end <= 0) return array;
        const s = Math.max(1, start) - 1;
        const e = (end > 0) ? end : array.length;
        return array.slice(s, e);
    }

    function getMaxSizePhotoUrl(photo) {
        const sizes = photo.sizes;
        if (!sizes || sizes.length === 0) return null;
        let maxSize = sizes.reduce((prev, curr) => {
            const prevArea = (prev.width || 0) * (prev.height || 0);
            const currArea = (curr.width || 0) * (curr.height || 0);
            return currArea > prevArea ? curr : prev;
        });
        return maxSize.url;
    }

    function extractTwitterUrls(text) {
        const regex = /https?:\/\/(www\.)?(twitter\.com|x\.com)\/\S+/gi;
        return text.match(regex) || [];
    }

    function extractHashtags(text) {
        const regex = /#[^\s#]+/g;
        return text.match(regex) || [];
    }

    function extractMentions(text) {
        const regex = /@[^\s@]+/g;
        return text.match(regex) || [];
    }

    function downloadPhotosSequential(urls) {
        return new Promise((resolve) => {
            let index = 0;
            function next() {
                if (index >= urls.length) { log('Все фото скачаны'); resolve(); return; }
                const url = urls[index];
                const filename = `vk_photo_${Date.now()}_${index+1}.jpg`;
                GM_xmlhttpRequest({
                    method: 'GET', url: url, responseType: 'blob',
                    onload: function(response) {
                        const blob = response.response;
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl; a.download = filename;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        log(`Скачано ${index+1}/${urls.length}`);
                        index++; setTimeout(next, 500);
                    },
                    onerror: function(err) { log(`Ошибка скачивания ${url}: ${err}`); index++; next(); }
                });
            }
            next();
        });
    }

    async function downloadPhotosAsZip(urls) {
        log('>>> Вход в downloadPhotosAsZip, urls.length = ' + urls.length);

        if (typeof JSZip === 'undefined') {
            log('❌ JSZip не загружен!');
            return;
        }
        log('✅ JSZip доступен, версия: ' + (JSZip.version || 'неизвестна'));

        try {
            const testZip = new JSZip();
            testZip.file("test.txt", "Hello World");
            log('✅ JSZip работает: файл добавлен');
        } catch (e) {
            log('❌ Ошибка при работе с JSZip: ' + e.message);
            return;
        }

        const MAX_PER_ZIP = 1000;
        const totalChunks = Math.ceil(urls.length / MAX_PER_ZIP);
        log(`Разбиваем ${urls.length} фото на ${totalChunks} архивов (по ${MAX_PER_ZIP} фото)`);

        for (let chunk = 0; chunk < totalChunks; chunk++) {
            const startIdx = chunk * MAX_PER_ZIP;
            const endIdx = Math.min(startIdx + MAX_PER_ZIP, urls.length);
            const chunkUrls = urls.slice(startIdx, endIdx);

            log(`Архив ${chunk+1}/${totalChunks}: загружаем фото ${startIdx+1}–${endIdx}...`);

            const zip = new JSZip();
            const folder = zip.folder("vk_photos");
            const concurrency = 5;
            let loaded = 0;

            async function downloadOne(url, idx) {
                try {
                    log(`  Загрузка фото ${idx+1}...`);
                    const blob = await fetchBlob(url);
                    if (blob.size === 0) throw new Error('Пустой blob');
                    let ext = 'jpg';
                    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
                    if (match) ext = match[1];
                    const filename = `photo_${idx+1}.${ext}`;
                    folder.file(filename, blob);
                    loaded++;
                    log(`  ✅ Фото ${idx+1} добавлено (${blob.size} байт)`);
                } catch (e) {
                    log(`  ❌ Ошибка фото ${idx+1}: ${e.message}`);
                }
            }

            for (let i = 0; i < chunkUrls.length; i += concurrency) {
                const batch = chunkUrls.slice(i, i + concurrency);
                log(`  Пакетная загрузка ${i+1}–${Math.min(i+concurrency, chunkUrls.length)}...`);
                const promises = batch.map((url, idx) => downloadOne(url, startIdx + i + idx));
                await Promise.all(promises);
            }

            if (loaded === 0) {
                log(`Архив ${chunk+1} пуст, пропускаем`);
                continue;
            }

            log(`Архив ${chunk+1}: загружено ${loaded} фото. Генерируем ZIP...`);

            try {
                log('  Начало генерации...');
                const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
                log(`  ZIP сгенерирован, размер: ${content.size} байт, тип: ${content.type}`);

                const blobUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `vk_photos_${Date.now()}_part${chunk+1}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                log(`✅ Архив ${chunk+1} сохранён`);
            } catch (e) {
                log(`❌ Ошибка генерации архива ${chunk+1}: ${e.message}`);
                console.error('Ошибка ZIP:', e);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        log('Все архивы обработаны');
    }

    function fetchBlob(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url: url, responseType: 'blob',
                onload: (resp) => {
                    if (resp.status !== 200) {
                        reject(new Error(`HTTP ${resp.status}`));
                        return;
                    }
                    if (!(resp.response instanceof Blob)) {
                        reject(new Error('Ответ не blob'));
                        return;
                    }
                    resolve(resp.response);
                },
                onerror: () => reject(new Error('Ошибка сети')),
                ontimeout: () => reject(new Error('Таймаут'))
            });
        });
    }

    function saveTextItems(items) {
        const content = JSON.stringify(items, null, 2);
        const blob = new Blob([content], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `vk_text_archive_${Date.now()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateTokenStatus();
    $zipWarning.toggle(!$useZip.prop('checked'));
})();
