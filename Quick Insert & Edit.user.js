// ==UserScript==
// @name         Quick Insert & Edit
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Provides quick message selection, shortcut-based edit/save, and custom quick-insert snippets for Wrtn Crack.
// @author       Nobody
// @match        https://crack.wrtn.ai/stories/*
// @match        https://crack.wrtn.ai/characters/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crack.wrtn.ai
// @grant        none
// ==/UserScript==

let currentMessageId = null;

const QUICK_INSERT_STORAGE_KEY = 'tm_quick_insert_items_v1';

// Ctrl + Shift + E / U / S 는 서비스 예약 단축키
const RESERVED_QUICK_KEYS = new Set(['e', 'u', 's']);

const DEFAULT_QUICK_INSERT_ITEMS = [];

const koreanKeyMap = {
  'ㅂ': 'q',
  'ㅈ': 'w',
  'ㄷ': 'e',
  'ㄱ': 'r',
  'ㅅ': 't',
  'ㅛ': 'y',
  'ㅕ': 'u',
  'ㅑ': 'i',
  'ㅐ': 'o',
  'ㅔ': 'p',

  'ㅁ': 'a',
  'ㄴ': 's',
  'ㅇ': 'd',
  'ㄹ': 'f',
  'ㅎ': 'g',
  'ㅗ': 'h',
  'ㅓ': 'j',
  'ㅏ': 'k',
  'ㅣ': 'l',

  'ㅋ': 'z',
  'ㅌ': 'x',
  'ㅊ': 'c',
  'ㅍ': 'v',
  'ㅠ': 'b',
  'ㅜ': 'n',
  'ㅡ': 'm'
};

function normalizeQuickKey(value) {
  const key = String(value || '').trim().toLowerCase().slice(0, 1);

  if (koreanKeyMap[key]) {
    return koreanKeyMap[key];
  }

  if (/^[a-z0-9]$/.test(key)) {
    return key;
  }

  return '';
}


// ============================================================
// 현재 메시지 인디케이터
// ============================================================

function updateCurrentIndicator() {
  if (!currentMessageId) return;

  const bubble = document.querySelector(
    `[data-message-group-id="${CSS.escape(currentMessageId)}"]`
  );

  if (!bubble) return;

  const menuButton = bubble.querySelector(
    'button[aria-label="메시지 옵션"]'
  );

  if (!menuButton) return;

  const outline = '2px solid rgba(100, 150, 255, 0.65)';

  if (menuButton.style.outline !== outline) {
    menuButton.style.outline = outline;
    menuButton.style.outlineOffset = '2px';
  }
}

function clearCurrentIndicator() {
  if (!currentMessageId) return;

  const bubble = document.querySelector(
    `[data-message-group-id="${CSS.escape(currentMessageId)}"]`
  );

  const menuButton = bubble?.querySelector(
    'button[aria-label="메시지 옵션"]'
  );

  if (menuButton) {
    menuButton.style.outline = '';
    menuButton.style.outlineOffset = '';
  }
}


// ============================================================
// 스크롤
// ============================================================

function getScrollContainer(element) {
  let parent = element.parentElement;

  while (parent) {
    const style = getComputedStyle(parent);

    if (
      style.overflowY === 'scroll' ||
      style.overflowY === 'auto'
    ) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
}

function scrollBubbleToTop(bubble) {
  if (!bubble) return;

  const container = getScrollContainer(bubble);

  if (!container) return;

  const bubbleRect = bubble.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  container.scrollTop += bubbleRect.top - containerRect.top - 36;
}


// ============================================================
// 메시지 DOM 갱신 감시
// ============================================================

const indicatorObserver = new MutationObserver(() => {
  updateCurrentIndicator();
});

indicatorObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['style']
});


// ============================================================
// 메시지 선택
// ============================================================

document.addEventListener('pointerdown', (event) => {
  // 스크립트가 만든 가짜 pointerdown은 선택 변경에 사용하지 않음
  if (!event.isTrusted) return;

  const bubble = event.target.closest('[data-message-group-id]');

  // 다른 버블을 클릭한 경우
  if (bubble) {
    const messageId = bubble.dataset.messageGroupId;

    if (messageId !== currentMessageId) {
      clearCurrentIndicator();

      currentMessageId = messageId;

      updateCurrentIndicator();
    }

    return;
  }

  // 버블 밖을 클릭했을 때
  if (currentMessageId) {
    const currentBubble = document.querySelector(
      `[data-message-group-id="${CSS.escape(currentMessageId)}"]`
    );

    if (currentBubble) {
      const completeButton = [...currentBubble.querySelectorAll('button')]
        .find(el => el.textContent.trim() === '수정 완료');

      // 수정 중이면 current 유지
      if (completeButton) {
        return;
      }
    }

    // 수정 중이 아니면 선택 해제
    clearCurrentIndicator();
    currentMessageId = null;
  }
});


// ============================================================
// 퀵 삽입 데이터
// ============================================================

function loadQuickInsertItems() {
  try {
    const saved = localStorage.getItem(QUICK_INSERT_STORAGE_KEY);

    if (!saved) {
      const defaults = structuredClone(DEFAULT_QUICK_INSERT_ITEMS);

      localStorage.setItem(
        QUICK_INSERT_STORAGE_KEY,
        JSON.stringify(defaults)
      );

      return defaults;
    }

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return structuredClone(DEFAULT_QUICK_INSERT_ITEMS);
    }

    return parsed
      .filter(
        item =>
          item &&
          typeof item.text === 'string' &&
          typeof item.key === 'string'
      )
      .map(item => ({
        text: item.text,
        key: normalizeQuickKey(item.key)
      }))
      .filter(item => item.key);
  } catch (error) {
    console.error('[Quick Insert] 저장 데이터 불러오기 실패:', error);
    return structuredClone(DEFAULT_QUICK_INSERT_ITEMS);
  }
}

let quickInsertItems = loadQuickInsertItems();

function saveQuickInsertItems() {
  localStorage.setItem(
    QUICK_INSERT_STORAGE_KEY,
    JSON.stringify(quickInsertItems)
  );
}


// ============================================================
// 퀵 삽입 실행
// ============================================================

function insertQuickText(text) {
  const input = document.querySelector(
    'div[contenteditable="true"].ProseMirror'
  );

  if (!input) return false;

  input.focus();

  const success = document.execCommand(
    'insertText',
    false,
    text
  );

  return success;
}


// ============================================================
// 퀵 삽입 UI
// ============================================================

let quickInsertPanel = null;
let quickInsertBackdrop = null;

function closeQuickInsertPanel() {
  if (quickInsertPanel) {
    quickInsertPanel.remove();
    quickInsertPanel = null;
  }

  if (quickInsertBackdrop) {
    quickInsertBackdrop.remove();
    quickInsertBackdrop = null;
  }
}

function injectQuickInsertStyles() {
  if (document.querySelector('#tm-quick-insert-style')) return;

  const style = document.createElement('style');
  style.id = 'tm-quick-insert-style';

  style.textContent = `
    #tm-quick-insert-launcher {
      width: 32px;
      height: 32px;
      flex: 0 0 32px;

      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 8px;

      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.88);

      cursor: pointer;

      display: inline-flex;
      align-items: center;
      justify-content: center;

      padding: 0;

      font-size: 16px;
      line-height: 1;

      box-sizing: border-box;

      box-shadow:
        0 1px 3px rgba(0,0,0,0.2),
        inset 0 0 0 1px rgba(255,255,255,0.03);

      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    #tm-quick-insert-launcher:hover {
      background: rgba(255,255,255,0.14);
      border-color: rgba(255,255,255,0.35);

      box-shadow:
        0 2px 6px rgba(0,0,0,0.25),
        inset 0 0 0 1px rgba(255,255,255,0.05);
    }

    #tm-quick-insert-panel {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 999999;

      width: min(520px, calc(100vw - 40px));
      max-height: min(620px, calc(100vh - 40px));

      overflow-y: auto;
      box-sizing: border-box;

      padding: 18px;

      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;

      background: rgba(28,31,36,0.97);
      color: rgba(255,255,255,0.92);

      box-shadow:
        0 18px 50px rgba(0,0,0,0.45),
        0 4px 14px rgba(0,0,0,0.25);

      font-family: sans-serif;
      font-size: 13px;
    }

    #tm-quick-insert-panel * {
      box-sizing: border-box;
    }

    .tm-qi-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 14px;
      color: rgba(255,255,255,0.95);
    }

    .tm-qi-add-row {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }

    .tm-qi-text-input {
      flex: 1;
      min-width: 0;

      height: 42px;
      padding: 0 11px;

      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 7px;

      background: rgba(0,0,0,0.28);
      color: rgba(255,255,255,0.95);

      outline: none;
    }

    .tm-qi-key-input {
      width: 52px;
      height: 42px;
      padding: 0 6px;

      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 7px;

      background: rgba(0,0,0,0.28);
      color: rgba(255,255,255,0.95);

      text-align: center;
      text-transform: uppercase;

      outline: none;
    }

    .tm-qi-text-input:focus,
    .tm-qi-key-input:focus {
      border-color: rgba(255,255,255,0.32);
      background: rgba(0,0,0,0.36);
    }

    .tm-qi-button {
      height: 42px;
      padding: 0 14px;

      border: none;
      border-radius: 7px;

      background: rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.92);

      cursor: pointer;
    }

    .tm-qi-button:hover {
      background: rgba(255,255,255,0.18);
    }

    .tm-qi-add-button {
      background: #e56a24;
      color: #ffffff;
      font-weight: 600;
    }

    .tm-qi-add-button:hover {
      background: #f07830;
      color: #ffffff;
    }

    .tm-qi-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .tm-qi-item {
      display: flex;
      align-items: center;
      gap: 8px;

      padding: 8px;

      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;

      background: rgba(255,255,255,0.035);
    }

    .tm-qi-item-key {
      flex: 0 0 28px;
      height: 28px;

      display: flex;
      align-items: center;
      justify-content: center;

      border-radius: 6px;

      background: rgba(229,106,36,0.16);
      color: #f09a68;

      font-weight: 700;
    }

    .tm-qi-item-text {
      flex: 1;
      min-width: 0;

      line-height: 1.4;
      word-break: break-word;

      color: rgba(255,255,255,0.88);
    }

    .tm-qi-delete {
      width: 28px;
      height: 28px;
      padding: 0;

      border: 1px solid rgba(255,90,70,0.28);
      border-radius: 6px;

      background: rgba(255,70,50,0.16);
      color: #ff9188;

      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
    }

    .tm-qi-delete:hover {
      background: rgba(255,70,50,0.28);
      border-color: rgba(255,100,85,0.45);
      color: #ffb0a8;
    }

    .tm-qi-reserved {
      margin-top: 12px;

      color: rgba(255,255,255,0.48);
      line-height: 1.5;
    }

    .tm-qi-empty {
      padding: 12px 0;

      color: rgba(255,255,255,0.42);
      text-align: center;
    }

    #tm-quick-insert-backdrop {
      position: fixed;
      inset: 0;
      z-index: 999998;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(2px);
    }
  `;

  document.head.appendChild(style);
}


function createQuickInsertUI() {
  const existingLauncher = document.querySelector(
    '#tm-quick-insert-launcher'
  );

  if (existingLauncher) return;

  const loreButton = document.querySelector(
    '#lore-inj-entry-button'
  );

  if (!loreButton) return;

  const headerContainer = loreButton.parentElement;

  if (!headerContainer) return;

  injectQuickInsertStyles();

  const launcher = document.createElement('button');

  launcher.id = 'tm-quick-insert-launcher';
  launcher.type = 'button';
  launcher.textContent = '⌨';
  launcher.title = '상용구 단축키';
  launcher.setAttribute('aria-label', '상용구 단축키');

  // 메시지 선택 로직으로 이벤트가 전달되지 않도록 함
  launcher.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  launcher.addEventListener('click', (event) => {
    event.stopPropagation();

    if (quickInsertPanel) {
      closeQuickInsertPanel();
      return;
    }

    injectQuickInsertStyles();

    // 백드롭
    quickInsertBackdrop = document.createElement('div');
    quickInsertBackdrop.id = 'tm-quick-insert-backdrop';

    quickInsertBackdrop.addEventListener('click', () => {
      closeQuickInsertPanel();
    });

    // 패널
    quickInsertPanel = createQuickInsertPanel();

    document.body.appendChild(quickInsertBackdrop);
    document.body.appendChild(quickInsertPanel);
  });

  headerContainer.insertBefore(
    launcher,
    headerContainer.firstChild
  );
}


function createQuickInsertPanel() {
  const panel = document.createElement('div');

  panel.id = 'tm-quick-insert-panel';

  // 패널 내부 클릭이 백드롭으로 전달되지 않도록 함
  panel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  panel.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  const title = document.createElement('div');
  title.className = 'tm-qi-title';
  title.textContent = '상용구 단축키';

  const addRow = document.createElement('div');
  addRow.className = 'tm-qi-add-row';

  const textInput = document.createElement('input');
  textInput.className = 'tm-qi-text-input';
  textInput.type = 'text';
  textInput.placeholder = '추가할 문구';

  const keyInput = document.createElement('input');
  keyInput.className = 'tm-qi-key-input';
  keyInput.type = 'text';
  keyInput.maxLength = 1;
  keyInput.placeholder = '키';
  keyInput.title = 'Ctrl + Shift + [키]';

  keyInput.addEventListener('keydown', (event) => {
    const code = event.code;

    // 1. 백스페이스는 input 기본 동작 허용
    if (code === 'Backspace') {
      return;
    }

    // 2. 영어/한글 자판(Key~) 또는 숫자(Digit~)가 아니면
    //    input에는 아무것도 입력하지 않고 그대로 둠
    if (!code.startsWith('Key') && !code.startsWith('Digit')) {
      return;
    }

    // 3. 'KeyF' -> 'f', 'Digit1' -> '1'
    const plainKey = code
      .replace('Key', '')
      .replace('Digit', '')
      .toLowerCase();

    // 4. 한글 자판 위치를 영문 키로 변환
    // 비동기를 사용한 이유는, IME 한글 조합을 차단하기 위해 조합 이후 페이즈로 입력상태를 강제로 넘기기 위해서.
    // 더 좋은 방법있으면 적극적으로 수정 권장
    const normalized = normalizeQuickKey(plainKey);

    if (normalized) {
      event.preventDefault(); // 기본 입력 막기

      // 한글 조합 잔재(ㄹ 등) 깜빡임 막기
      keyInput.blur();
      keyInput.value = normalized.toUpperCase();

      setTimeout(() => {
        keyInput.focus();
      }, 0);
    } else {
      // 자판/숫자이긴 한데 안 쓰는 키라면 차단
      event.preventDefault();
    }
  });

  keyInput.addEventListener('compositionstart', (event) => {
    event.preventDefault();
    keyInput.blur();
    keyInput.value = ''; // 키다운 이후 조합 자모 청소

    setTimeout(() => {
      keyInput.focus();
    }, 0);
  });

  const addButton = document.createElement('button');
  addButton.className = 'tm-qi-button tm-qi-add-button';
  addButton.type = 'button';
  addButton.textContent = '추가';

  const list = document.createElement('div');
  list.className = 'tm-qi-list';

  const reserved = document.createElement('div');
  reserved.className = 'tm-qi-reserved';
  reserved.innerHTML =
    '단축키: <b>Ctrl + Shift + [키]</b><br>' +
    '사용불가 키: <b>E / U / S</b>';

  addRow.appendChild(textInput);
  addRow.appendChild(keyInput);
  addRow.appendChild(addButton);

  panel.appendChild(title);
  panel.appendChild(addRow);
  panel.appendChild(list);
  panel.appendChild(reserved);


  function renderList() {
    list.replaceChildren();

    if (!quickInsertItems.length) {
      const empty = document.createElement('div');

      empty.className = 'tm-qi-empty';
      empty.textContent = '등록된 단축키가 없습니다.';

      list.appendChild(empty);

      return;
    }

    quickInsertItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'tm-qi-item';

      const key = document.createElement('div');
      key.className = 'tm-qi-item-key';
      key.textContent = item.key.toUpperCase();

      const text = document.createElement('div');
      text.className = 'tm-qi-item-text';
      text.textContent = item.text;

      const deleteButton = document.createElement('button');

      deleteButton.className = 'tm-qi-delete';
      deleteButton.type = 'button';
      deleteButton.textContent = '×';
      deleteButton.title = '삭제';

      deleteButton.addEventListener('click', () => {
        quickInsertItems.splice(index, 1);
        saveQuickInsertItems();
        renderList();
      });

      row.appendChild(key);
      row.appendChild(text);
      row.appendChild(deleteButton);

      list.appendChild(row);
    });
  }


  function addItem() {
    const text = textInput.value.trim();
    const key = normalizeQuickKey(keyInput.value);

    if (!text) {
      textInput.focus();
      return;
    }

    if (!/^[a-z0-9]$/.test(key)) {
      alert('키는 영문자 또는 숫자 한 글자만 사용할 수 있습니다.');
      keyInput.focus();
      return;
    }

    if (RESERVED_QUICK_KEYS.has(key)) {
      alert(
        `Ctrl+Shift+${key.toUpperCase()}는 크랙 서비스에서 사용하는 단축키입니다.`
      );

      keyInput.focus();

      return;
    }

    const duplicate = quickInsertItems.find(
      item => item.key === key
    );

    if (duplicate) {
      alert(
        `Ctrl+Shift+${key.toUpperCase()}는 이미 등록되어 있습니다.`
      );

      keyInput.focus();

      return;
    }

    quickInsertItems.push({
      key,
      text
    });

    saveQuickInsertItems();

    textInput.value = '';
    keyInput.value = '';

    textInput.focus();

    renderList();
  }


  addButton.addEventListener('click', addItem);


  keyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addItem();
    }
  });


  textInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addItem();
    }
  });


  renderList();

  return panel;
}


// ============================================================
// 페이지 리렌더링 시 퀵 삽입 UI 유지
// ============================================================

const quickInsertUIObserver = new MutationObserver(() => {
  createQuickInsertUI();
});

quickInsertUIObserver.observe(document.body, {
  childList: true,
  subtree: true
});


// ============================================================
// 단축키
// ============================================================

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();


  // ----------------------------------------------------------
  // Ctrl + Q
  // ----------------------------------------------------------

  if (event.ctrlKey && key === 'q') {
    event.preventDefault();

    if (!currentMessageId) return;

    const bubble = document.querySelector(
      `[data-message-group-id="${CSS.escape(currentMessageId)}"]`
    );

    if (!bubble) return;


    // 현재 버블이 수정 중인지 확인
    const completeButton = [...bubble.querySelectorAll('button')]
      .find(el => el.textContent.trim() === '수정 완료');

    if (completeButton) {
      // 수정 중이면 취소
      const cancelButton = [...bubble.querySelectorAll('button')]
        .find(el => el.textContent.trim() === '취소');

      cancelButton?.click();

      return;
    }


    const menuButton = bubble.querySelector(
      'button[aria-label="메시지 옵션"]'
    );

    if (!menuButton) return;


    // 메뉴 열기
    menuButton.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1
      })
    );


    // 메뉴가 생성되면 수정 클릭
    const observer = new MutationObserver(() => {
      const editButton = [...document.querySelectorAll('[role="menuitem"]')]
        .find(el => el.textContent.trim() === '수정');

      if (!editButton) return;

      observer.disconnect();

      const options = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1
      };


      editButton.dispatchEvent(
        new PointerEvent('pointerdown', options)
      );

      editButton.dispatchEvent(
        new PointerEvent('pointerup', {
          ...options,
          buttons: 0
        })
      );

      editButton.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0
        })
      );


      // 수정창이 열리고 DOM이 갱신된 뒤
      // 현재 버블의 최상단으로 이동
      requestAnimationFrame(() => {
        const currentBubble = document.querySelector(
          `[data-message-group-id="${CSS.escape(currentMessageId)}"]`
        );

        if (!currentBubble) return;

        currentBubble.scrollIntoView({
          block: 'start',
          behavior: 'instant'
        });

        scrollBubbleToTop(currentBubble);
      });
    });


    observer.observe(document.body, {
      childList: true,
      subtree: true
    });


    setTimeout(() => {
      observer.disconnect();
    }, 3000);
  }


  // ----------------------------------------------------------
  // Ctrl + S
  // ----------------------------------------------------------

  if (event.ctrlKey && key === 's') {
    if (!currentMessageId) return;

    const bubble = document.querySelector(
      `[data-message-group-id="${CSS.escape(currentMessageId)}"]`
    );

    if (!bubble) return;

    const completeButton = [...bubble.querySelectorAll('button')]
      .find(el => el.textContent.trim() === '수정 완료');


    // 수정 완료 버튼이 있을 때만 Ctrl+S 기본 동작 차단
    if (!completeButton) return;

    event.preventDefault();

    completeButton.click();
  }


  // ----------------------------------------------------------
  // Ctrl + Shift + 퀵 삽입
  // ----------------------------------------------------------

  if (!event.ctrlKey || !event.shiftKey) return;

  // 물리 키 기준으로 영문/숫자 추출
  const quickKey = event.code
    .replace('Key', '')
    .replace('Digit', '')
    .toLowerCase();

  // E / U / S는 크랙 예약키라서 막아둠
  if (RESERVED_QUICK_KEYS.has(quickKey)) return;

  const quickItem = quickInsertItems.find(
    item => item.key === quickKey
  );

  if (!quickItem) return;

  const inserted = insertQuickText(quickItem.text);

  if (inserted) {
    event.preventDefault();
  }
});


// ============================================================
// 초기 UI 생성
// ============================================================

createQuickInsertUI();