// ==UserScript==
// @name         유저 메시지 클리너
// @namespace    message.cleaner.crack.api
// @version      1.0.0
// @description  유저 메시지 클리너
// @match        https://crack.wrtn.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crack.wrtn.ai
// @connect      crack-api.wrtn.ai
// @connect      contents-api.wrtn.ai
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// ==/UserScript==

const CHAT_ID = '';
const ASSISTANT_PANEL_ID = '.css-10wlg6j';
const currentChatId = window.location.pathname.match( /\/stories\/[^/]+\/episodes\/([^/]+)/ )?.[1];
const DB_NAME = 'MessageCleanerDB';
const DB_VERSION = 1;
const STORE_NAME = 'userMessages';
const EMPTY_CONTENT = '.';
let messageObserver = null;

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

function openBackupDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: '_id',
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveLatestUserMessage(message) {
    localStorage.setItem(
        'MessageCleaner_latestUserMessage',
        JSON.stringify({
            savedAt: Date.now(),
            _id: message._id,
            turnId: message.turnId,
            chatId: message.chatId,
            content: message.content,
        })
    );
}

function createLatestUserMessageButton() {
    const existingButton = document.querySelector(
        '[data-message-cleaner-latest-user]'
    );

    if (existingButton) {
        return;
    }

    const cbeButton = document.querySelector('#cbe-launch');

    if (!cbeButton) {
        return;
    }

    const toolbar = cbeButton.parentElement;

    if (!toolbar) {
        return;
    }

    const button = document.createElement('button');

    button.type = 'button';
    button.dataset.messageCleanerLatestUser = 'true';
    button.title = '최근 User 메시지';
    button.setAttribute('aria-label', '최근 User 메시지');

    button.className = `
        relative inline-flex items-center gap-1 rounded-full text-sm leading-none
        transition-colors focus:outline-none focus-visible:ring-2
        focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50
        min-w-7 border border-border bg-card text-line-gray-1
        hover:bg-secondary size-7 justify-center p-0 font-bold
    `;

    button.textContent = 'U';

    button.addEventListener('click', () => {
        showLatestUserMessage();
    });

    toolbar.appendChild(button);
}

function showLatestUserMessage() {
    const raw = localStorage.getItem(
        'MessageCleaner_latestUserMessage'
    );

    if (!raw) {
        alert('저장된 User 메시지가 없습니다.');
        return;
    }

    let message;

    try {
        message = JSON.parse(raw);
    } catch (error) {
        console.error('[MessageCleaner] 최신 메시지 파싱 실패:', error);
        return;
    }

    const existingPanel = document.querySelector(
        '[data-message-cleaner-panel]'
    );

    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');

    panel.dataset.messageCleanerPanel = 'true';

    Object.assign(panel.style, {
        position: 'fixed',
        top: '60px',
        right: '20px',
        width: '500px',
        maxHeight: '70vh',
        zIndex: '999999',
        background: 'var(--background, #fff)',
        border: '1px solid var(--border, #ddd)',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    });

    const header = document.createElement('div');

    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: 'bold',
    });

    header.textContent = '최근 User 메시지';

    const closeButton = document.createElement('button');

    closeButton.textContent = '×';

    Object.assign(closeButton.style, {
        border: 'none',
        background: 'transparent',
        fontSize: '20px',
        cursor: 'pointer',
    });

    closeButton.addEventListener('click', () => {
        panel.remove();
    });

    header.appendChild(closeButton);

    const meta = document.createElement('div');

    Object.assign(meta.style, {
        fontSize: '11px',
        opacity: '0.6',
    });

    meta.textContent = `_id: ${message._id}`;

    const content = document.createElement('textarea');

    content.value = message.content || '';
    content.readOnly = true;

    Object.assign(content.style, {
        width: '100%',
        minHeight: '300px',
        resize: 'vertical',
        boxSizing: 'border-box',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid var(--border, #ddd)',
        background: 'var(--card, #f8f8f8)',
        color: 'inherit',
        fontFamily: 'inherit',
        fontSize: '12px',
        lineHeight: '1.5',
    });

    const copyButton = document.createElement('button');

    copyButton.textContent = '복사';

    Object.assign(copyButton.style, {
        height: '32px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
    });

    copyButton.addEventListener('click', async () => {
        await navigator.clipboard.writeText(message.content || '');
        copyButton.textContent = '복사됨';

        setTimeout(() => {
            copyButton.textContent = '복사';
        }, 1000);
    });

    panel.appendChild(header);
    panel.appendChild(meta);
    panel.appendChild(content);
    panel.appendChild(copyButton);

    document.body.appendChild(panel);
}

function waitForToolbar() {
    createLatestUserMessageButton();

    if (
        !document.querySelector(
            '[data-message-cleaner-latest-user]'
        )
    ) {
        setTimeout(waitForToolbar, 500);
    }
}

waitForToolbar();

// =====================================================================================================

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

async function fetchMessage(messageId) {
    const url =
          `https://contents-api.wrtn.ai/character-chat/v3/chats/${CHAT_ID}/messages/${messageId}`;

    const res = await gmRequest({
        method: 'GET',
        url,
        headers: getHeaders(),
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(`메시지 GET 실패 (${res.status}): ${res.responseText}`);
    }

    const response = JSON.parse(res.responseText);

    return response.data;
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

function stripNarrativeText(content) {
    const text = String(content || '');

    const match = text.match(
        /<ooc_lore_context\b[^>]*>([\s\S]*?)<\/ooc_lore_context\s*>/i
    );

    return match ? match[0].trim() : EMPTY_CONTENT;
}


// 비즈니스 로직

async function backupUserMessage(message) {
    const db = await openBackupDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        if (!message?._id) {
            tx.abort();
            reject(new Error('메시지에 _id가 없습니다.'));
            return;
        }

        // 원본 메시지 그대로 저장
        store.put(message);

        tx.oncomplete = () => {
            db.close();
            resolve();
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };

        tx.onabort = () => {
            db.close();
            reject(
                tx.error || new Error('IndexedDB transaction aborted')
            );
        };
    });
}

async function processUserMessage(message) {
    try {
        // 1. 원본 백업
        // await backupUserMessage(message);

        // 2. 최신 user 메시지 별도 저장
        saveLatestUserMessage(message);

        // 3. 유저 지문 제거
        const messageId = message._id;
        const originalContent = String(message.content || '');
        const modifiedContent = stripNarrativeText(originalContent);

        if (modifiedContent === EMPTY_CONTENT) {
            return;
        }

        // 4. 수정된 내용 PATCH
        await patchMessage(messageId, modifiedContent);

    } catch (error) {
        console.error('[MessageCleaner] user 메시지 처리 실패:', error);
    }
}


// 최신 User Mssage Element 검색 후 로직 실행

async function checkMessageRole(messageGroupId) {
    try {
        const message = await fetchMessage(messageGroupId);

        if (!message) {
            console.warn(
                '[MessageCleaner] 메시지를 찾지 못했습니다:',
                messageGroupId
            );
            return;
        }

        if (message.role !== 'user') {
            return;
        }

        await processUserMessage(message);

    } catch (error) {
        console.error(
            '[MessageCleaner] 메시지 확인 실패:',
            error
        );
    }
}

const processedMessageGroups = new Set();

function observeNewMessageGroups() {
    const messageGroup = document.querySelector('[data-sgb-message-group]');

    if (!messageGroup) {
        setTimeout(observeNewMessageGroups, 500);
        return;
    }

    const messageContainer = messageGroup.parentElement;

    if (!messageContainer) {
        console.error('[MessageCleaner] 메시지 그룹의 부모를 찾지 못했습니다.');
        return;
    }

    if (messageObserver) {
        messageObserver.disconnect();
        messageObserver = null;
    }

    messageObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') {
                continue;
            }

            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) {
                    continue;
                }

                if (
                    node.matches('[data-message-group-id]') &&
                    node.querySelector(ASSISTANT_PANEL_ID)
                ){

                    const messageGroups =
                          messageContainer.querySelectorAll('[data-message-group-id]');

                    const messageGroupsWithElement =
                          [...messageGroups].filter(group =>
                                                    group.querySelector('.css-hzlkcy')
                                                   );

                    const messageGroupId = messageGroupsWithElement[0].getAttribute('data-message-group-id');

                    // 이미 확인한 메시지 그룹이면 무시
                    if (processedMessageGroups.has(messageGroupId)) {
                        continue;
                    }

                    // 중복 mutation 방지를 위해 API 요청 전에 등록
                    processedMessageGroups.add(messageGroupId);
                    checkMessageRole(messageGroupId);
                }
            }
        }
    });

    messageObserver.observe(messageContainer, {
        childList: true,
        subtree: true,
    });

    console.log('[MessageCleaner] 연결 완료');
}

if(currentChatId === CHAT_ID){
    observeNewMessageGroups()
}
