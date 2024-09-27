// ==UserScript==
// @name         Wattpad Novel List Extractor
// @namespace    http://tampermonkey.net/
// @version      2024.09.26
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
    function downloadExcel(data) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Novels");
        XLSX.writeFile(workbook, "novel_list.xlsx");
    }

    // Extrae títulos, enlaces y número de páginas de las novelas
    function extractTitlesLinksAndPages() {
        const novels = document.querySelectorAll('.list-group-item');
        let result = '';
        let excelData = [];

        if (novels.length === 0) {
            alert("No se encontraron novelas. Asegúrate de estar en la lista correcta.");
            return;
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

        return { result, excelData };
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
        const { excelData } = extractTitlesLinksAndPages();
        if (excelData.length) {
            downloadExcel(excelData);
        } else {
            alert("No se encontraron novelas con títulos, enlaces y páginas.");
        }
    }

    // Agregar los comandos al menú de Tampermonkey
    GM_registerMenuCommand("Descargar lista (Texto)", downloadTextList);
    GM_registerMenuCommand("Descargar lista (Excel)", downloadExcelList);
})();
