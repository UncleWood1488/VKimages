// ==UserScript==
// @name         VK images
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Архивация фото и текста из диалогов ВК + альбомы + анализ + выбор диапазона + параллельная загрузка
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
    let accessToken = GM_getValue(TOKEN_KEY, '');

    GM_addStyle(`
        #vk-archive-menu {
            position: fixed;
            top: 60px;
            right: 20px;
            width: 420px;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            padding: 15px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #000;
            max-height: 90vh;
            overflow-y: auto;
        }
        #vk-archive-menu h3 {
            margin: 0 0 10px;
            font-size: 16px;
            font-weight: 600;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }
        #vk-archive-menu .section {
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
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
        }
        #vk-archive-menu input[type="text"],
        #vk-archive-menu input[type="password"],
        #vk-archive-menu input[type="number"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 13px;
        }
        #vk-archive-menu .checkbox-group {
            margin: 8px 0;
        }
        #vk-archive-menu .checkbox-group label {
            display: inline-block;
            margin-right: 15px;
            font-weight: normal;
        }
        #vk-archive-menu button {
            background: #4a76a8;
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
            background: #3a5e87;
        }
        #vk-archive-menu .token-help {
            font-size: 12px;
            margin: 4px 0 8px;
            color: #555;
        }
        #vk-archive-menu .token-help a {
            color: #4a76a8;
            text-decoration: none;
        }
        #vk-archive-menu .token-help a:hover {
            text-decoration: underline;
        }
        #vk-archive-menu #vk-log {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
            height: 150px;
            overflow-y: auto;
            font-size: 12px;
            font-family: monospace;
            margin-top: 10px;
            white-space: pre-wrap;
        }
        #vk-archive-menu .progress {
            font-size: 12px;
            margin-top: 8px;
            font-weight: 500;
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
    `);

    const menuHTML = `
        <div id="vk-archive-menu">
            <h3>VK Images</h3>
            <div style="margin-bottom: 8px; text-align: right;">
                <a href="https://github.com/UncleWood1488/VKimages" target="_blank" style="color: #4a76a8; text-decoration: none; font-size: 12px;">📦 GitHub</a>
            </div>
            <div class="token-status" id="vk-token-status">
                ${accessToken ? '✅ Токен установлен' : '❌ Токен не задан'}
            </div>

            <!-- Токен -->
            <div class="section">
                <label>🔑 Токен доступа (права: messages, photos):</label>
                <input type="password" id="vk-token-input" value="${accessToken}" placeholder="Вставьте токен" />
                <div class="token-help">
                    ⚡ <a href="https://vkhost.github.io/" target="_blank">Получить токен</a> (выберите нужные права)
                </div>
                <button id="vk-save-token">Сохранить токен</button>
                <button id="vk-clear-token">Очистить</button>
            </div>

            <!-- Диалог -->
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

            <!-- Альбом -->
            <div class="section">
                <h4>Альбом</h4>
                <div class="field">
                    <label>Ссылка на альбом:</label>
                    <input type="text" id="vk-album-url" placeholder="https://vk.com/album-123_456" />
                </div>
                <button id="vk-fetch-album">Получить фото альбома</button>
            </div>

            <!-- Общие настройки скачивания -->
            <div class="section">
                <h4>Настройки скачивания</h4>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="vk-use-zip" checked /> Упаковать фото в ZIP-архив (параллельно, до 5 фото одновременно)</label>
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

            <div class="progress">
                Найдено фото: <span id="vk-photo-count">0</span>
            </div>
            <div id="vk-log"></div>
        </div>
    `;

    $('body').append(menuHTML);

    // Элементы интерфейса
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

    // Предупреждение для ZIP
    $useZip.on('change', function() {
        $zipWarning.toggle(!this.checked);
    });

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

    GM_registerMenuCommand('Показать/скрыть архиватор', () => $('#vk-archive-menu').toggle());

    // ---------- Функции для работы с API ----------
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

    // ---------- Анализ диалога ----------
    $analyzeBtn.on('click', async function() {
        if (!accessToken) {
            log('Ошибка: нет токена');
            return;
        }
        const peerIdRaw = $peerInput.val().trim();
        const peerId = parseInt(peerIdRaw.replace(/\D/g, ''));
        if (isNaN(peerId)) {
            log('Ошибка: некорректный Peer ID');
            return;
        }

        log('Анализ диалога...');
        let totalMessages = 0;
        let messagesWithPhotos = 0;
        let totalPhotos = 0;
        let totalDocs = 0;
        let totalLinks = 0; // упрощённо: ссылки в тексте

        let offset = 0;
        const count = 200;
        let total = null;

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
                    // грубая оценка ссылок
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
        } catch (e) {
            log('Ошибка при анализе: ' + e);
        }
    });

    // ---------- Получение фото из альбома ----------
    $fetchAlbumBtn.on('click', async function() {
        if (!accessToken) {
            log('Ошибка: нет токена');
            return;
        }
        const url = $albumUrl.val().trim();
        if (!url) {
            log('Введите ссылку на альбом');
            return;
        }

        // Парсим owner_id и album_id из URL
        let match = url.match(/album([\-0-9]+)_([0-9]+)/);
        if (!match) {
            log('Не удалось распознать альбом. Формат: https://vk.com/album-123_456');
            return;
        }
        const owner_id = parseInt(match[1]);
        const album_id = parseInt(match[2]);

        log(`Загружаем фото из альбома: owner_id=${owner_id}, album_id=${album_id}`);

        try {
            const photos = [];
            let offset = 0;
            const count = 1000; // макс 1000 за запрос
            let total = null;

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

            // Спрашиваем, скачивать ли
            if (photos.length > 0) {
                const useZip = $useZip.prop('checked');
                const start = parseInt($rangeStart.val()) || 0;
                const end = parseInt($rangeEnd.val()) || 0;
                const selectedPhotos = selectRange(photos, start, end);
                log(`Выбрано для скачивания: ${selectedPhotos.length} фото`);

                if (useZip) {
                    await downloadPhotosAsZip(selectedPhotos);
                } else {
                    await downloadPhotosSequential(selectedPhotos);
                }
            } else {
                log('Нет фото для скачивания');
            }
        } catch (e) {
            log('Ошибка при загрузке альбома: ' + e);
        }
    });

    // ---------- Основная функция для диалога (старт) ----------
    $startBtn.on('click', async function() {
        if (!accessToken) {
            log('Ошибка: нет токена');
            return;
        }

        const peerIdRaw = $peerInput.val().trim();
        const peerId = parseInt(peerIdRaw.replace(/\D/g, ''));
        if (isNaN(peerId)) {
            log('Ошибка: некорректный Peer ID');
            return;
        }

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

    // ---------- Функция архивации диалога ----------
    async function startArchiving(peerId, token, includePosts, saveTwitter, saveHashtags, saveMentions, useZip, rangeStart, rangeEnd) {
        let allMessages = [];
        let offset = 0;
        const count = 200;
        let total = null;

        try {
            while (total === null || offset < total) {
                const resp = await apiCall('messages.getHistory', `peer_id=${peerId}&offset=${offset}&count=${count}`);
                if (total === null) total = resp.count;
                allMessages = allMessages.concat(resp.items);
                offset += count;
                log(`Загружено ${allMessages.length} из ${total} сообщений...`);
            }
        } catch (e) {
            log('Ошибка при загрузке: ' + e);
            return;
        }

        log('Обработка сообщений...');
        const photos = [];
        const textItems = [];

        allMessages.forEach(msg => {
            const msgText = msg.text || '';
            const attachments = msg.attachments || [];

            const textInfo = {
                id: msg.id,
                from_id: msg.from_id,
                date: msg.date,
                text: msgText,
                twitter: [],
                hashtags: [],
                mentions: []
            };

            if (saveTwitter) textInfo.twitter = extractTwitterUrls(msgText);
            if (saveHashtags) textInfo.hashtags = extractHashtags(msgText);
            if (saveMentions) textInfo.mentions = extractMentions(msgText);

            if (textInfo.twitter.length || textInfo.hashtags.length || textInfo.mentions.length) {
                textItems.push(textInfo);
            }

            attachments.forEach(att => {
                if (att.type === 'photo') {
                    const url = getMaxSizePhotoUrl(att.photo);
                    if (url) photos.push(url);
                } else if (att.type === 'doc' && att.doc.type === 4) {
                    if (att.doc.url) photos.push(att.doc.url);
                } else if (att.type === 'wall' && includePosts) {
                    const postAttachments = att.wall.attachments || [];
                    postAttachments.forEach(postAtt => {
                        if (postAtt.type === 'photo') {
                            const url = getMaxSizePhotoUrl(postAtt.photo);
                            if (url) photos.push(url);
                        } else if (postAtt.type === 'doc' && postAtt.doc.type === 4) {
                            if (postAtt.doc.url) photos.push(postAtt.doc.url);
                        }
                    });
                }
            });
        });

        log(`Найдено фото: ${photos.length}`);
        $photoCount.text(photos.length);

        if (textItems.length) {
            log(`Найдено сообщений с текстовыми элементами: ${textItems.length}`);
        }

        // Применяем диапазон
        const selectedPhotos = selectRange(photos, rangeStart, rangeEnd);
        log(`Выбрано для скачивания: ${selectedPhotos.length} фото`);

        // Скачивание фото
        if (selectedPhotos.length > 0) {
            if (useZip) {
                log('Упаковка фото в ZIP-архив (параллельно)...');
                await downloadPhotosAsZip(selectedPhotos);
            } else {
                log('Скачивание фото по одному...');
                await downloadPhotosSequential(selectedPhotos);
            }
        } else {
            log('Нет фото для скачивания');
        }

        // Сохранение текста
        if (textItems.length > 0) {
            saveTextItems(textItems);
            log('Текстовые данные сохранены');
        }

        log('Архивация завершена!');
    }

    // Вспомогательная функция выбора диапазона
    function selectRange(array, start, end) {
        if (start <= 0 && end <= 0) return array; // все
        const s = Math.max(1, start) - 1; // к индексу с 0
        const e = (end > 0) ? end : array.length;
        return array.slice(s, e);
    }

    // ---------- Вспомогательные функции ----------
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

    // Скачивание по одному (с задержкой)
    function downloadPhotosSequential(urls) {
        return new Promise((resolve) => {
            let index = 0;
            function next() {
                if (index >= urls.length) {
                    log('Все фото скачаны');
                    resolve();
                    return;
                }
                const url = urls[index];
                const filename = `vk_photo_${Date.now()}_${index+1}.jpg`;

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    onload: function(response) {
                        const blob = response.response;
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        log(`Скачано ${index+1}/${urls.length}`);
                        index++;
                        setTimeout(next, 500);
                    },
                    onerror: function(err) {
                        log(`Ошибка скачивания ${url}: ${err}`);
                        index++;
                        next();
                    }
                });
            }
            next();
        });
    }

    // Параллельное скачивание в ZIP (до 5 одновременно)
    async function downloadPhotosAsZip(urls) {
        if (typeof JSZip === 'undefined') {
            log('❌ JSZip не загружен!');
            return;
        }
        log('JSZip загружен, начинаем параллельную загрузку фото...');

        const zip = new JSZip();
        const folder = zip.folder("vk_photos");
        const concurrency = 5; // количество одновременных загрузок
        let loaded = 0;
        let failed = 0;

        async function downloadOne(url, index) {
            try {
                log(`Загрузка фото ${index+1}/${urls.length}...`);
                const blob = await fetchBlob(url);
                if (blob.size === 0) throw new Error('Пустой blob');
                let ext = 'jpg';
                const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
                if (match) ext = match[1];
                const filename = `photo_${index+1}.${ext}`;
                folder.file(filename, blob);
                loaded++;
                log(`✅ Фото ${index+1} добавлено (${blob.size} байт)`);
            } catch (e) {
                failed++;
                log(`❌ Ошибка фото ${index+1}: ${e.message}`);
            }
        }

        // Разбиваем на батчи по concurrency
        for (let i = 0; i < urls.length; i += concurrency) {
            const batch = urls.slice(i, i + concurrency);
            const promises = batch.map((url, idx) => downloadOne(url, i + idx));
            await Promise.all(promises); // ждём завершения текущей группы
        }

        if (loaded === 0) {
            log('Нет загруженных фото. ZIP не создан.');
            return;
        }

        log(`Загружено ${loaded} фото. Генерация ZIP...`);
        try {
            const content = await zip.generateAsync({type: 'blob'});
            log(`ZIP сгенерирован, размер: ${content.size} байт`);
            const blobUrl = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `vk_photos_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            log('✅ ZIP-архив сохранён');
        } catch (e) {
            log('❌ Ошибка генерации ZIP: ' + e.message);
        }
    }

    function fetchBlob(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
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
        a.href = url;
        a.download = `vk_text_archive_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Инициализация
    updateTokenStatus();
    $zipWarning.toggle(!$useZip.prop('checked'));
})();
