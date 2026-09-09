// ==UserScript==
// @name         외부 이미지 링크 축약기
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  외부 이미지 링크(![](https://domain/imagecode.png))를 %imagecode% 형식으로 출력하게 만드는 스크립트
// @author       You
// @match        https://crack.wrtn.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crack.wrtn.ai
// @connect      crack-api.wrtn.ai
// @connect      contents-api.wrtn.ai
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// ==/UserScript==

const CHAT_ID = '6a8b85beddd893caea421baa';
const currentChatId =
      location.pathname.split('/').filter(Boolean).pop();
const ASSISTANT_PANEL_ID = '.css-10wlg6j';
const CALL_LIMIT = 40;
const imageIdentifierRegex = /%(?![^%]*\.png)([^%]+)%/;
const imageIdentifierGlobalRegex = /%(?![^%]*\.png)([^%]+)%/g;
const processPastMessagesOnly = true;
let messageObserver = null;

function getHeaders (){
    const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('access_token='))
    ?.split('=').slice(1).join('=');

    console.log('[TOKEN FOUND]', !!token);

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

async function fetchMessage(messageId) {
    const url =
          `https://contents-api.wrtn.ai/character-chat/v3/chats/${CHAT_ID}/messages/${messageId}`;

    const res = await gmRequest({
        method: 'GET',
        url,
        headers: getHeaders(),
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(
            `메시지 GET 실패 (${res.status}): ${res.responseText}`
        );
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


/**
 * contenteditable 내부인지 확인
 */
function isInsideContentEditable(node) {
    const element =
          node.nodeType === Node.TEXT_NODE
    ? node.parentElement
    : node;

    return !!element?.closest('[contenteditable]');
}


/**
 * 크랙의 이미지 요소 형식대로 생성
 */
function createImageSpan(imageCode) {
    const span = document.createElement('span');
    span.className = 'w-full pt-5 block';

    const img = document.createElement('img');
    img.alt = '';
    img.src = `https://pj.knotta.org/${imageCode}.png`;
    img.className = 'w-full rounded-lg cursor-pointer block';

    span.appendChild(img);

    return span;
}


/**
 * 일반 TextNode의 식별자를 이미지 노드로 즉시 치환
 */
function convertTextNodeToImageNode(textNode) {
    if (isInsideContentEditable(textNode)) {
        return;
    }

    const text = textNode.nodeValue || '';

    if (!imageIdentifierRegex.test(text)) {
        return;
    }

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    text.replace(imageIdentifierGlobalRegex, (match, imageCode, offset) => {
        if (offset > lastIndex) {
            fragment.appendChild(
                document.createTextNode(text.slice(lastIndex, offset))
            );
        }

        // 여기서 이미지 노드 만들어서 추가
        fragment.appendChild(createImageSpan(imageCode));
        lastIndex = offset + match.length;
    });

    if (lastIndex > 0) {
        if (lastIndex < text.length) {
            fragment.appendChild(
                document.createTextNode(text.slice(lastIndex))
            );
        }

        textNode.replaceWith(fragment);
    }
}

/**
 * 텍스트 노드 다 긁어서 convertTextNodeToImageNode 보내기
 */
function processImageIdentifierTextNodes(root) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT
    );

    const textNodes = [];

    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    for (const textNode of textNodes) {
        convertTextNodeToImageNode(textNode);
    }
}

/**
 * 서버 content의 %이미지 코드% 식별자를 찾아 전환. 이미 링크로 바뀌어 있는 것은 건드리지 않음.
 */
function convertImageIdentifiersToMarkdown(content) {
    const result = content.replace(
        imageIdentifierGlobalRegex,
        '![](https://pj.knotta.org/$1.png)'
    );

    return {
        result,
        isChanged: result !== content
    };
}

/**
 * mutation 대상에서 message group 찾기
 */
function getMessageGroup(node) {
    const element =
          node.nodeType === Node.TEXT_NODE
    ? node.parentElement
    : node;

    return element?.closest('[data-message-group-id]') || null;
}

/**
 * 노드 자신 포함 노드 내부의 이미지 식별자가 포함된 parapraph 요소들 긁어모으기
 */
function findImageIdentifierParagraphs(node) {
    const paragraphs = [];

    if (
        node.matches('p') &&
        imageIdentifierRegex.test(node.textContent || '')
    ) {
        paragraphs.push(node);
    }

    paragraphs.push(
        ...node.querySelectorAll('p')
    );

    return paragraphs;
}

/**
 * 가장 최근 ai 메세지를 get으로 불러와서 이미지 식별자 이미지 마크다운으로 만든 후 patch로 다시 쏘는 로직
 */
function processRecentMessageContent(messageGroup, messageId) {
    if (messageGroup.dataset.imgIdentifierChecked === '1') {
        return;
    }

    fetchMessage(messageId)
        .then(data => {
        const content = data?.content;

        if (data.role !== 'assistant') {
            return
        }

        messageGroup.dataset.imgIdentifierChecked = '1';

        if (typeof content !== 'string') {
            console.error(
                'message content를 찾지 못했습니다.',
                data
            );
            delete messageGroup.dataset.imgIdentifierChecked;
            return;
        }

        const {result, isChanged} =
              convertImageIdentifiersToMarkdown(content);

        if (!isChanged) {
            return;
        }
        return patchMessage(messageId, result)
    }).catch(error => {
        delete messageGroup.dataset.imgidentifierChecked;

        console.error(
            '서버 메시지 처리 실패:',
            messageId,
            error
        );
    });
}

async function processMessagesContentFromPast(){
    const messages = await fetchMessages(CALL_LIMIT)
    const assistantMessages = messages.filter((message, index) => message.role === 'assistant');
    const targetMessages = assistantMessages.slice(10,20)

    for(const message of targetMessages){
        const {result, isChanged} = convertImageIdentifiersToMarkdown(message.content);
        if(!isChanged){
            continue;
        }
        patchMessage(message._id,result)
    }
}

function createMutationObserver(messageContainer) {
    messageObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            // 스트리밍 끝나고, 혹은 수정으로 p 태그 안에 이미지가 들어온 상황
            if (
                mutation.type === 'childList' &&
                (
                    mutation.target.querySelector(ASSISTANT_PANEL_ID) ||
                    mutation.target.closest(ASSISTANT_PANEL_ID)
                )
            ) {
                for (const node of mutation.addedNodes) {

                    if (node.nodeType === Node.TEXT_NODE) {
                        if (!node.parentElement?.closest(ASSISTANT_PANEL_ID)) {
                            continue;
                        }
                        convertTextNodeToImageNode(node);
                        continue;
                    }

                    if (!(node instanceof Element)) {
                        continue;
                    }

                    if (isInsideContentEditable(node)) {
                        continue;
                    }

                    // 응답 렌더링 완료되고 data-message-group-id가 추가되는 시점
                    if (
                        node.matches('[data-message-group-id]') &&
                        node.querySelector(ASSISTANT_PANEL_ID)
                    ) {
                        const messageGroupId =
                              node.getAttribute('data-message-group-id');

                        console.log('스트리밍 완료')

                        if (processPastMessagesOnly) {
                            processMessagesContentFromPast();
                        }else {
                            console.log('dont')
                            processMessagesContentFromPast();
                            processRecentMessageContent(node, messageGroupId);
                        }

                        // 사용자가 응답메시지를 수정해 식별자를 추가할 때, UI에서 식별자를 이미지노드로 업데이트
                        processImageIdentifierTextNodes(node);
                    }

                    if (!node.closest(ASSISTANT_PANEL_ID)) {
                        continue;
                    }
                    processImageIdentifierTextNodes(node);
                }
            }

            if (
                mutation.type === 'characterData' &&
                mutation.target.parentElement?.closest(ASSISTANT_PANEL_ID)
            ) {
                convertTextNodeToImageNode(mutation.target);
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
 * 메시지 그룹 감시
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
        console.error(
            '메시지 그룹의 부모를 찾지 못했습니다.'
        );
        return;
    }

    const assistantPanels = messageContainer.querySelectorAll(
        ASSISTANT_PANEL_ID
    );
    for (const panel of assistantPanels) {
        processImageIdentifierTextNodes(panel);
    }

    if (messageObserver) {
        messageObserver.disconnect();
        messageObserver = null;
    }

    createMutationObserver(messageContainer)

    console.log('[외부 이미지 링크 축약기] 연결 완료')
}

if (currentChatId === CHAT_ID) {
    observeNewMessageGroups();
}else{
    console.log('채팅방 ID 불일치')
}
