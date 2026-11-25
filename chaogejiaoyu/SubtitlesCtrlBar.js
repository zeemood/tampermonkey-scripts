// ==UserScript==
// @name         超格教育字幕调整按钮
// @namespace    http://tampermonkey.net/
// @version      2026-11-25
// @description  超格教育网页播放器字幕大小调整 + 底部居中半透明底色（挂在 div.ppt 下，空内容时不显示黑框）
// @author       You
// @match        https://chaogejiaoyu.com/course/room/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chaogejiaoyu.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (document.getElementById('font-control-bar')) return;

    const SELECTOR = 'div.subtitles';
    const PPT_SELECTOR = 'div.ppt';

    // ==================== 操作栏 ====================
    const bar = document.createElement('div');
    bar.id = 'font-control-bar';
    Object.assign(bar.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647',
        display: 'flex',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.85)',
        padding: '8px 12px',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        userSelect: 'none',
        cursor: 'move'
    });

    function createBtn(text, title) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        Object.assign(btn.style, {
            width: '38px',
            height: '38px',
            fontSize: '22px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: '#fff',
            color: '#222',
            lineHeight: '1',
            padding: '0'
        });
        btn.onmouseenter = function () { btn.style.background = '#eee'; };
        btn.onmouseleave = function () { btn.style.background = '#fff'; };
        btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        return btn;
    }

    const btnPlus = createBtn('+', '放大 +4px');
    const btnMinus = createBtn('-', '缩小 -4px');

    bar.appendChild(btnPlus);
    bar.appendChild(btnMinus);
    document.body.appendChild(bar);

    // ==================== 拖拽 ====================
    let isDragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    bar.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = bar.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        bar.style.right = 'auto';
        bar.style.bottom = 'auto';
        bar.style.left = startLeft + 'px';
        bar.style.top = startTop + 'px';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;
        const maxLeft = window.innerWidth - bar.offsetWidth;
        const maxTop = window.innerHeight - bar.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        bar.style.left = newLeft + 'px';
        bar.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
        }
    });

    // ==================== 查找元素（支持 iframe） ====================
    function findAllDocuments(win) {
        win = win || window;
        const docs = [win.document];
        try {
            for (let i = 0; i < win.frames.length; i++) {
                try {
                    const childDocs = findAllDocuments(win.frames[i]);
                    for (let j = 0; j < childDocs.length; j++) {
                        docs.push(childDocs[j]);
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return docs;
    }

    function querySelectorAllDeep(selector) {
        const results = [];
        const docs = findAllDocuments();
        for (let i = 0; i < docs.length; i++) {
            try {
                const nodes = docs[i].querySelectorAll(selector);
                for (let j = 0; j < nodes.length; j++) {
                    results.push(nodes[j]);
                }
            } catch (e) {}
        }
        return results;
    }

    function queryAllSubtitles() {
        return querySelectorAllDeep(SELECTOR);
    }

    function findPptContainer() {
        const switched = querySelectorAllDeep('div.ppt.switch');
        if (switched.length > 0) return switched[0];
        const normal = querySelectorAllDeep(PPT_SELECTOR);
        return normal.length > 0 ? normal[0] : null;
    }

    // ==================== 包装字幕 + 样式 ====================
    let currentSubtitleEl = null;
    let contentObserver = null;

    function hasContent(el) {
        if (!el) return false;
        // 检查是否有可见文本内容
        const text = (el.textContent || '').trim();
        if (text.length > 0) return true;
        // 有时候字幕是通过子元素或伪元素，再兜底检查是否可见
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0 && el.offsetWidth > 0;
    }

    function applySubtitleStyle(el) {
        if (!el) return;

        const hasText = hasContent(el);

        if (hasText) {
            // 有内容：加半透明黑底 + 圆角
            Object.assign(el.style, {
                background: 'rgba(0, 0, 0, 0.65)',
                borderRadius: '20px',
                padding: '8px 20px',
                textAlign: 'center',
                display: 'inline-block',
                maxWidth: '90%',
                boxSizing: 'border-box',
                pointerEvents: 'auto',
                visibility: 'visible'
            });
        } else {
            // 无内容：去掉背景和 padding，避免小黑框
            Object.assign(el.style, {
                background: 'transparent',
                borderRadius: '0',
                padding: '0',
                display: 'inline-block',
                maxWidth: '90%',
                boxSizing: 'border-box',
                pointerEvents: 'none'
            });
        }

        // 恢复上次字号（无论有没有内容都应用）
        const saved = localStorage.getItem('subtitleFontSize');
        if (saved) {
            el.style.setProperty('font-size', saved, 'important');
        }
    }

    function enhanceSubtitle() {
        const nodes = queryAllSubtitles();
        if (nodes.length === 0) return false;

        const el = nodes[0];
        const ppt = findPptContainer();
        if (!ppt) return false;

        // 已经正确挂载
        if (el.parentElement &&
            el.parentElement.classList.contains('subtitle-wrapper') &&
            el.parentElement.parentElement === ppt) {
            applySubtitleStyle(el);
            setupContentObserver(el);
            return true;
        }

        // 清理旧 wrapper
        const oldWrappers = ppt.querySelectorAll('.subtitle-wrapper');
        oldWrappers.forEach(w => {
            if (w !== el.parentElement) w.remove();
        });

        // 创建 / 复用 wrapper
        let wrapper = el.parentElement;
        if (!wrapper || !wrapper.classList.contains('subtitle-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'subtitle-wrapper';
        }

        Object.assign(wrapper.style, {
            position: 'absolute',
            left: '0',
            right: '0',
            bottom: '30px',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: '20'
        });

        if (wrapper.parentElement !== ppt) {
            ppt.appendChild(wrapper);
        }

        if (el.parentElement !== wrapper) {
            wrapper.appendChild(el);
        }

        applySubtitleStyle(el);
        setupContentObserver(el);
        return true;
    }

    // 监听字幕内容变化（有字 / 没字时切换样式）
    function setupContentObserver(el) {
        if (currentSubtitleEl === el && contentObserver) return;

        // 清理旧观察者
        if (contentObserver) {
            contentObserver.disconnect();
            contentObserver = null;
        }

        currentSubtitleEl = el;

        contentObserver = new MutationObserver(() => {
            applySubtitleStyle(el);
        });

        contentObserver.observe(el, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    function changeFontSize(delta) {
        const nodes = queryAllSubtitles();
        if (nodes.length === 0) {
            alert('没有找到字幕元素');
            return;
        }
        const el = nodes[0];
        const current = parseFloat(getComputedStyle(el).fontSize) || 16;
        const next = Math.max(10, current + delta);
        el.style.setProperty('font-size', next + 'px', 'important');
        localStorage.setItem('subtitleFontSize', next + 'px');
        // 顺便刷新一下样式（防止刚改字号时状态不对）
        applySubtitleStyle(el);
    }

    btnPlus.addEventListener('click', function () { changeFontSize(4); });
    btnMinus.addEventListener('click', function () { changeFontSize(-4); });

    // ==================== 初始化 + 持续监听 ====================
    function tryEnhance() {
        return enhanceSubtitle();
    }

    setTimeout(() => {
        if (!tryEnhance()) {
            let count = 0;
            const timer = setInterval(() => {
                if (tryEnhance() || ++count > 20) clearInterval(timer);
            }, 600);
        }
    }, 600);

    // 全局观察：布局切换、元素增减
    const observer = new MutationObserver((mutations) => {
        let needCheck = false;
        for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'class') {
                needCheck = true;
                break;
            }
            if (m.type === 'childList') {
                needCheck = true;
                break;
            }
        }
        if (needCheck) {
            setTimeout(tryEnhance, 80);
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
})();
