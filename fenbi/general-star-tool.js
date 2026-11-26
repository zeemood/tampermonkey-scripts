// ==UserScript==
// @name         粉笔通用收藏工具条
// @namespace    http://tampermonkey.net/
// @version      2026-11-15
// @description  可拖拽工具条 + 按模块收藏/取消收藏（带全局遮罩Loading）
// @author       You
// @match        https://spa.fenbi.com/ti/exam/exercise/*?routecs=xingce&examcatid=*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=fenbi.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let isProcessing = false; // 防止重复点击

    // ========== 创建全局遮罩 + Loading ==========
    const overlay = document.createElement('div');
    overlay.id = 'fenbi-loading-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 100000;
        display: none;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    overlay.innerHTML = `
        <div style="
            background: rgba(0, 0, 0, 0.75);
            padding: 24px 36px;
            border-radius: 12px;
            text-align: center;
            color: #fff;
            min-width: 200px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        ">
            <div style="
                width: 36px;
                height: 36px;
                border: 3px solid rgba(255,255,255,0.3);
                border-top-color: #fff;
                border-radius: 50%;
                margin: 0 auto 16px;
                animation: fenbi-spin 0.8s linear infinite;
            "></div>
            <div id="fenbi-loading-text" style="font-size: 15px; font-weight: 500;">处理中...</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 8px;">请稍候，不要操作页面</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 添加旋转动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fenbi-spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    function showLoading(text = '处理中...') {
        const textEl = document.getElementById('fenbi-loading-text');
        if (textEl) textEl.textContent = text;
        overlay.style.display = 'flex';
    }

    function hideLoading() {
        overlay.style.display = 'none';
    }

    // ========== 获取模块分组 ==========
    function getModules() {
        const chapters = Array.from(document.querySelectorAll('div.chapter-container'));
        const allCollects = Array.from(document.querySelectorAll('li.collect.tool.ng-star-inserted'));
        const modules = [];

        if (chapters.length === 0) {
            if (allCollects.length > 0) {
                modules.push({ name: '全部题目', collects: allCollects });
            }
            return modules;
        }

        for (let i = 0; i < chapters.length; i++) {
            const chap = chapters[i];
            const nameEl = chap.querySelector('div.chapter-name');
            const name = nameEl ? nameEl.textContent.trim() : `模块 ${i + 1}`;
            const nextChap = chapters[i + 1] || null;

            const collects = allCollects.filter(col => {
                const afterChap = (chap.compareDocumentPosition(col) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
                const beforeNext = nextChap
                    ? (nextChap.compareDocumentPosition(col) & Node.DOCUMENT_POSITION_PRECEDING) !== 0
                    : true;
                return afterChap && beforeNext;
            });

            modules.push({ name, collects });
        }

        // 第一个模块之前的题目（如果有）
        const firstChap = chapters[0];
        const before = allCollects.filter(col =>
            (firstChap.compareDocumentPosition(col) & Node.DOCUMENT_POSITION_PRECEDING) !== 0
        );
        if (before.length > 0) {
            modules.unshift({ name: '前置题目', collects: before });
        }

        return modules;
    }

    // ========== 收藏 / 取消收藏 ==========
    async function collectModule(mod, isCollect) {
        if (isProcessing) {
            alert('正在处理中，请稍候...');
            return;
        }

        const targets = mod.collects.filter(li => {
            const svg = li.querySelector('svg.tool-icon');
            if (!svg) return false;
            const hasActive = svg.classList.contains('active');
            return isCollect ? !hasActive : hasActive;
        });

        if (targets.length === 0) {
            alert(isCollect ? `「${mod.name}」没有可收藏的题目` : `「${mod.name}」没有已收藏的题目`);
            return;
        }

        isProcessing = true;
        const actionText = isCollect ? '收藏' : '取消收藏';

        try {
            showLoading(`正在${actionText} 0/${targets.length}...`);

            for (let i = 0; i < targets.length; i++) {
                showLoading(`正在${actionText} ${i + 1}/${targets.length}...`);
                targets[i].click();
                await new Promise(r => setTimeout(r, 300));
            }

            hideLoading();
            alert(`模块「${mod.name}」${actionText}完毕（${targets.length} 题）`);
        } catch (err) {
            hideLoading();
            console.error(err);
            alert('操作过程中出现错误，请刷新页面后重试');
        } finally {
            isProcessing = false;
        }
    }

    // ========== 创建工具条 ==========
    const toolbar = document.createElement('div');
    toolbar.id = 'fenbi-collect-toolbar';
    toolbar.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        border-radius: 8px;
        background: #fff;
        min-width: 260px;
        user-select: none;
    `;

    toolbar.innerHTML = `
        <div class="toolbar-header" style="
            cursor: move;
            padding: 10px 14px;
            background: #4a90d9;
            color: #fff;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
        ">
            <span>粉笔收藏工具</span>
            <button id="toggle-drawer" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: #fff;
                width: 28px;
                height: 28px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                line-height: 1;
            ">▼</button>
        </div>
        <div class="toolbar-drawer" style="
            display: none;
            padding: 12px;
            max-height: 420px;
            overflow-y: auto;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
        ">
            <div id="total-info" style="
                margin-bottom: 12px;
                padding: 8px 10px;
                background: #f5f7fa;
                border-radius: 6px;
                font-weight: 600;
                color: #333;
            ">题目总数: 0</div>
            <div id="modules-list"></div>
            <div style="margin-top: 10px; text-align: right;">
                <button id="refresh-btn" style="
                    padding: 4px 10px;
                    background: #f0f0f0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">刷新列表</button>
            </div>
        </div>
    `;

    document.body.appendChild(toolbar);

    // ========== 拖拽 ==========
    const header = toolbar.querySelector('.toolbar-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
        if (e.target.id === 'toggle-drawer') return;
        isDragging = true;
        const rect = toolbar.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        toolbar.style.transition = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        toolbar.style.left = (startLeft + dx) + 'px';
        toolbar.style.top = (startTop + dy) + 'px';
        toolbar.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // ========== 展开/收起抽屉 ==========
    const drawer = toolbar.querySelector('.toolbar-drawer');
    const toggleBtn = toolbar.querySelector('#toggle-drawer');
    let isOpen = false;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        drawer.style.display = isOpen ? 'block' : 'none';
        toggleBtn.textContent = isOpen ? '▲' : '▼';
        if (isOpen) refreshUI();
    });

    // ========== 刷新 UI ==========
    function refreshUI() {
        const modules = getModules();
        const total = document.querySelectorAll('li.collect.tool.ng-star-inserted').length;
        document.getElementById('total-info').textContent = `题目总数: ${total}`;

        const list = document.getElementById('modules-list');
        list.innerHTML = '';

        if (modules.length === 0) {
            list.innerHTML = '<div style="color:#999;padding:10px 0;">未检测到题目或模块</div>';
            return;
        }

        modules.forEach((mod, idx) => {
            const item = document.createElement('div');
            item.style.cssText = `
                margin-bottom: 10px;
                padding: 10px;
                border: 1px solid #eee;
                border-radius: 6px;
                background: #fafafa;
            `;
            item.innerHTML = `
                <div style="font-weight:600;margin-bottom:8px;color:#333;">
                    ${mod.name}
                </div>
                <button class="btn-collect" data-idx="${idx}" style="
                    margin-right: 6px;
                    padding: 5px 12px;
                    background: #4a90d9;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">收藏</button>
                <button class="btn-uncollect" data-idx="${idx}" style="
                    padding: 5px 12px;
                    background: #e74c3c;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">取消收藏</button>
            `;
            list.appendChild(item);
        });

        // 绑定事件
        list.querySelectorAll('.btn-collect').forEach(btn => {
            btn.addEventListener('click', () => {
                collectModule(modules[Number(btn.dataset.idx)], true);
            });
        });
        list.querySelectorAll('.btn-uncollect').forEach(btn => {
            btn.addEventListener('click', () => {
                collectModule(modules[Number(btn.dataset.idx)], false);
            });
        });
    }

    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', refreshUI);

    // 页面加载后稍等再初始化
    setTimeout(() => {
        // 可选：自动展开一次
        // toggleBtn.click();
    }, 1500);

})();
