// ==UserScript==
// @name         Wattpad Novel List Extractor
// @namespace    http://tampermonkey.net/
// @version      2026.05.26
// @description  Extrae novelas de listas Wattpad con menú global
// @author       wernser412
// @match        https://www.wattpad.com/*
// @downloadURL  https://github.com/wernser412/Wattpad-Novel-List-Extractor/raw/refs/heads/main/Wattpad%20Novel%20List%20Extractor.user.js
// @icon         https://raw.githubusercontent.com/wernser412/Wattpad-Novel-List-Extractor/3ac9664ac4c5425310eb18e531e71b74ed206f41/ICONO.svg
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {

'use strict';

/* =========================================
VALIDAR PAGINA
========================================= */

function isListPage() {

    return location.pathname.startsWith(
        "/list/"
    );
}

/* ========================================= */

const MENU_VISIBLE_KEY =
    "wp_menu_visible";

/* ========================================= */

let wpPanel;

let wpFab;

let overlay;

let stopScroll = false;

let scrolling = false;

/* =========================================
OVERLAY
========================================= */

function showOverlay(text) {

    if (!overlay) {

        overlay =
            document.createElement("div");

        overlay.style.cssText = `
            position:fixed;
            top:50%;
            left:50%;
            transform:translate(-50%,-50%);
            z-index:999999999;
            pointer-events:none;
        `;

        const box =
            document.createElement("div");

        box.style.cssText = `
            width:420px;
            background:#0b1220;
            color:#fff;
            border:4px solid #ff6600;
            border-radius:20px;
            padding:20px;
            font-size:20px;
            font-weight:bold;
            text-align:center;
            white-space:pre-line;
            box-shadow:0 10px 30px rgba(0,0,0,.5);
        `;

        overlay.appendChild(box);

        document.documentElement.appendChild(
            overlay
        );
    }

    overlay.firstChild.textContent =
        text;

    overlay.style.display =
        "block";

    clearTimeout(
        overlay._timeout
    );

    overlay._timeout =
        setTimeout(() => {

            overlay.style.display =
                "none";

        }, 2200);
}

/* =========================================
EXTRACT
========================================= */

function extractNovels() {

    const storyLinks =
        document.querySelectorAll(
            'a[href*="/story/"]'
        );

    const map =
        new Map();

    storyLinks.forEach(link => {

        const href =
            link.href;

        if (!href)
            return;

        let title =
            "";

        const titleElement =
            link.querySelector(
                ".MF8XD"
            );

        if (titleElement) {

            title =
                titleElement.textContent
                    ?.trim();
        }

        if (!title) {

            title =
                link.textContent
                    ?.trim();
        }

        if (
            !title ||
            title.length < 2
        ) return;

        const card =
            link.closest(
                ".hMjEl"
            );

        let pages =
            "?";

        if (card) {

            const srOnly =
                [
                    ...card.querySelectorAll(
                        ".sr-only"
                    )
                ];

            const parts =
                srOnly.find(el =>

                    /Partes|Parts/i.test(
                        el.textContent
                    )
                );

            if (parts) {

                pages =
                    parts.textContent

                        .replace(
                            /Partes|Parts/i,
                            ""
                        )

                        .trim();
            }
        }

        if (!map.has(href)) {

            map.set(href, {

                Title: title,

                Link: href,

                Pages: pages
            });
        }
    });

    return [...map.values()];
}

/* =========================================
DOWNLOAD TXT
========================================= */

function downloadText(
    filename,
    text
) {

    const a =
        document.createElement("a");

    a.href =
        'data:text/plain;charset=utf-8,' +

        encodeURIComponent(text);

    a.download =
        filename;

    document.body.appendChild(a);

    a.click();

    a.remove();
}

/* =========================================
EXPORT TXT
========================================= */

function exportTXT() {

    if (!isListPage()) {

        showOverlay(
`📚 Debes escoger una lista

https://www.wattpad.com/list`
        );

        return;
    }

    const data =
        extractNovels();

    if (!data.length) {

        alert(
            "No se encontraron novelas"
        );

        return;
    }

    let result =

`Lista: ${document.title}
URL: ${location.href}
Total: ${data.length}

`;

    data.forEach(n => {

        result +=

`Title: ${n.Title}
Link: ${n.Link}
Pages: ${n.Pages}

`;
    });

    downloadText(
        "novel_list.txt",
        result
    );

    showOverlay(
        `📄 TXT exportado\n${data.length} novelas`
    );
}

/* =========================================
EXPORT JSON
========================================= */

function exportJSON() {

    if (!isListPage()) {

        showOverlay(
`📚 Debes escoger una lista

https://www.wattpad.com/list`
        );

        return;
    }

    const data =
        extractNovels();

    if (!data.length) {

        alert(
            "No se encontraron novelas"
        );

        return;
    }

    const blob =
        new Blob(

            [
                JSON.stringify(
                    data,
                    null,
                    2
                )
            ],

            {
                type:
                    'application/json'
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const a =
        document.createElement("a");

    a.href =
        url;

    a.download =
        "novel_list.json";

    a.click();

    URL.revokeObjectURL(
        url
    );

    showOverlay(
        `📦 JSON exportado\n${data.length} novelas`
    );
}

/* =========================================
EXPORT EXCEL
========================================= */

function exportExcel() {

    if (!isListPage()) {

        showOverlay(
`📚 Debes escoger una lista

https://www.wattpad.com/list`
        );

        return;
    }

    const data =
        extractNovels();

    if (!data.length) {

        alert(
            "No se encontraron novelas"
        );

        return;
    }

    const worksheet =
        XLSX.utils.json_to_sheet(
            data
        );

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(

        workbook,

        worksheet,

        "Novels"
    );

    XLSX.writeFile(

        workbook,

        "novel_list.xlsx"
    );

    showOverlay(
        `📊 Excel exportado\n${data.length} novelas`
    );
}

/* =========================================
COPY
========================================= */

async function copyClipboard() {

    if (!isListPage()) {

        showOverlay(
`📚 Debes escoger una lista

https://www.wattpad.com/list`
        );

        return;
    }

    const data =
        extractNovels();

    if (!data.length) {

        alert(
            "No se encontraron novelas"
        );

        return;
    }

    let text = "";

    data.forEach(n => {

        text +=

`${n.Title}
${n.Link}
${n.Pages}

`;
    });

    try {

        await navigator.clipboard.writeText(
            text
        );

        showOverlay(
            `📋 Copiado\n${data.length} novelas`
        );

    } catch {

        alert(
            "No se pudo copiar"
        );
    }
}

/* =========================================
AUTO SCROLL
========================================= */

async function autoScroll() {

    if (!isListPage()) {

        showOverlay(
`📚 Debes escoger una lista

https://www.wattpad.com/list`
        );

        return;
    }

    if (scrolling)
        return;

    scrolling = true;

    stopScroll = false;

    let lastCount = 0;

    let stableRounds = 0;

    while (!stopScroll) {

        window.scrollTo(

            0,

            document.body.scrollHeight
        );

        await new Promise(
            r => setTimeout(r, 1800)
        );

        const count =
            extractNovels().length;

        showOverlay(
            `📚 Novelas: ${count}`
        );

        if (count === lastCount) {

            stableRounds++;

        } else {

            stableRounds = 0;
        }

        if (stableRounds >= 3) {

            break;
        }

        lastCount =
            count;
    }

    scrolling = false;

    showOverlay(
        "✅ Scroll completado"
    );
}

function stopAutoScroll() {

    stopScroll = true;

    showOverlay(
        "⛔ Scroll detenido"
    );
}

/* =========================================
MENU
========================================= */

function toggleMenu() {

    if (!isListPage()) {

        showOverlay(
`📚 Debes escoger una lista

Ir a:
https://www.wattpad.com/list`
        );

        return;
    }

    wpPanel.style.display =

        wpPanel.style.display === "flex"

            ? "none"

            : "flex";
}

async function applyFloatingMenuVisibility() {

    const visible =
        await GM_getValue(
            MENU_VISIBLE_KEY,
            true
        );

    wpFab.style.display =
        visible
            ? "block"
            : "none";

    if (!visible) {

        wpPanel.style.display =
            "none";
    }
}

async function toggleFloatingMenuVisibility() {

    const visible =
        await GM_getValue(
            MENU_VISIBLE_KEY,
            true
        );

    await GM_setValue(
        MENU_VISIBLE_KEY,
        !visible
    );

    applyFloatingMenuVisibility();
}

/* =========================================
BUTTON
========================================= */

function addButton(
    text,
    color,
    action
) {

    const btn =
        document.createElement(
            "button"
        );

    btn.textContent =
        text;

    btn.onclick =
        action;

    btn.style.cssText = `
        width:240px;
        border:none;
        border-radius:14px;
        padding:14px 16px;
        background:${color};
        color:white;
        font-size:15px;
        font-weight:600;
        text-align:left;
        cursor:pointer;
        box-shadow:0 4px 12px rgba(0,0,0,.35);
        transition:transform .15s;
    `;

    btn.onmouseenter = () => {

        btn.style.transform =
            "translateY(-2px)";
    };

    btn.onmouseleave = () => {

        btn.style.transform =
            "translateY(0)";
    };

    wpPanel.appendChild(
        btn
    );
}

/* =========================================
CREATE MENU
========================================= */

async function createFloatingMenu() {

    if (wpPanel)
        return;

    wpPanel =
        document.createElement(
            "div"
        );

    wpPanel.style.cssText = `
        position:fixed;
        right:20px;
        bottom:90px;
        display:none;
        flex-direction:column;
        gap:10px;
        z-index:999999999;
    `;

    document.documentElement.appendChild(
        wpPanel
    );

    addButton(
        "📄 Exportar TXT",
        "#2563eb",
        exportTXT
    );

    addButton(
        "📊 Exportar Excel",
        "#16a34a",
        exportExcel
    );

    addButton(
        "📦 Exportar JSON",
        "#9333ea",
        exportJSON
    );

    addButton(
        "📋 Copiar lista",
        "#ea580c",
        copyClipboard
    );

    addButton(
        "⬇ Auto Scroll",
        "#ff006e",
        autoScroll
    );

    addButton(
        "⛔ Detener Scroll",
        "#dc2626",
        stopAutoScroll
    );

    wpFab =
        document.createElement(
            "button"
        );

    wpFab.textContent =
        "☰";

    wpFab.title =
        "Menú";

    wpFab.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        width:60px;
        height:60px;
        border:none;
        border-radius:50%;
        background:#ff6600;
        color:white;
        font-size:28px;
        font-weight:bold;
        cursor:pointer;
        z-index:999999999;
        box-shadow:0 4px 12px rgba(0,0,0,.4);
        transition:transform .15s;
    `;

    wpFab.onmouseenter = () => {

        wpFab.style.transform =
            "scale(1.08)";
    };

    wpFab.onmouseleave = () => {

        wpFab.style.transform =
            "scale(1)";
    };

    wpFab.onclick =
        toggleMenu;

    document.documentElement.appendChild(
        wpFab
    );

    applyFloatingMenuVisibility();
}

/* =========================================
KEEP ALIVE
========================================= */

setInterval(() => {

    if (
        wpFab &&
        !document.documentElement.contains(
            wpFab
        )
    ) {

        document.documentElement.appendChild(
            wpFab
        );
    }

    if (
        wpPanel &&
        !document.documentElement.contains(
            wpPanel
        )
    ) {

        document.documentElement.appendChild(
            wpPanel
        );
    }

}, 1500);

/* =========================================
STYLE
========================================= */

GM_addStyle(`

::selection{

    background:#ff6600;
    color:white;
}

`);

/* =========================================
INIT
========================================= */

function init() {

    createFloatingMenu();
}

init();

/* =========================================
SPA WATCHER
========================================= */

let lastUrl =
    location.href;

setInterval(() => {

    if (location.href !== lastUrl) {

        lastUrl =
            location.href;

        createFloatingMenu();
    }

}, 1000);

/* =========================================
TAMPERMONKEY MENU
========================================= */

GM_registerMenuCommand(

    "☰ Mostrar/Ocultar botón flotante",

    toggleFloatingMenuVisibility
);

})();
