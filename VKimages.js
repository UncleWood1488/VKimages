// ==UserScript==
// @name         VK Archiver (интегрированный)
// @namespace    http://tampermonkey.net/
// @version      7.3
// @description  Архивация фото, видео и текста из диалогов ВК + прогресс с объёмом файлов
// @author       UncleWood
// @match        *://vk.com/im*
// @match        *://*.vk.com/im*
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

    // ===== Стили (добавлен stats) =====
    GM_addStyle(`
        :root {
            --vk-modal-bg: #ffffff;
            --vk-modal-text: #000000;
            --vk-modal-border: #cccccc;
            --vk-modal-input: #ffffff;
            --vk-modal-log: #f5f5f5;
            --vk-modal-btn: #4a76a8;
            --vk-modal-btn-hover: #3a5e87;
            --vk-modal-shadow: rgba(0,0,0,0.3);
            --vk-overlay-bg: rgba(0,0,0,0.5);
        }
        .vk-dark-modal {
            --vk-modal-bg: #2d2d2d;
            --vk-modal-text: #e0e0e0;
            --vk-modal-border: #555555;
            --vk-modal-input: #444444;
            --vk-modal-log: #1e1e1e;
            --vk-modal-btn: #3a5e87;
            --vk-modal-btn-hover: #2a4a6a;
            --vk-modal-shadow: rgba(0,0,0,0.7);
            --vk-overlay-bg: rgba(0,0,0,0.8);
        }

        .vk-archiver-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: var(--vk-modal-btn);
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s;
            margin-left: 8px;
            font-weight: 500;
            height: 32px;
        }
        .vk-archiver-btn:hover {
            background: var(--vk-modal-btn-hover);
        }

        #vk-archive-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: var(--vk-overlay-bg);
            z-index: 10002;
            display: none;
            justify-content: center;
            align-items: center;
        }
        #vk-archive-modal {
            background: var(--vk-modal-bg);
            border-radius: 8px;
            padding: 20px;
            max-width: 480px;
            width: 92%;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 40px var(--vk-modal-shadow);
            color: var(--vk-modal-text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow-y: auto;
        }
        #vk-archive-modal h3 {
            margin: 0 0 10px;
            font-size: 18px;
            font-weight: 600;
            border-bottom: 1px solid var(--vk-modal-border);
            padding-bottom: 8px;
            color: var(--vk-modal-text);
        }
        #vk-archive-modal .section {
            margin-bottom: 18px;
            border-bottom: 1px solid var(--vk-modal-border);
            padding-bottom: 12px;
        }
        #vk-archive-modal .field {
            margin-bottom: 10px;
        }
        #vk-archive-modal label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 4px;
            color: var(--vk-modal-text);
        }
        #vk-archive-modal input[type="text"],
        #vk-archive-modal input[type="password"],
        #vk-archive-modal input[type="number"],
        #vk-archive-modal select {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid var(--vk-modal-border);
            border-radius: 4px;
            background: var(--vk-modal-input);
            color: var(--vk-modal-text);
            box-sizing: border-box;
            font-size: 13px;
        }
        #vk-archive-modal .checkbox-group {
            margin: 6px 0;
        }
        #vk-archive-modal .checkbox-group label {
            display: inline-block;
            margin-right: 15px;
            font-weight: normal;
            color: var(--vk-modal-text);
        }
        #vk-archive-modal button {
            background: var(--vk-modal-btn);
            color: white;
            border: none;
            padding: 7px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            margin-right: 6px;
            margin-bottom: 4px;
            transition: background 0.2s;
        }
        #vk-archive-modal button:hover {
            background: var(--vk-modal-btn-hover);
        }
        #vk-archive-modal .token-help {
            font-size: 12px;
            margin: 4px 0 8px;
            color: var(--vk-modal-text);
            opacity: 0.8;
        }
        #vk-archive-modal .token-help a {
            color: var(--vk-modal-btn);
            text-decoration: none;
        }
        #vk-archive-modal .token-help a:hover {
            text-decoration: underline;
        }
        #vk-archive-modal #vk-log {
            background: var(--vk-modal-log);
            border: 1px solid var(--vk-modal-border);
            border-radius: 4px;
            padding: 8px;
            height: 120px;
            overflow-y: auto;
            font-size: 12px;
            font-family: monospace;
            margin-top: 8px;
            white-space: pre-wrap;
            color: var(--vk-modal-text);
        }
        #vk-archive-modal .progress {
            font-size: 12px;
            margin-top: 6px;
            font-weight: 500;
            color: var(--vk-modal-text);
        }
        #vk-archive-modal .token-status {
            font-size: 13px;
            margin-bottom: 10px;
            color: ${accessToken ? 'green' : 'red'};
        }
        #vk-archive-modal .warning {
            color: #d32f2f;
            font-size: 12px;
            margin-top: 4px;
        }
        #vk-archive-modal .range-fields {
            display: flex;
            gap: 10px;
        }
        #vk-archive-modal .range-fields input {
            flex: 1;
        }
        #vk-archive-modal .modal-close {
            float: right;
            cursor: pointer;
            font-size: 22px;
            font-weight: bold;
            color: var(--vk-modal-text);
            opacity: 0.6;
            line-height: 1;
        }
        #vk-archive-modal .modal-close:hover {
            opacity: 1;
        }
        #vk-archive-modal .theme-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 5px 0;
        }
        #vk-archive-modal .theme-toggle label {
            font-weight: normal;
            cursor: pointer;
            color: var(--vk-modal-text);
        }
        #vk-progress-bar {
            width: 100%;
            height: 6px;
            background: var(--vk-modal-border);
            border-radius: 3px;
            margin: 6px 0 4px;
            overflow: hidden;
        }
        #vk-progress-bar .fill {
            height: 100%;
            background: var(--vk-modal-btn);
            width: 0%;
            transition: width 0.3s;
        }
        #vk-stats {
            font-size: 12px;
            color: var(--vk-modal-text);
            margin: 2px 0 6px;
            opacity: 0.9;
        }

        #vk-video-selection-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: var(--vk-overlay-bg);
            z-index: 10003;
            display: none;
            justify-content: center;
            align-items: center;
        }
        #vk-video-selection-dialog {
            background: var(--vk-modal-bg);
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 40px var(--vk-modal-shadow);
            color: var(--vk-modal-text);
        }
        #vk-video-selection-dialog h3 {
            margin-top: 0;
            border-bottom: 1px solid var(--vk-modal-border);
            padding-bottom: 10px;
            color: var(--vk-modal-text);
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
            border-bottom: 1px solid var(--vk-modal-border);
        }
        #vk-video-list .video-item input[type="checkbox"] {
            margin-right: 10px;
            flex-shrink: 0;
        }
        #vk-video-list .video-item label {
            font-size: 13px;
            cursor: pointer;
            word-break: break-word;
            color: var(--vk-modal-text);
        }
        #vk-video-selection-dialog .actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--vk-modal-border);
        }
        #vk-video-selection-dialog .actions button {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        #vk-video-selection-dialog .actions .btn-primary {
            background: var(--vk-modal-btn);
            color: white;
        }
        #vk-video-selection-dialog .actions .btn-primary:hover {
            background: var(--vk-modal-btn-hover);
        }
        #vk-video-selection-dialog .actions .btn-secondary {
            background: var(--vk-modal-border);
            color: var(--vk-modal-text);
        }
        #vk-video-selection-dialog .actions .btn-secondary:hover {
            background: var(--vk-modal-input);
        }
        .select-all {
            margin-bottom: 8px;
        }
        .select-all label {
            font-weight: normal;
            font-size: 13px;
            cursor: pointer;
            color: var(--vk-modal-text);
        }
    `);

    // ===== HTML =====
    const modalHTML = `
        <div id="vk-archive-overlay">
            <div id="vk-archive-modal">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin:0;">📦 Архиватор ВК</h3>
                    <span class="modal-close" id="vk-modal-close" title="Закрыть">✖</span>
                </div>
                <div style="margin-bottom: 8px; text-align: right;">
                    <a href="https://github.com/UncleWood1488/VKimages" target="_blank" style="color: var(--vk-modal-btn); text-decoration: none; font-size: 12px;">GitHub</a>
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
                    <button id="vk-save-token">Сохранить</button>
                    <button id="vk-clear-token">Очистить</button>
                </div>

                <div class="section">
                    <h4>Диалог</h4>
                    <div class="field">
                        <label>Peer ID (автоматически подставляется):</label>
                        <input type="text" id="vk-peer-id" placeholder="Например: 12345678" />
                    </div>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="vk-include-posts" /> Фото из репостов (медленнее)</label>
                    </div>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="vk-save-twitter" checked /> Twitter/X</label>
                        <label><input type="checkbox" id="vk-save-hashtags" checked /> #</label>
                        <label><input type="checkbox" id="vk-save-mentions" checked /> @</label>
                    </div>
                    <div>
                        <button id="vk-analyze-dialog">Анализ диалога (может быть долгим)</button>
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
                        <label>Разрешение:</label>
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
                        <label><input type="checkbox" id="vk-include-video-posts" /> Видео из репостов (медленнее)</label>
                        <label><input type="checkbox" id="vk-video-use-zip" checked /> Упаковать в ZIP (до 50 видео на архив)</label>
                    </div>
                    <button id="vk-download-videos">Скачать видео из диалога</button>
                </div>

                <div class="section">
                    <h4>Настройки фото</h4>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="vk-use-zip" checked /> Упаковать в ZIP (разбивка по 1000)</label>
                        <div class="warning" id="zip-warning" style="display:none;">⚠️ Скачивание по одному может быть заблокировано</div>
                    </div>
                    <div class="field">
                        <label>Диапазон фото (0 = все):</label>
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
                <div id="vk-progress-bar"><div class="fill" id="vk-progress-fill"></div></div>
                <div id="vk-stats">⏳ Ожидание...</div>
                <div id="vk-log"></div>
            </div>
        </div>
    `;

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

    $('body').append(modalHTML);
    $('body').append(selectionHTML);

    // ===== Элементы DOM =====
    const $overlay = $('#vk-archive-overlay');
    const $modal = $('#vk-archive-modal');
    const $closeBtn = $('#vk-modal-close');
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
    const $videoUseZip = $('#vk-video-use-zip');
    const $downloadVideosBtn = $('#vk-download-videos');
    const $themeToggle = $('#vk-theme-toggle');
    const $progressFill = $('#vk-progress-fill');
    const $stats = $('#vk-stats');

    const $videoOverlay = $('#vk-video-selection-overlay');
    const $videoList = $('#vk-video-list');
    const $selectAll = $('#vk-select-all-videos');
    const $downloadSelected = $('#vk-video-download-selected');
    const $cancelBtn = $('#vk-video-cancel');

    // ===== Вспомогательные функции =====
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

    function applyTheme(isDark) {
        if (isDark) {
            $modal.addClass('vk-dark-modal');
            $('#vk-video-selection-dialog').addClass('vk-dark-modal');
        } else {
            $modal.removeClass('vk-dark-modal');
            $('#vk-video-selection-dialog').removeClass('vk-dark-modal');
        }
        GM_setValue(DARK_THEME_KEY, isDark);
        darkThemeEnabled = isDark;
        $themeToggle.prop('checked', isDark);
    }

    let currentTotalFiles = 0;
    let currentLoadedFiles = 0;
    let currentTotalBytes = 0;
    let currentLoadedBytes = 0;

    function resetStats() {
        currentTotalFiles = 0;
        currentLoadedFiles = 0;
        currentTotalBytes = 0;
        currentLoadedBytes = 0;
        setProgress(0);
        updateStatsText();
    }

    function updateStatsText() {
        const totalMB = (currentTotalBytes / (1024*1024)).toFixed(1);
        const loadedMB = (currentLoadedBytes / (1024*1024)).toFixed(1);
        let text = `📁 Файлы: ${currentLoadedFiles}/${currentTotalFiles}`;
        if (currentTotalBytes > 0) {
            text += ` | 💾 ${loadedMB} MB / ${totalMB} MB`;
        } else {
            text += ` | 💾 размер определяется...`;
        }
        $stats.text(text);
    }

    function setProgress(percent) {
        $progressFill.css('width', Math.min(100, percent) + '%');
    }

    function getPeerIdFromUrl() {
        const url = window.location.href;
        const match = url.match(/[?&]sel=(-?\d+)/);
        return match ? match[1] : null;
    }

    function insertButton() {
        let container = document.querySelector('.im-mess-stack--actions');
        if (!container) container = document.querySelector('.im-dialog--header-actions');
        if (!container) container = document.querySelector('.im-mess-stack--toolbar');
        if (!container) {
            const header = document.querySelector('.im-dialog--header');
            if (header) {
                container = document.createElement('div');
                container.className = 'im-dialog--header-actions';
                header.appendChild(container);
            }
        }
        if (!container) return;
        if (container.querySelector('.vk-archiver-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'vk-archiver-btn';
        btn.innerHTML = '📦 Архиватор';
        btn.addEventListener('click', () => {
            const peer = getPeerIdFromUrl();
            if (peer && !$peerInput.val()) $peerInput.val(peer);
            $overlay.show();
        });
        container.appendChild(btn);
    }

    function initButton() {
        setTimeout(insertButton, 1000);
        const observer = new MutationObserver(() => insertButton());
        observer.observe(document.body, { childList: true, subtree: true });
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(insertButton, 500);
            }
        }, 1000);
    }

    // ===== API вызов =====
    function apiCall(method, params) {
        return new Promise((resolve, reject) => {
            const url = `https://api.vk.com/method/${method}?${params}&access_token=${accessToken}&v=5.131`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 30000,
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
                onerror: reject,
                ontimeout: () => reject('Таймаут API')
            });
        });
    }

    // ===== Получение вложений (оптимизировано) =====
    async function getPhotosFromDialog(peerId, includePosts) {
        if (!includePosts) {
            const photos = [];
            let startFrom = '';
            let total = null;
            while (total === null || photos.length < total) {
                const params = `peer_id=${peerId}&media_type=photo&count=200&start_from=${startFrom}`;
                const resp = await apiCall('messages.getHistoryAttachments', params);
                if (total === null) total = resp.count;
                const items = resp.items || [];
                for (const item of items) {
                    const photo = item.attachment.photo;
                    if (photo) {
                        const url = getMaxSizePhotoUrl(photo);
                        if (url) photos.push(url);
                    }
                }
                startFrom = resp.next_from || '';
                if (!startFrom) break;
                log(`Загружено ${photos.length} из ${total} фото...`);
            }
            return photos;
        } else {
            log('Включены репосты, загружаем все сообщения (может быть долго)...');
            const allMessages = await loadAllMessages(peerId);
            const photos = [];
            for (const msg of allMessages) {
                const attachments = msg.attachments || [];
                attachments.forEach(att => {
                    if (att.type === 'photo') {
                        const url = getMaxSizePhotoUrl(att.photo);
                        if (url) photos.push(url);
                    } else if (att.type === 'wall') {
                        const postAttachments = att.wall.attachments || [];
                        postAttachments.forEach(postAtt => {
                            if (postAtt.type === 'photo') {
                                const url = getMaxSizePhotoUrl(postAtt.photo);
                                if (url) photos.push(url);
                            }
                        });
                    }
                });
            }
            return photos;
        }
    }

    async function getVideosFromDialog(peerId, includePosts) {
        if (!includePosts) {
            const videos = [];
            let startFrom = '';
            let total = null;
            while (total === null || videos.length < total) {
                const params = `peer_id=${peerId}&media_type=video&count=200&start_from=${startFrom}`;
                const resp = await apiCall('messages.getHistoryAttachments', params);
                if (total === null) total = resp.count;
                const items = resp.items || [];
                for (const item of items) {
                    const video = item.attachment.video;
                    if (video) {
                        videos.push(video);
                    }
                }
                startFrom = resp.next_from || '';
                if (!startFrom) break;
                log(`Загружено ${videos.length} из ${total} видео...`);
            }
            return videos;
        } else {
            log('Включены репосты видео, загружаем все сообщения (может быть долго)...');
            const allMessages = await loadAllMessages(peerId);
            const videos = [];
            for (const msg of allMessages) {
                const attachments = msg.attachments || [];
                attachments.forEach(att => {
                    if (att.type === 'video') {
                        videos.push(att.video);
                    } else if (att.type === 'wall') {
                        const postAttachments = att.wall.attachments || [];
                        postAttachments.forEach(postAtt => {
                            if (postAtt.type === 'video') {
                                videos.push(postAtt.video);
                            }
                        });
                    }
                });
            }
            return videos;
        }
    }

    async function loadAllMessages(peerId) {
        let allMessages = [], offset = 0, count = 200, total = null;
        while (total === null || offset < total) {
            const resp = await apiCall('messages.getHistory', `peer_id=${peerId}&offset=${offset}&count=${count}`);
            if (total === null) total = resp.count;
            allMessages = allMessages.concat(resp.items);
            offset += count;
            log(`Загружено ${allMessages.length} из ${total} сообщений...`);
        }
        return allMessages;
    }

    // ===== Обработчики =====
    $closeBtn.on('click', () => $overlay.hide());
    $overlay.on('click', function(e) {
        if (e.target === this) $overlay.hide();
    });

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

    applyTheme(darkThemeEnabled);
    $themeToggle.on('change', function() {
        applyTheme($(this).prop('checked'));
    });

    $useZip.on('change', function() { $zipWarning.toggle(!this.checked); });
    $zipWarning.toggle(!$useZip.prop('checked'));

    $clearLog.on('click', () => $log.empty());

    // Анализ
    $analyzeBtn.on('click', async function() {
        if (!accessToken) { log('Ошибка: нет токена'); return; }
        const peerIdRaw = $peerInput.val().trim();
        const peerId = parseInt(peerIdRaw.replace(/\D/g, ''));
        if (isNaN(peerId)) { log('Ошибка: некорректный Peer ID'); return; }
        log('Анализ диалога... (это может занять время)');
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

    // Альбом
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

    // Скачать фото из диалога
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

        log('Получение фото из диалога...');
        let photos = await getPhotosFromDialog(peerId, includePosts);
        log(`Найдено фото: ${photos.length}`);
        $photoCount.text(photos.length);

        let textItems = [];
        if (saveTwitter || saveHashtags || saveMentions) {
            log('Загружаем сообщения для извлечения текстовых элементов...');
            const allMessages = await loadAllMessages(peerId);
            allMessages.forEach(msg => {
                const msgText = msg.text || '';
                const textInfo = {
                    id: msg.id, from_id: msg.from_id, date: msg.date, text: msgText,
                    twitter: [], hashtags: [], mentions: []
                };
                if (saveTwitter) textInfo.twitter = extractTwitterUrls(msgText);
                if (saveHashtags) textInfo.hashtags = extractHashtags(msgText);
                if (saveMentions) textInfo.mentions = extractMentions(msgText);
                if (textInfo.twitter.length || textInfo.hashtags.length || textInfo.mentions.length) {
                    textItems.push(textInfo);
                }
            });
            if (textItems.length) log(`Найдено сообщений с текстовыми элементами: ${textItems.length}`);
        }

        const selectedPhotos = selectRange(photos, start, end);
        log(`Выбрано для скачивания: ${selectedPhotos.length} фото`);

        resetStats();
        currentTotalFiles = selectedPhotos.length;
        currentTotalBytes = 0; // не знаем точный размер, будем считать по мере загрузки
        updateStatsText();

        if (selectedPhotos.length > 0) {
            if (useZip) {
                log('Упаковка фото в ZIP-архив (с разбиением)...');
                await downloadPhotosAsZip(selectedPhotos);
            } else {
                log('Скачивание фото по одному...');
                await downloadPhotosSequential(selectedPhotos);
            }
        } else { log('Нет фото для скачивания'); }

        if (textItems.length > 0) {
            saveTextItems(textItems);
            log('Текстовые данные сохранены');
        }
        log('Архивация завершена!');
    });

    // Видео
    $downloadVideosBtn.on('click', async function() {
        if (!accessToken) { log('Ошибка: нет токена'); return; }
        const peerIdRaw = $peerInput.val().trim();
        const peerId = parseInt(peerIdRaw.replace(/\D/g, ''));
        if (isNaN(peerId)) { log('Ошибка: некорректный Peer ID'); return; }
        const includePosts = $includeVideoPosts.prop('checked');
        const quality = $videoQuality.val();
        const useZip = $videoUseZip.prop('checked');

        log('Получение видео из диалога...');
        const allVideos = await getVideosFromDialog(peerId, includePosts);
        if (allVideos.length === 0) {
            log('Видео не найдены.');
            return;
        }
        log(`Найдено видео: ${allVideos.length}`);

        const availableVideos = allVideos.filter(video => {
            const url = getVideoDownloadUrl(video, quality);
            return url !== null;
        });
        if (availableVideos.length === 0) {
            log('Нет доступных видео для скачивания в выбранном качестве.');
            return;
        }
        log(`Доступно для скачивания: ${availableVideos.length} видео`);

        const selectedVideos = await showVideoSelectionDialog(availableVideos);
        if (!selectedVideos || selectedVideos.length === 0) {
            log('Выбор видео отменён или ничего не выбрано.');
            return;
        }
        log(`Выбрано для скачивания: ${selectedVideos.length} видео`);

        resetStats();
        currentTotalFiles = selectedVideos.length;
        currentTotalBytes = 0;
        updateStatsText();

        if (useZip) {
            log('Упаковка видео в ZIP-архивы (до 50 видео на архив)...');
            await downloadVideosAsZip(selectedVideos, quality);
        } else {
            await downloadSelectedVideos(selectedVideos, quality);
        }
    });

    // ===== Общие функции =====
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

    // ===== Функции скачивания фото с обновлением статистики =====
    function downloadPhotosSequential(urls) {
        return new Promise((resolve) => {
            let index = 0;
            function next() {
                if (index >= urls.length) {
                    setProgress(100);
                    updateStatsText();
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
                    timeout: 60000,
                    onload: function(response) {
                        const blob = response.response;
                        const size = blob.size;
                        currentLoadedBytes += size;
                        currentLoadedFiles++;
                        updateStatsText();
                        const progress = (currentLoadedFiles / currentTotalFiles) * 100;
                        setProgress(progress);

                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl; a.download = filename;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        log(`Скачано ${index+1}/${urls.length}`);
                        index++; setTimeout(next, 500);
                    },
                    onerror: function(err) {
                        log(`Ошибка скачивания ${url}: ${err}`);
                        currentLoadedFiles++;
                        updateStatsText();
                        index++; next();
                    }
                });
            }
            next();
        });
    }

    async function downloadPhotosAsZip(urls) {
        if (typeof JSZip === 'undefined') {
            log('❌ JSZip не загружен!');
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
            let loaded = 0;

            for (let i = 0; i < chunkUrls.length; i++) {
                const url = chunkUrls[i];
                try {
                    const blob = await fetchBlob(url);
                    if (blob.size === 0) throw new Error('Пустой blob');
                    let ext = 'jpg';
                    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
                    if (match) ext = match[1];
                    const filename = `photo_${startIdx + i + 1}.${ext}`;
                    folder.file(filename, blob);
                    loaded++;
                    currentLoadedBytes += blob.size;
                    currentLoadedFiles++;
                    updateStatsText();
                    const progress = (currentLoadedFiles / currentTotalFiles) * 100;
                    setProgress(progress);
                    if (i % 10 === 0) log(`  Загружено ${i+1}/${chunkUrls.length}...`);
                } catch (e) {
                    log(`  ❌ Ошибка фото ${i+1}: ${e.message}`);
                    currentLoadedFiles++;
                    updateStatsText();
                }
                // обновляем прогресс
                const progress = (currentLoadedFiles / currentTotalFiles) * 100;
                setProgress(progress);
            }

            if (loaded === 0) {
                log(`Архив ${chunk+1} пуст, пропускаем`);
                continue;
            }

            log(`Архив ${chunk+1}: загружено ${loaded} фото. Генерируем ZIP...`);
            try {
                const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
                const blobUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `vk_photos_${Date.now()}_part${chunk+1}.zip`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                log(`✅ Архив ${chunk+1} сохранён`);
            } catch (e) {
                log(`❌ Ошибка генерации архива ${chunk+1}: ${e.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setProgress(100);
        updateStatsText();
        log('Все архивы обработаны');
    }

    function fetchBlob(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                timeout: 120000,
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
                ontimeout: () => reject(new Error('Таймаут загрузки'))
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

    // ===== Видео-функции с обновлением статистики =====
    function getVideoDownloadUrl(video, quality) {
        const files = video.files;
        if (!files) return null;
        const qualities = ['1080', '720', '480', '360', '240'];
        if (quality === 'best') {
            for (const q of qualities) {
                const key = 'mp4_' + q;
                if (files[key]) return files[key];
            }
            if (files.mp4) return files.mp4;
            if (files.flv) return files.flv;
            return null;
        } else {
            const target = parseInt(quality);
            const key = 'mp4_' + quality;
            if (files[key]) return files[key];
            const available = qualities.filter(q => files['mp4_' + q]).map(q => parseInt(q));
            if (available.length === 0) {
                if (files.mp4) return files.mp4;
                if (files.flv) return files.flv;
                return null;
            }
            available.sort((a,b) => b - a);
            for (const q of available) {
                if (q <= target) return files['mp4_' + q];
            }
            return files['mp4_' + available[available.length - 1]];
        }
    }

    async function downloadSelectedVideos(videos, quality) {
        let successCount = 0;
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const url = getVideoDownloadUrl(video, quality);
            if (!url) {
                log(`[${i+1}/${videos.length}] Видео ${video.id} не доступно`);
                currentLoadedFiles++;
                updateStatsText();
                continue;
            }
            const title = video.title || `video_${video.id}`;
            const filename = `vk_video_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${video.id}.mp4`;
            log(`[${i+1}/${videos.length}] Скачиваем: ${title}`);
            try {
                await downloadSingleFile(url, filename);
                successCount++;
                currentLoadedFiles++;
                // размер прибавится в downloadSingleFile
            } catch (e) {
                log(`[${i+1}/${videos.length}] Ошибка: ${e.message}`);
                currentLoadedFiles++;
                updateStatsText();
            }
            const progress = (currentLoadedFiles / currentTotalFiles) * 100;
            setProgress(progress);
            updateStatsText();
        }
        setProgress(100);
        updateStatsText();
        log(`Скачано видео: ${successCount} из ${videos.length}`);
    }

    async function downloadVideosAsZip(videos, quality) {
        if (typeof JSZip === 'undefined') {
            log('❌ JSZip не загружен, переключение на одиночное скачивание');
            await downloadSelectedVideos(videos, quality);
            return;
        }

        const MAX_PER_ZIP = 50;
        const totalChunks = Math.ceil(videos.length / MAX_PER_ZIP);
        let allSuccess = true;

        for (let chunk = 0; chunk < totalChunks; chunk++) {
            const startIdx = chunk * MAX_PER_ZIP;
            const endIdx = Math.min(startIdx + MAX_PER_ZIP, videos.length);
            const chunkVideos = videos.slice(startIdx, endIdx);

            log(`Архив ${chunk+1}/${totalChunks}: обрабатываем видео ${startIdx+1}–${endIdx}...`);

            const zip = new JSZip();
            const folder = zip.folder("vk_videos");
            let loaded = 0;

            for (let i = 0; i < chunkVideos.length; i++) {
                const video = chunkVideos[i];
                const url = getVideoDownloadUrl(video, quality);
                if (!url) {
                    log(`  Видео ${video.id} не доступно, пропускаем`);
                    currentLoadedFiles++;
                    updateStatsText();
                    continue;
                }
                const title = video.title || `video_${video.id}`;
                const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${video.id}.mp4`;
                log(`  Загружаем: ${title}`);
                try {
                    const blob = await fetchBlob(url);
                    if (blob.size === 0) throw new Error('Пустой файл');
                    folder.file(filename, blob);
                    loaded++;
                    currentLoadedBytes += blob.size;
                    currentLoadedFiles++;
                    updateStatsText();
                } catch (e) {
                    log(`  ❌ Ошибка загрузки: ${e.message}`);
                    allSuccess = false;
                    currentLoadedFiles++;
                    updateStatsText();
                }
                const progress = (currentLoadedFiles / currentTotalFiles) * 100;
                setProgress(progress);
                updateStatsText();
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            if (loaded === 0) {
                log(`  Архив ${chunk+1} пуст, пропускаем`);
                continue;
            }

            log(`  Архив ${chunk+1}: загружено ${loaded} видео. Генерируем ZIP...`);
            try {
                const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
                const blobUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `vk_videos_${Date.now()}_part${chunk+1}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                log(`✅ Архив ${chunk+1} сохранён (${loaded} видео)`);
            } catch (e) {
                log(`❌ Ошибка генерации ZIP: ${e.message}`);
                allSuccess = false;
                log('Пытаемся скачать оставшиеся видео по одному...');
                const remaining = videos.slice(startIdx + loaded);
                if (remaining.length > 0) {
                    await downloadSelectedVideos(remaining, quality);
                }
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        setProgress(100);
        updateStatsText();
        if (allSuccess) {
            log('Все видео успешно упакованы в ZIP-архивы');
        } else {
            log('Некоторые видео не удалось добавить в архивы (они были пропущены или скачаны по отдельности)');
        }
    }

    function downloadSingleFile(url, filename) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                timeout: 120000,
                onload: function(response) {
                    if (response.status !== 200) {
                        reject(new Error(`HTTP ${response.status}`));
                        return;
                    }
                    const blob = response.response;
                    const size = blob.size;
                    currentLoadedBytes += size;
                    // currentLoadedFiles увеличивается в вызывающей функции
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
                onerror: () => reject(new Error('Ошибка сети')),
                ontimeout: () => reject(new Error('Таймаут загрузки'))
            });
        });
    }

    // ===== Диалог выбора видео =====
    function showVideoSelectionDialog(videos) {
        return new Promise((resolve) => {
            $videoList.empty();
            videos.forEach((video, index) => {
                const title = video.title || `Видео #${video.id}`;
                const div = $('<div class="video-item"></div>');
                const checkbox = $('<input type="checkbox" data-index="' + index + '" />');
                const label = $('<label></label>').text(title);
                div.append(checkbox, label);
                $videoList.append(div);
            });

            $selectAll.prop('checked', false);
            $selectAll.off('change').on('change', function() {
                const checked = $(this).prop('checked');
                $videoList.find('input[type="checkbox"]').prop('checked', checked);
            });

            $cancelBtn.off('click').on('click', function() {
                $videoOverlay.hide();
                resolve(null);
            });

            $downloadSelected.off('click').on('click', function() {
                const selected = [];
                $videoList.find('input[type="checkbox"]:checked').each(function() {
                    const idx = parseInt($(this).data('index'));
                    selected.push(videos[idx]);
                });
                $videoOverlay.hide();
                resolve(selected);
            });

            $videoOverlay.show();
        });
    }

    $videoOverlay.on('click', function(e) {
        if (e.target === this) {
            $videoOverlay.hide();
        }
    });

    // ===== Инициализация =====
    updateTokenStatus();
    initButton();

    GM_registerMenuCommand('Открыть архиватор', () => {
        const peer = getPeerIdFromUrl();
        if (peer && !$peerInput.val()) $peerInput.val(peer);
        $overlay.show();
    });

})();