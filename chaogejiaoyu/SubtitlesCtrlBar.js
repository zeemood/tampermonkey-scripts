// ==UserScript==
// @name         超格教育字幕调整按钮
// @namespace    http://tampermonkey.net/
// @version      2026-11-26.1
// @description  超格教育网页播放器字幕大小调整 + 底部居中半透明底色 + 倍速控制（挂在 div.ppt 下，兼容原字幕开关）
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

    // 倍速档位（循环）
    const SPEED_LIST = [1, 1.25, 1.5, 1.75, 2, 0.75];
    let currentSpeedIndex = 0;

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

    function createBtn(text, title, isWide) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        Object.assign(btn.style, {
            minWidth: isWide ? '52px' : '38px',
            height: '38px',
            fontSize: isWide ? '14px' : '22px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: '#fff',
            color: '#222',
            lineHeight: '1',
            padding: isWide ? '0 8px' : '0'
        });
        btn.onmouseenter = function () { btn.style.background = '#eee'; };
        btn.onmouseleave = function () { btn.style.background = '#fff'; };
        btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        return btn;
    }

    const btnPlus = createBtn('+', '放大 +4px');
    const btnMinus = createBtn('-', '缩小 -4px');
    const btnSpeed = createBtn('1.0x', '切换倍速', true);

    bar.appendChild(btnMinus);
    bar.appendChild(btnPlus);
    bar.appendChild(btnSpeed);
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

    // ==================== 倍速控制 ====================
    function setPlaybackRate(speed) {
        // 优先使用原播放器 API
        if (window.$ && $.DW && typeof $.DW.playbackRate === 'function') {
            $.DW.playbackRate(speed);
            return true;
        }

        // 兜底：直接改 video 元素
        const videos = querySelectorAllDeep('video');
        let ok = false;
        for (const v of videos) {
            try {
                v.playbackRate = speed;
                ok = true;
            } catch (e) {}
        }
        // 再试常见 id
        const byId = document.getElementById('playbackVideo');
        if (byId) {
            try {
                byId.playbackRate = speed;
                ok = true;
            } catch (e) {}
        }
        return ok;
    }

    function cycleSpeed() {
        currentSpeedIndex = (currentSpeedIndex + 1) % SPEED_LIST.length;
        const speed = SPEED_LIST[currentSpeedIndex];
        const ok = setPlaybackRate(speed);
        btnSpeed.textContent = speed + 'x';
        if (!ok) {
            console.warn('倍速设置失败，未找到可用的播放器接口');
        }
        // 记住当前倍速
        localStorage.setItem('subtitlePlaybackRate', String(speed));
    }

    btnSpeed.addEventListener('click', function (e) {
        e.stopPropagation();
        cycleSpeed();
    });

    // 初始化恢复上次倍速
    (function restoreSpeed() {
        const saved = parseFloat(localStorage.getItem('subtitlePlaybackRate'));
        if (saved && !isNaN(saved)) {
            const idx = SPEED_LIST.indexOf(saved);
            if (idx >= 0) currentSpeedIndex = idx;
            else {
                // 不在列表里就插入到当前
                SPEED_LIST.unshift(saved);
                currentSpeedIndex = 0;
            }
            setTimeout(() => {
                setPlaybackRate(saved);
                btnSpeed.textContent = saved + 'x';
            }, 1500);
        }
    })();

    // ==================== 包装字幕 + 样式 ====================
    let currentSubtitleEl = null;
    let contentObserver = null;

    function hasContent(el) {
        if (!el) return false;
        return (el.textContent || '').trim().length > 0;
    }

    function applySubtitleStyle(el) {
        if (!el) return;

        // 绝不碰 display，交给原网页控制 show/hide
        const hasText = hasContent(el);

        if (hasText) {
            Object.assign(el.style, {
                background: 'rgba(0, 0, 0, 0.65)',
                borderRadius: '20px',
                padding: '8px 20px',
                textAlign: 'center',
                maxWidth: '90%',
                boxSizing: 'border-box',
                pointerEvents: 'auto'
            });
        } else {
            Object.assign(el.style, {
                background: 'transparent',
                borderRadius: '0',
                padding: '0',
                maxWidth: '90%',
                boxSizing: 'border-box',
                pointerEvents: 'none'
            });
        }

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

        if (el.parentElement &&
            el.parentElement.classList.contains('subtitle-wrapper') &&
            el.parentElement.parentElement === ppt) {
            applySubtitleStyle(el);
            setupContentObserver(el);
            return true;
        }

        const oldWrappers = ppt.querySelectorAll('.subtitle-wrapper');
        oldWrappers.forEach(w => {
            if (w !== el.parentElement) w.remove();
        });

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
            zIndex: '1'
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

    function setupContentObserver(el) {
        if (currentSubtitleEl === el && contentObserver) return;

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
            subtree: true
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
