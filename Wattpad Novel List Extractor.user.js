// ==UserScript==
// @name         Wattpad Novel List Extractor
// @namespace    http://tampermonkey.net/
// @version      2026.07.14
// @description  Extrae novelas de listas Wattpad con menú flotante moderno, carga automática y vista previa
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

    /* ============================ CONFIG ============================ */

    const MENU_VISIBLE_KEY = 'wp_menu_visible';

    function isListPage() {
        // '/list/' o '/list' -> página general con todas tus listas, no una lista en sí
        // '/list/12345-nombre-de-la-lista' -> lista específica, esta es la que sirve
        const partes = location.pathname.split('/').filter(Boolean);
        return partes[0] === 'list' && partes.length >= 2;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ============================ OVERLAY ============================ */

    let overlay, overlayBox, overlayTexto, overlayBotonWrap;

    // opciones.boton = { texto, href } -> agrega un botón clickeable debajo del
    // mensaje y le da más tiempo antes de desaparecer. Sin ese parámetro se
    // comporta igual que antes: solo texto, se autooculta a los 2s.
    function showOverlay(text, opciones = {}) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'wp-ui';
            overlay.style.cssText = `
                position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
                z-index:999999999; pointer-events:none;
            `;
            overlayBox = document.createElement('div');
            overlayBox.style.cssText = `
                width:min(440px, 82vw);
                background:rgba(15,23,42,.92);
                backdrop-filter:blur(10px);
                color:#fff;
                border:1px solid rgba(255,255,255,.12);
                border-radius:16px;
                padding:18px 22px;
                font:600 17px/1.35 system-ui, -apple-system, sans-serif;
                text-align:center;
                box-shadow:0 16px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.03) inset;
            `;

            overlayTexto = document.createElement('div');
            overlayTexto.style.cssText = 'white-space:pre-line;';
            overlayBox.appendChild(overlayTexto);

            overlayBotonWrap = document.createElement('div');
            overlayBotonWrap.style.cssText = 'margin-top:14px; display:none;';
            overlayBox.appendChild(overlayBotonWrap);

            overlay.appendChild(overlayBox);
            document.documentElement.appendChild(overlay);
        }

        overlayTexto.textContent = text;
        overlay.style.display = 'block';
        overlay.style.opacity = '1';
        overlay.style.transition = 'none';

        overlayBotonWrap.innerHTML = '';
        if (opciones.boton) {
            overlayBox.style.pointerEvents = 'auto';
            overlayBotonWrap.style.display = 'block';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = opciones.boton.texto;
            btn.style.cssText = `
                border:none; border-radius:10px; padding:9px 20px;
                background:linear-gradient(135deg,#ffa552,#ff6600);
                color:white; font:600 13.5px system-ui, -apple-system, sans-serif;
                cursor:pointer; transition:filter .15s ease;
            `;
            btn.onmouseenter = () => { btn.style.filter = 'brightness(1.1)'; };
            btn.onmouseleave = () => { btn.style.filter = 'none'; };
            btn.onclick = () => { location.href = opciones.boton.href; };
            overlayBotonWrap.appendChild(btn);
        } else {
            overlayBox.style.pointerEvents = 'none';
            overlayBotonWrap.style.display = 'none';
        }

        clearTimeout(overlay._timer);
        const duracion = opciones.boton ? 6000 : 2000;
        overlay._timer = setTimeout(() => {
            overlay.style.transition = 'opacity .35s ease';
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 350);
        }, duracion);
    }

    function avisarNoEsLista() {
        // Si ya está en /list (la página general), el botón "Ir a Mis Listas"
        // no aporta nada -> solo el mensaje. El botón solo tiene sentido cuando
        // está en otra parte del sitio (una historia, el inicio, etc.).
        const enPaginaGeneral = /^\/list\/?$/.test(location.pathname);

        if (enPaginaGeneral) {
            showOverlay('📚 Debes escoger una lista');
        } else {
            showOverlay('📚 Debes escoger una lista', {
                boton: { texto: '📖 Ir a Mis Listas', href: 'https://www.wattpad.com/list' }
            });
        }
    }

    /* ============================ EXTRACT ============================ */

    function extractNovels() {
        const storyLinks = document.querySelectorAll('a[href*="/story/"]');
        const map = new Map();

        storyLinks.forEach(link => {
            const href = link.href;
            if (!href) return;

            let title = '';
            const titleElement = link.querySelector('.MF8XD');
            if (titleElement) title = titleElement.textContent?.trim();
            if (!title) title = link.textContent?.trim();
            if (!title || title.length < 2) return;

            const card = link.closest('.hMjEl');
            let pages = '?';

            if (card) {
                const srOnly = [...card.querySelectorAll('.sr-only')];
                const parts = srOnly.find(el => /Partes|Parts/i.test(el.textContent));
                if (parts) pages = parts.textContent.replace(/Partes|Parts/i, '').trim();
            }

            if (!map.has(href)) {
                map.set(href, { Title: title, Link: href, Pages: pages });
            }
        });

        return [...map.values()];
    }

    // Hace scroll hasta el final de la página repetidamente para forzar el
    // lazy-load de Wattpad, hasta que ni el alto del documento ni la cantidad
    // de novelas detectadas cambien durante varias rondas seguidas (señal de
    // que ya no queda nada más por cargar).
    async function cargarTodo() {
        let rondasSinCambios = 0;
        let alturaAnterior = document.documentElement.scrollHeight;
        let cantidadAnterior = extractNovels().length;

        showOverlay(`⏳ Cargando novelas...\n${cantidadAnterior} detectadas`);

        for (let i = 0; i < 200; i++) {
            window.scrollTo(0, document.documentElement.scrollHeight);
            await sleep(650);

            const alturaActual = document.documentElement.scrollHeight;
            const cantidadActual = extractNovels().length;

            showOverlay(`⏳ Cargando novelas...\n${cantidadActual} detectadas`);

            if (alturaActual === alturaAnterior && cantidadActual === cantidadAnterior) {
                rondasSinCambios++;
                if (rondasSinCambios >= 3) break;
            } else {
                rondasSinCambios = 0;
            }

            alturaAnterior = alturaActual;
            cantidadAnterior = cantidadActual;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        await sleep(150);
    }

    /* ============================ DESCARGAS ============================ */

    function downloadText(filename, text) {
        const a = document.createElement('a');
        a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async function exportTXT() {
        if (!isListPage()) return avisarNoEsLista();

        await cargarTodo();
        const data = extractNovels();
        if (!data.length) { alert('No se encontraron novelas'); return; }

        let result = `Lista: ${document.title}\nURL: ${location.href}\nTotal: ${data.length}\n\n`;
        data.forEach(n => {
            result += `Title: ${n.Title}\nLink: ${n.Link}\nPages: ${n.Pages}\n\n`;
        });

        downloadText('novel_list.txt', result);
        showOverlay(`📄 TXT exportado\n${data.length} novelas`);
        updateContador();
    }

    async function exportJSON() {
        if (!isListPage()) return avisarNoEsLista();

        await cargarTodo();
        const data = extractNovels();
        if (!data.length) { alert('No se encontraron novelas'); return; }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'novel_list.json';
        a.click();
        URL.revokeObjectURL(url);

        showOverlay(`📦 JSON exportado\n${data.length} novelas`);
        updateContador();
    }

    async function exportExcel() {
        if (!isListPage()) return avisarNoEsLista();

        await cargarTodo();
        const data = extractNovels();
        if (!data.length) { alert('No se encontraron novelas'); return; }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Novels');
        XLSX.writeFile(workbook, 'novel_list.xlsx');

        showOverlay(`📊 Excel exportado\n${data.length} novelas`);
        updateContador();
    }

    async function copyClipboard() {
        if (!isListPage()) return avisarNoEsLista();

        await cargarTodo();
        const data = extractNovels();
        if (!data.length) { alert('No se encontraron novelas'); return; }

        let text = '';
        data.forEach(n => {
            text += `${n.Title}\n${n.Link}\n${n.Pages}\n\n`;
        });

        try {
            await navigator.clipboard.writeText(text);
            showOverlay(`📋 Copiado\n${data.length} novelas`);
        } catch {
            alert('No se pudo copiar');
        }
        updateContador();
    }

    /* ============================ PANEL ============================ */

    let wpPanel, wpFab, contador;
    let panelAbierto = false;

    function updateContador() {
        if (!contador) return;

        if (!isListPage()) {
            contador.textContent = 'Ve a una lista para poder extraer';
            return;
        }

        const n = extractNovels().length;
        contador.textContent = `${n} novela${n === 1 ? '' : 's'} detectada${n === 1 ? '' : 's'} (visible ahora)`;
    }

    function toggleMenu(forzarEstado) {
        if (forzarEstado !== false && !isListPage()) {
            avisarNoEsLista();
            return;
        }

        const abrir = forzarEstado ?? !panelAbierto;
        panelAbierto = abrir;

        if (abrir) {
            updateContador();
            wpPanel.style.visibility = 'visible';
            wpPanel.style.pointerEvents = 'auto';
            setTimeout(() => {
                wpPanel.style.opacity = '1';
                wpPanel.style.transform = 'translateY(0) scale(1)';
            }, 10);
        } else {
            wpPanel.style.opacity = '0';
            wpPanel.style.transform = 'translateY(14px) scale(.96)';
            wpPanel.style.pointerEvents = 'none';
            setTimeout(() => { if (!panelAbierto) wpPanel.style.visibility = 'hidden'; }, 220);
        }

        wpFab.setAttribute('aria-expanded', String(abrir));
        wpFab.style.transform = abrir ? 'rotate(90deg)' : 'rotate(0deg)';
    }

    async function applyFloatingMenuVisibility() {
        const visible = await GM_getValue(MENU_VISIBLE_KEY, true);
        wpFab.style.display = visible ? 'flex' : 'none';
        if (!visible) toggleMenu(false);
    }

    async function toggleFloatingMenuVisibility() {
        const visible = await GM_getValue(MENU_VISIBLE_KEY, true);
        await GM_setValue(MENU_VISIBLE_KEY, !visible);
        applyFloatingMenuVisibility();
    }

    function crearBoton(container, text, gradient, action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = text;
        btn.onclick = action;
        btn.style.cssText = `
            width:100%; border:none; border-radius:10px; padding:11px 14px;
            background:${gradient}; color:white;
            font:600 13.5px system-ui, -apple-system, sans-serif; cursor:pointer;
            letter-spacing:.01em; text-align:left;
            transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
            box-shadow:0 2px 6px rgba(0,0,0,.3);
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 5px 14px rgba(0,0,0,.4)';
            btn.style.filter = 'brightness(1.1)';
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
            btn.style.filter = 'none';
        };
        container.appendChild(btn);
        return btn;
    }

    function createFloatingMenu() {
        if (wpPanel) return;

        wpPanel = document.createElement('div');
        wpPanel.className = 'wp-ui';
        wpPanel.style.cssText = `
            position:fixed; right:20px; bottom:76px;
            width:min(360px, 92vw);
            max-height:90vh;
            overflow-y:auto;
            background:linear-gradient(165deg, rgba(24,29,48,.97), rgba(10,13,24,.97));
            backdrop-filter:blur(14px);
            border:1px solid rgba(255,255,255,.08);
            border-radius:22px;
            padding:22px;
            display:flex; flex-direction:column; gap:11px;
            z-index:999999999;
            box-shadow:0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.02) inset;
            font-family:system-ui, -apple-system, sans-serif;
            opacity:0; visibility:hidden; pointer-events:none;
            transform:translateY(14px) scale(.96);
            transition:opacity .22s ease, transform .22s ease;
        `;
        document.documentElement.appendChild(wpPanel);

        /* HEADER */
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;';

        const tituloWrap = document.createElement('div');
        tituloWrap.style.cssText = 'display:flex; align-items:center; gap:10px;';

        const iconoTitulo = document.createElement('div');
        iconoTitulo.textContent = '📚';
        iconoTitulo.style.cssText = 'font-size:20px;';
        tituloWrap.appendChild(iconoTitulo);

        const tituloTextos = document.createElement('div');

        const titulo = document.createElement('div');
        titulo.textContent = 'Wattpad Extractor';
        titulo.style.cssText = `
            color:white; font-size:18px; font-weight:750; letter-spacing:-.01em;
        `;
        tituloTextos.appendChild(titulo);

        contador = document.createElement('div');
        contador.style.cssText = 'color:#64748b; font-size:11.5px;';
        tituloTextos.appendChild(contador);

        tituloWrap.appendChild(tituloTextos);
        header.appendChild(tituloWrap);

        const cerrarBtn = document.createElement('button');
        cerrarBtn.type = 'button';
        cerrarBtn.textContent = '✕';
        cerrarBtn.title = 'Cerrar';
        cerrarBtn.style.cssText = `
            background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
            color:#94a3b8; font-size:15px; width:30px; height:30px;
            cursor:pointer; line-height:1; border-radius:9px;
            display:flex; align-items:center; justify-content:center;
            flex-shrink:0;
            transition:background .15s ease, color .15s ease, transform .15s ease;
        `;
        cerrarBtn.onmouseenter = () => {
            cerrarBtn.style.background = 'rgba(255,255,255,.12)';
            cerrarBtn.style.color = 'white';
            cerrarBtn.style.transform = 'rotate(90deg)';
        };
        cerrarBtn.onmouseleave = () => {
            cerrarBtn.style.background = 'rgba(255,255,255,.05)';
            cerrarBtn.style.color = '#94a3b8';
            cerrarBtn.style.transform = 'rotate(0deg)';
        };
        cerrarBtn.onclick = () => toggleMenu(false);
        header.appendChild(cerrarBtn);

        wpPanel.appendChild(header);

        /* SEPARADOR */
        const separador = document.createElement('div');
        separador.style.cssText = 'height:1px; background:rgba(255,255,255,.08); margin:2px 0;';
        wpPanel.appendChild(separador);

        /* BOTONES */
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
        wpPanel.appendChild(buttonContainer);

        crearBoton(buttonContainer, '👁️ Ver lista', 'linear-gradient(135deg,#38bdf8,#0284c7)', verLista);
        crearBoton(buttonContainer, '📄 Exportar TXT', 'linear-gradient(135deg,#60a5fa,#2563eb)', exportTXT);
        crearBoton(buttonContainer, '📊 Exportar Excel', 'linear-gradient(135deg,#34d399,#059669)', exportExcel);
        crearBoton(buttonContainer, '📦 Exportar JSON', 'linear-gradient(135deg,#c084fc,#9333ea)', exportJSON);
        crearBoton(buttonContainer, '📋 Copiar lista', 'linear-gradient(135deg,#fb923c,#ea580c)', copyClipboard);

        const nota = document.createElement('div');
        nota.textContent = '💡 Todas las opciones cargan automáticamente toda la lista (scroll) antes de trabajar, no hace falta bajar la página a mano.';
        nota.style.cssText = 'color:#54607a; font-size:11px; font-style:italic;';
        wpPanel.appendChild(nota);

        /* FAB */
        wpFab = document.createElement('button');
        wpFab.type = 'button';
        wpFab.className = 'wp-ui';
        wpFab.textContent = '☰';
        wpFab.title = 'Menú de extracción';
        wpFab.setAttribute('aria-expanded', 'false');
        wpFab.style.cssText = `
            position:fixed; right:20px; bottom:20px; width:44px; height:44px;
            border:none; border-radius:50%;
            background:linear-gradient(140deg,#ffa552,#ff6600 60%,#c24d00);
            color:white; font-size:18px; font-weight:bold; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            z-index:999999999;
            box-shadow:0 6px 18px rgba(255,102,0,.4), 0 0 0 1px rgba(255,255,255,.08) inset;
            transition:transform .2s ease, box-shadow .2s ease;
        `;
        wpFab.onmouseenter = () => {
            wpFab.style.boxShadow = '0 10px 30px rgba(255,102,0,.6), 0 0 0 1px rgba(255,255,255,.08) inset';
        };
        wpFab.onmouseleave = () => {
            wpFab.style.boxShadow = '0 8px 24px rgba(255,102,0,.45), 0 0 0 1px rgba(255,255,255,.08) inset';
        };
        wpFab.onclick = () => toggleMenu();
        document.documentElement.appendChild(wpFab);

        /* CERRAR CON CLIC AFUERA / ESCAPE */
        document.addEventListener('click', e => {
            if (!panelAbierto) return;
            if (wpPanel.contains(e.target) || wpFab.contains(e.target)) return;
            toggleMenu(false);
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && panelAbierto) toggleMenu(false);
        });

        applyFloatingMenuVisibility();
    }

    /* ============================ MODAL: VER LISTA ============================ */

    let listModal, listContainer, listContador, listBuscador;
    let novelasActuales = [];

    function crearFilaNovela(n, index) {
        const fila = document.createElement('a');
        fila.href = n.Link;
        fila.target = '_blank';
        fila.rel = 'noopener noreferrer';
        fila.style.cssText = `
            display:flex; align-items:center; justify-content:space-between; gap:10px;
            padding:10px 12px; border-radius:10px;
            background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06);
            color:#e5e9f0; text-decoration:none; font-size:13px;
            transition:background .15s ease;
        `;
        fila.onmouseenter = () => { fila.style.background = 'rgba(255,255,255,.08)'; };
        fila.onmouseleave = () => { fila.style.background = 'rgba(255,255,255,.03)'; };

        const izq = document.createElement('span');
        izq.textContent = `${index + 1}. ${n.Title}`;
        izq.style.cssText = 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        fila.appendChild(izq);

        const der = document.createElement('span');
        der.textContent = n.Pages;
        der.style.cssText = 'color:#64748b; flex-shrink:0; font-size:11.5px;';
        fila.appendChild(der);

        return fila;
    }

    function renderListaModal(data) {
        listContainer.innerHTML = '';
        if (!data.length) {
            const vacio = document.createElement('div');
            vacio.textContent = 'No se encontraron novelas.';
            vacio.style.cssText = 'color:#64748b; font-size:13px; text-align:center; padding:20px 0;';
            listContainer.appendChild(vacio);
        } else {
            data.forEach((n, i) => listContainer.appendChild(crearFilaNovela(n, i)));
        }
        listContador.textContent = `${data.length} novela${data.length === 1 ? '' : 's'}`;
    }

    function filtrarListaModal(query) {
        const q = query.trim().toLowerCase();
        const filtradas = q ? novelasActuales.filter(n => n.Title.toLowerCase().includes(q)) : novelasActuales;

        listContainer.innerHTML = '';
        if (!filtradas.length) {
            const vacio = document.createElement('div');
            vacio.textContent = 'Sin coincidencias.';
            vacio.style.cssText = 'color:#64748b; font-size:13px; text-align:center; padding:20px 0;';
            listContainer.appendChild(vacio);
        } else {
            filtradas.forEach((n, i) => listContainer.appendChild(crearFilaNovela(n, i)));
        }
        listContador.textContent = q
            ? `${filtradas.length} de ${novelasActuales.length}`
            : `${novelasActuales.length} novela${novelasActuales.length === 1 ? '' : 's'}`;
    }

    function crearModalLista() {
        if (listModal) return;

        listModal = document.createElement('div');
        listModal.className = 'wp-ui';
        listModal.style.cssText = `
            position:fixed; inset:0; z-index:999999999;
            background:rgba(0,0,0,.55);
            display:none; align-items:center; justify-content:center;
            padding:20px; box-sizing:border-box;
        `;
        listModal.onclick = e => { if (e.target === listModal) cerrarModalLista(); };

        const box = document.createElement('div');
        box.style.cssText = `
            width:min(560px, 100%); max-height:82vh;
            background:linear-gradient(165deg, rgba(24,29,48,.98), rgba(10,13,24,.98));
            border:1px solid rgba(255,255,255,.08);
            border-radius:22px;
            padding:22px;
            display:flex; flex-direction:column; gap:12px;
            box-shadow:0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.02) inset;
            font-family:system-ui, -apple-system, sans-serif;
        `;
        listModal.appendChild(box);

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';

        const titulo = document.createElement('div');
        titulo.textContent = '👁️ Novelas detectadas';
        titulo.style.cssText = 'color:white; font-size:17px; font-weight:750; letter-spacing:-.01em;';
        header.appendChild(titulo);

        const cerrarBtn = document.createElement('button');
        cerrarBtn.type = 'button';
        cerrarBtn.textContent = '✕';
        cerrarBtn.title = 'Cerrar';
        cerrarBtn.style.cssText = `
            background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
            color:#94a3b8; font-size:15px; width:30px; height:30px;
            cursor:pointer; line-height:1; border-radius:9px;
            display:flex; align-items:center; justify-content:center;
            flex-shrink:0;
            transition:background .15s ease, color .15s ease, transform .15s ease;
        `;
        cerrarBtn.onmouseenter = () => {
            cerrarBtn.style.background = 'rgba(255,255,255,.12)';
            cerrarBtn.style.color = 'white';
            cerrarBtn.style.transform = 'rotate(90deg)';
        };
        cerrarBtn.onmouseleave = () => {
            cerrarBtn.style.background = 'rgba(255,255,255,.05)';
            cerrarBtn.style.color = '#94a3b8';
            cerrarBtn.style.transform = 'rotate(0deg)';
        };
        cerrarBtn.onclick = cerrarModalLista;
        header.appendChild(cerrarBtn);

        box.appendChild(header);

        listBuscador = document.createElement('input');
        listBuscador.type = 'text';
        listBuscador.placeholder = '🔍 Filtrar por título...';
        listBuscador.style.cssText = `
            width:100%; box-sizing:border-box;
            background:rgba(0,0,0,.35); color:#e5e9f0;
            border:1px solid rgba(255,255,255,.09); border-radius:12px;
            padding:10px 12px; font-size:13.5px; outline:none;
            transition:border-color .15s ease, box-shadow .15s ease;
        `;
        listBuscador.onfocus = () => {
            listBuscador.style.borderColor = '#4fc3ff';
            listBuscador.style.boxShadow = '0 0 0 3px rgba(79,195,255,.15)';
        };
        listBuscador.onblur = () => {
            listBuscador.style.borderColor = 'rgba(255,255,255,.09)';
            listBuscador.style.boxShadow = 'none';
        };
        listBuscador.oninput = () => filtrarListaModal(listBuscador.value);
        box.appendChild(listBuscador);

        listContador = document.createElement('div');
        listContador.style.cssText = 'color:#64748b; font-size:11.5px;';
        box.appendChild(listContador);

        listContainer = document.createElement('div');
        listContainer.style.cssText = `
            overflow-y:auto; display:flex; flex-direction:column; gap:6px;
            padding-right:2px;
        `;
        box.appendChild(listContainer);

        document.documentElement.appendChild(listModal);
    }

    function cerrarModalLista() {
        if (listModal) listModal.style.display = 'none';
    }

    async function verLista() {
        if (!isListPage()) return avisarNoEsLista();

        crearModalLista();
        toggleMenu(false);
        listModal.style.display = 'flex';
        listBuscador.value = '';
        listContador.textContent = 'Cargando...';
        listContainer.innerHTML = '';

        await cargarTodo();

        novelasActuales = extractNovels();
        renderListaModal(novelasActuales);
        showOverlay(`👁️ ${novelasActuales.length} novelas cargadas`);
        updateContador();
    }

    /* ============================ ESTILOS ============================ */

    GM_addStyle(`::selection { background:#ff6600; color:white; }`);

    /* ============================ KEEP ALIVE ============================ */

    // Wattpad es una SPA (y usa hidratación); en algún momento puede desprender
    // el FAB/panel/modal del DOM. Antes esto se revisaba con un setInterval
    // cada 1.5s, lo que generaba un parpadeo visible (el botón desaparecía y
    // recién se reinsertaba hasta 1.5s después). Con un MutationObserver la
    // reinserción ocurre en el mismo tick en que se detecta la desconexión,
    // eliminando ese hueco visible. Se deja un intervalo de respaldo, mucho
    // menos frecuente, solo por si algún caso raro no dispara el observer.
    function reinsertarSiHaceFalta() {
        if (wpFab && !document.documentElement.contains(wpFab)) {
            document.documentElement.appendChild(wpFab);
        }
        if (wpPanel && !document.documentElement.contains(wpPanel)) {
            document.documentElement.appendChild(wpPanel);
        }
        if (listModal && !document.documentElement.contains(listModal)) {
            document.documentElement.appendChild(listModal);
        }
        if (overlay && !document.documentElement.contains(overlay)) {
            document.documentElement.appendChild(overlay);
        }
    }

    function iniciarWatchdog() {
        const watchdog = new MutationObserver(reinsertarSiHaceFalta);
        watchdog.observe(document.documentElement, { childList: true });

        // Si Wattpad reemplaza por completo el <html> (típico de una hidratación
        // tardía, justo después de la carga), el MutationObserver de arriba queda
        // observando un nodo que ya no forma parte del documento vivo y deja de
        // disparar. Para no depender solo de eso, los primeros 8 segundos se
        // revisa cada 300ms (la ventana donde ocurre ese reemplazo), de forma que
        // la reaparición del botón sea casi imperceptible en vez de tardar los
        // ~5s del chequeo de respaldo normal.
        const inicio = Date.now();
        const intervaloRapido = setInterval(() => {
            reinsertarSiHaceFalta();
            if (Date.now() - inicio > 8000) {
                clearInterval(intervaloRapido);
                setInterval(reinsertarSiHaceFalta, 5000);
            }
        }, 300);
    }

    /* ============================ INIT ============================ */

    function init() {
        createFloatingMenu();
        iniciarWatchdog();
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    }

    /* ============================ SPA WATCHER ============================ */

    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (panelAbierto) toggleMenu(false);
            updateContador();
        }
    }, 1000);

    GM_registerMenuCommand('☰ Mostrar/Ocultar botón flotante', toggleFloatingMenuVisibility);

})();
