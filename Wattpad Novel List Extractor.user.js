// ==UserScript==
// @name         Wattpad Novel List Extractor
// @namespace    http://tampermonkey.net/
// @version      2024.10.12
// @description  Extrae títulos, enlaces y número de páginas de novelas de Wattpad y guarda en archivo txt o excel.
// @author       wernser412
// @match        https://www.wattpad.com/list/*
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Función para descargar archivo .txt
    function downloadText(filename, text) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    // Función para descargar archivo Excel
    function downloadExcel(data, listTitle, listURL) {
        // Creamos una hoja de cálculo con los datos del título en las primeras filas
        const worksheet = XLSX.utils.aoa_to_sheet([
            [`List: ${listTitle}`],  // Primera fila: Título de la página
            [`URL: ${listURL}`],     // Segunda fila: URL de la página
            [],                      // Tercera fila: fila vacía
            ['Title', 'Link', 'Pages'] // Cuarta fila: encabezados de la tabla
        ]);

        // Añadimos los datos a partir de la fila 5
        XLSX.utils.sheet_add_json(worksheet, data, { origin: 'A5', skipHeader: true });

        // Crear y descargar el archivo Excel
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Novels");
        XLSX.writeFile(workbook, "novel_list.xlsx");
    }

    // Extrae títulos, enlaces y número de páginas de las novelas
    function extractTitlesLinksAndPages() {
        const novels = document.querySelectorAll('.list-group-item');
        const listTitle = document.title || 'Sin título'; // Obtiene el título de la página
        const listURL = window.location.href; // URL de la lista
        let result = `Lista: ${listTitle}\nURL: ${listURL}\n\n`; // Agrega el título y la URL al principio
        let excelData = [];

        if (novels.length === 0) {
            alert("No se encontraron novelas. Asegúrate de estar en la lista correcta.");
            return { result, excelData, listTitle, listURL };
        }

        novels.forEach(novel => {
            const titleElement = novel.querySelector('.content h5 a');
            const linkElement = titleElement;
            const pagesElement = novel.querySelector('.numParts');

            if (titleElement && linkElement && pagesElement) {
                const title = titleElement.innerText;
                const link = linkElement.href;
                const pages = pagesElement.innerText;

                result += `Title: ${title}\nLink: ${link}\nPages: ${pages}\n\n`;
                excelData.push({ Title: title, Link: link, Pages: pages });
            } else {
                console.log('Elemento no encontrado', novel);
            }
        });

        return { result, excelData, listTitle, listURL };
    }

    // Función para descargar lista en formato texto
    function downloadTextList() {
        const { result } = extractTitlesLinksAndPages();
        if (result.trim()) {
            downloadText("novel_list.txt", result);
        } else {
            alert("No se encontraron novelas con títulos, enlaces y páginas.");
        }
    }

    // Función para descargar lista en formato Excel
    function downloadExcelList() {
        const { excelData, listTitle, listURL } = extractTitlesLinksAndPages();
        if (excelData.length) {
            downloadExcel(excelData, listTitle, listURL);
        } else {
            alert("No se encontraron novelas con títulos, enlaces y páginas.");
        }
    }

    // Agregar los comandos al menú de Tampermonkey
    GM_registerMenuCommand("Descargar lista (Texto)", downloadTextList);
    GM_registerMenuCommand("Descargar lista (Excel)", downloadExcelList);
})();
