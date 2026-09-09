// ==UserScript==
// @name         로어 구문 싹둑이
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  싹둑싹둑데스네~
// @author       ㅇㅇ
// @match        https://crack.wrtn.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crack.wrtn.ai
// @connect      crack-api.wrtn.ai
// @connect      contents-api.wrtn.ai
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// ==/UserScript==

const STORAGE_KEY = 'LORE-SSAKDOOK';
let CHAT_ID = location.pathname.split('/').filter(Boolean).pop();
let CUT_COUNT = 10;
let HIDE_LORE = true;
let CUT_LORE = true;
const ASSISTANT_MESSAGE_CLASS = '.css-10wlg6j';
const USER_MESSAGE_CLASS = '.css-hzlkcy';
let messageObserver = null;

window.addEventListener('beforeunload', () => {
    messageObserver?.disconnect();
});

// 저장된 설정 불러오기
function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return;
        }

        const settings = JSON.parse(saved);

        if (typeof settings.CUT_LORE === 'boolean') {
            CUT_LORE = settings.CUT_LORE;
        }

        if (Number.isFinite(settings.CUT_COUNT)) {
            CUT_COUNT = Math.max(0, settings.CUT_COUNT);
        }

        if (typeof settings.HIDE_LORE === 'boolean') {
            HIDE_LORE = settings.HIDE_LORE;
        }
    } catch (error) {
        console.error('설정 불러오기 실패:', error);
    }
}

// 설정 저장
function saveSettings() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                CUT_LORE,
                CUT_COUNT,
                HIDE_LORE,
            })
        );
    } catch (error) {
        console.error('설정 저장 실패:', error);
    }
}

// ===================================================================================================
// =========================UIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUI==========================
// =========================UIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUI==========================
// =========================UIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUIUI==========================
// ===================================================================================================

function createSettingsUI() {
    const host = document.querySelector('[data-sgb-main-host]');
    const target = host?.querySelector('button[role="combobox"]');

    if (!target) {
        setTimeout(createSettingsUI, 500);
        return;
    }

    const parent = target.parentElement;

    if (!parent || document.querySelector('#lore-settings-button')) {
        return;
    }


    // ─────────────────────────────
    // 스타일
    // ─────────────────────────────

    const style = document.createElement('style');

    style.textContent = `
        #lore-settings-button {
            width: 40px;
            height: 40px;
            padding: 0;
            margin: 0;
            border: 0;
            border-radius: 10px;
            background: transparent;
            color: #a1a1aa;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition:
                background 0.15s ease,
                color 0.15s ease;
        }

        #lore-settings-button:hover {
            background: #27272a;
            color: #f4f4f5;
        }

        #lore-settings-button svg {
            width: 19px;
            height: 19px;
        }

        #lore-settings-overlay {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0, 0, 0, 0.62);
            backdrop-filter: blur(4px);
        }

        #lore-settings-modal {
            width: min(390px, calc(100vw - 40px));
            box-sizing: border-box;
            border: 1px solid #3f3f46;
            border-radius: 16px;
            background: #18181b;
            color: #f4f4f5;
            box-shadow:
                0 24px 60px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.02);
            overflow: hidden;
            animation: lore-settings-show 0.16s ease-out;
        }

        @keyframes lore-settings-show {
            from {
                opacity: 0;
                transform: translateY(8px) scale(0.98);
            }

            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        #lore-settings-header {
            padding: 20px 22px 16px;
            border-bottom: 1px solid #27272a;
        }

        #lore-settings-title {
            margin: 0;
            font-size: 17px;
            font-weight: 600;
            letter-spacing: -0.02em;
        }

        #lore-settings-description {
            margin-top: 5px;
            color: #71717a;
            font-size: 12px;
            line-height: 1.5;
        }

        #lore-settings-body {
            padding: 6px 22px 20px;
        }

        .lore-setting-row {
            padding: 16px 0;
        }

        .lore-setting-row.lore-section-end {
            border-bottom: 1px solid #27272a;
        }

        .lore-setting-label {
            display: block;
            margin-bottom: 7px;
            color: #f4f4f5;
            font-size: 13px;
            font-weight: 500;
        }

        .lore-setting-description {
            margin-bottom: 10px;
            color: #71717a;
            font-size: 12px;
            line-height: 1.45;
        }

        #lore-cut-count {
            width: 100%;
            height: 38px;
            box-sizing: border-box;
            padding: 0 11px;
            border: 1px solid #3f3f46;
            border-radius: 8px;
            outline: none;
            background: #27272a;
            color: #f4f4f5;
            font: inherit;
            font-size: 13px;
            transition:
                border-color 0.15s ease,
                background 0.15s ease;
        }

        #lore-cut-count:hover {
            background: #2f2f33;
        }

        #lore-cut-count:focus {
            border-color: #71717a;
            background: #2f2f33;
        }

        .lore-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: -20px
        }

        .lore-switch {
            position: relative;
            width: 38px;
            height: 22px;
            flex-shrink: 0;
        }

        .lore-switch input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }

        .lore-switch-track {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            background: #3f3f46;
            cursor: pointer;
            transition: background 0.15s ease;
        }

        .lore-switch-track::after {
            content: '';
            position: absolute;
            top: 3px;
            left: 3px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #d4d4d8;
            transition: transform 0.15s ease;
        }

        .lore-switch input:checked + .lore-switch-track {
            background: #e4e4e7;
        }

        .lore-switch input:checked + .lore-switch-track::after {
            background: #18181b;
            transform: translateX(16px);
        }

        #lore-settings-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 14px 22px;
            border-top: 1px solid #27272a;
            background: #161619;
        }

        .lore-settings-btn {
            height: 34px;
            padding: 0 13px;
            border-radius: 8px;
            border: 1px solid #3f3f46;
            font: inherit;
            font-size: 12px;
            cursor: pointer;
            transition:
                background 0.15s ease,
                border-color 0.15s ease;
        }

        #lore-settings-cancel {
            background: #27272a;
            color: #d4d4d8;
        }

        #lore-settings-cancel:hover {
            background: #303037;
            border-color: #52525b;
        }

        #lore-settings-save {
            border-color: #e4e4e7;
            background: #e4e4e7;
            color: #18181b;
            font-weight: 600;
        }

        #lore-settings-save:hover {
            background: #fafafa;
        }
    `;

    document.head.appendChild(style);


    // ─────────────────────────────
    // 설정 버튼
    // ─────────────────────────────

    const button = document.createElement('button');

    button.id = 'lore-settings-button';
    button.type = 'button';
    button.title = '설정';

    button.innerHTML = `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.92 1.92-.06-.06A1.7 1.7 0 0 0 16 18.46a1.7 1.7 0 0 0-1 .54 1.7 1.7 0 0 0-.46 1.18V21h-2.72v-.82A1.7 1.7 0 0 0 10.8 19a1.7 1.7 0 0 0-2.06-.39l-.71.41-1.36-2.35.71-.41A1.7 1.7 0 0 0 8.1 14.2a1.7 1.7 0 0 0-1.55-1.19H5.7V10.3h.85A1.7 1.7 0 0 0 8.1 9.1a1.7 1.7 0 0 0-.32-1.63l-.4-.54 2.2-1.6.42.57A1.7 1.7 0 0 0 11.5 6.6c.47-.11.88-.38 1.15-.76.23-.33.35-.73.35-1.13V4h2.72v.72c0 .4.12.8.35 1.13.27.38.68.65 1.15.76a1.7 1.7 0 0 0 1.72-.7l.42-.57 2.2 1.6-.4.54a1.7 1.7 0 0 0-.32 1.63c.19.62.75 1.09 1.4 1.19h.85v2.72h-.85A1.7 1.7 0 0 0 19.4 15Z"/>
        </svg>
    `;

    parent.insertBefore(button, parent.firstElementChild);


    // ─────────────────────────────
    // 모달
    // ─────────────────────────────

    const overlay = document.createElement('div');

    overlay.id = 'lore-settings-overlay';

    overlay.innerHTML = `
        <div id="lore-settings-modal" role="dialog" aria-modal="true">

            <div id="lore-settings-header">
                <h2 id="lore-settings-title">Lore SSAK-DOOK</h2>
                <div id="lore-settings-description">
                    로어구문 삭제 여부 및 숨김 여부를 설정합니다.
                </div>
            </div>

            <div id="lore-settings-body">

                <div class="lore-setting-row lore-toggle-row">
                    <div>
                        <div class="lore-setting-label">
                            로어 삭제
                        </div>

                        <div class="lore-setting-description">
                            유지 턴이 지난 후 Lore 구문 삭제 처리를 활성화합니다.
                        </div>
                    </div>

                    <label class="lore-switch">
                        <input
                            id="lore-cut-lore"
                            type="checkbox"
                            ${CUT_LORE ? 'checked' : ''}
                        >
                        <span class="lore-switch-track"></span>
                    </label>
                </div>

                <div class="lore-setting-row lore-section-end">
                    <label
                        class="lore-setting-label"
                        for="lore-cut-count"
                    >
                        로어 유지 턴 수
                    </label>

                    <div class="lore-setting-description">
                        AI에게 전달되도록 로어를 유지할 최신 "유저" 메시지 개수입니다.
                    </div>

                    <input
                        id="lore-cut-count"
                        type="number"
                        min="0"
                        step="1"
                        value="${CUT_COUNT}"
                    >
                </div>

                <div class="lore-setting-row lore-toggle-row">
                    <div>
                        <div class="lore-setting-label">
                            로어 숨기기
                        </div>

                        <div class="lore-setting-description">
                            <ooc_lore_context> 내용을 채팅UI에서 숨깁니다.<br>변경 시 새로고침 후 적용됩니다.
                        </div>
                    </div>

                    <label class="lore-switch">
                        <input
                            id="lore-hide-lore"
                            type="checkbox"
                            ${HIDE_LORE ? 'checked' : ''}
                        >
                        <span class="lore-switch-track"></span>
                    </label>
                </div>

            </div>

            <div id="lore-settings-footer">
                <button
                    id="lore-settings-cancel"
                    class="lore-settings-btn"
                    type="button"
                >
                    취소
                </button>

                <button
                    id="lore-settings-save"
                    class="lore-settings-btn"
                    type="button"
                >
                    저장
                </button>
            </div>

        </div>
    `;

    document.body.appendChild(overlay);


    // ─────────────────────────────
    // 열기
    // ─────────────────────────────

    button.addEventListener('click', () => {
        overlay.style.display = 'flex';

        overlay.querySelector('#lore-cut-lore').checked = CUT_LORE;
        overlay.querySelector('#lore-cut-count').value = CUT_COUNT;
        overlay.querySelector('#lore-hide-lore').checked = HIDE_LORE;
    });


    // ─────────────────────────────
    // 닫기
    // ─────────────────────────────

    const closeModal = () => {
        overlay.style.display = 'none';
    };

    overlay.querySelector('#lore-settings-cancel')
        .addEventListener('click', closeModal);

    let pointerDownTarget = null;

    overlay.addEventListener('pointerdown', event => {
        pointerDownTarget = event.target;
    });

    overlay.addEventListener('pointerup', event => {
        if (
            pointerDownTarget === overlay &&
            event.target === overlay
        ) {
            closeModal();
        }

        pointerDownTarget = null;
    });

    document.addEventListener('keydown', event => {
        if (
            event.key === 'Escape' &&
            overlay.style.display !== 'none'
        ) {
            closeModal();
        }
    });


    // ─────────────────────────────
    // 저장
    // ─────────────────────────────

    overlay.querySelector('#lore-settings-save')
        .addEventListener('click', () => {
        const cutLoreInput =
              overlay.querySelector('#lore-cut-lore');

        const cutCountInput =
              overlay.querySelector('#lore-cut-count');

        const hideLoreInput =
              overlay.querySelector('#lore-hide-lore');

        const cutCount =
              Number.parseInt(cutCountInput.value, 10);

        CUT_LORE = cutLoreInput.checked;

        CUT_COUNT = Number.isFinite(cutCount)
            ? Math.max(0, cutCount)
        : 10;

        HIDE_LORE = hideLoreInput.checked;

        saveSettings();

        closeModal();
    });
}

// ===================================================================================================
// ===================================================================================================
// ===================================================================================================
// ===================================================================================================
// ===================================================================================================

function getHeaders (){
    const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('access_token='))
    ?.split('=').slice(1).join('=');

    if (!token) {
        console.error('[ERROR] access_token을 찾지 못했습니다.');
        return;
    }

    const headers = {
        Authorization: `Bearer ${decodeURIComponent(token)}`,
        Accept: 'application/json, text/plain, */*',
        platform: 'web',
        'wrtn-locale': 'ko-KR',
    }
    return headers;
}

function gmRequest(options) {
    return new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
            ...options,
            onload: resolve,
            onerror: reject,
            ontimeout: () => reject(new Error('요청 시간 초과')),
        });
    });
}

async function fetchMessages(limit) {
    const url =
          `https://crack-api.wrtn.ai/crack-gen/v3/chats/${CHAT_ID}/messages?limit=${limit}`;

    const res = await gmRequest({
        method: 'GET',
        url,
        headers: getHeaders(),
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(`메시지 목록 GET 실패: ${res.status}`);
    }

    const data = JSON.parse(res.responseText);

    return data?.data?.messages || data?.messages || [];
}

async function patchMessage(messageId, content) {
    const url =
          `https://contents-api.wrtn.ai/character-chat/v3/chats/${CHAT_ID}/messages/${messageId}`;

    const res = await gmRequest({
        method: 'PATCH',
        url,
        headers: {
            ...getHeaders(),
            'Content-Type': 'application/json',
        },
        data: JSON.stringify({
            message: content,
        }),
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(
            `PATCH 실패 (${res.status}): ${res.responseText}`
        );
    }
    return res;
}

function findLoreEndNode(node) {
    if(node.textContent.includes('</ooc_lore_context>')){
        for (const child of node.children) {
            const found = findLoreEndNode(child);

            if (found) {
                return found;
            }
        }
        return node;
    }
    return null
}

function normalizeLoreOOC(userMessage) {
    const childNodes = userMessage.childNodes;

    for (const node of childNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const loreStartContext = node.textContent.includes('<ooc_lore_context>');
        const loreEndContext = node.textContent.includes('</ooc_lore_context>');

        if (loreStartContext) {
            const html = node.innerHTML;
            const loreStartIndex = html.indexOf('&lt;ooc_lore_context&gt;');

            if (loreStartIndex > 0){
                const beforeLore = html.slice(0, loreStartIndex).trim();

                if (beforeLore) {
                    const p = document.createElement('p');
                    p.innerHTML = beforeLore;

                    node.before(p);
                    node.innerHTML = html.slice(loreStartIndex);
                };
            };
        };

        if (loreEndContext) {
            const currentNode = findLoreEndNode(node);
            const html = currentNode.innerHTML;
            const endTag = '&lt;/ooc_lore_context&gt;';
            const loreEndIndex = html.indexOf(endTag);

            const afterLore = html.slice(loreEndIndex + endTag.length).trim();

            if(afterLore){
                if (afterLore.length > 0){

                    const p = document.createElement('p');
                    p.innerHTML = afterLore;

                    node.after(p);
                    node.innerHTML = html.slice(0, loreEndIndex + endTag.length).trim();
                };
            };
        }
    }
}

function removeLoreOOC(userMessage) {
    const childNodes = [...userMessage.childNodes];

    let loreStartNode = null;
    let loreEndNode = null;

    for (const node of childNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (!loreStartNode && node.textContent.includes('<ooc_lore_context>')) {
            loreStartNode = node;
        }

        if (!loreEndNode && node.textContent.includes('</ooc_lore_context>')) {
            loreEndNode = node;
        }

        if (loreStartNode && loreEndNode) {
            break;
        }
    }

    if (loreStartNode && loreEndNode) {
        let deleting = false;

        for (const node of childNodes) {
            if (node === loreStartNode) {
                deleting = true;
            }

            if (deleting) {
                node.remove();
            }

            if (node === loreEndNode) {
                break;
            }
        }
    }
}

function processLoreOOC(userMessage) {
    const hasOOCStart = [...userMessage.childNodes].find(node => node.textContent.includes('<ooc_lore_context>'));
    const hasOOCEnd = [...userMessage.childNodes].find(node => node.textContent.includes('</ooc_lore_context>'));

    if (!hasOOCStart || !hasOOCEnd || !HIDE_LORE) return;

    normalizeLoreOOC(userMessage)
    removeLoreOOC(userMessage)
}

async function removeLoreOOConServer() {
    if (!CUT_LORE) return;
    const messagesObjects = await fetchMessages((CUT_COUNT+10)*2);

    const userMessages = messagesObjects.filter(messagesObject => messagesObject.role === 'user').slice(CUT_COUNT);

    for (const message of userMessages) {
        const originalContent = message.content;

        const newContent = originalContent.replace(
            /(\n*)<ooc_lore_context>[\s\S]*?<\/ooc_lore_context>(\n*)/gi,
            (match, beforeNewlines, afterNewlines, offset, whole) => {
                const before = whole.slice(0, offset);

                if (before.trim()) {
                    return '\n';
                }

                return '';
            }
        );

        if (!newContent.trim()) {
            newContent = '.';
        }

        const isChanged = newContent !== originalContent;

        if (isChanged) {
            message.content = newContent;
            await patchMessage(message._id, newContent);
        }
    }
}

function createMutationObserver(messageContainer) {
    messageObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if(mutation.type === 'childList'){
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof Element)) {
                        continue;
                    }

                    // 수정했을 때 UI 교체
                    if (node.matches(USER_MESSAGE_CLASS)) {
                        processLoreOOC(node);
                    }

                    // 새 요소가 들어올 때 UI 교체
                    if (node.matches('[data-message-group-id]') && node.querySelector(USER_MESSAGE_CLASS)) {
                        processLoreOOC(node.querySelector(USER_MESSAGE_CLASS));
                    }

                    // 새 응답이 추가될 때 서버에서 정해진 턴 이전의 로어구문 삭제
                    if (
                        node.matches('[data-message-group-id]') &&
                        !node.previousElementSibling?.matches('[data-message-group-id]') &&
                        node.querySelector(ASSISTANT_MESSAGE_CLASS)
                    ){
                        removeLoreOOConServer()
                    }
                }
            }
        }
    });

    messageObserver.observe(messageContainer, {
        childList: true,
        subtree: true,
        characterData: true,
    });
}

/**
 * 메시지 그룹 부모 감시
 */
function observeNewMessageGroups() {
    const messageGroup = document.querySelector(
        '[data-sgb-message-group]'
    );

    if (!messageGroup) {
        setTimeout(observeNewMessageGroups, 500);
        return;
    }

    const messageContainer = messageGroup.parentElement;

    if (!messageContainer) {
        return;
    }

    const userMessages = messageContainer.querySelectorAll(USER_MESSAGE_CLASS);

    for(const message of userMessages) {
        processLoreOOC(message);
    }

    if (messageObserver) {
        messageObserver.disconnect();
        messageObserver = null;
    }

    createMutationObserver(messageContainer);

    console.log('[Lore SSAKDOOK] 가위질 준비 완료. 싹둑!');
}

loadSettings();
createSettingsUI();
observeNewMessageGroups();
