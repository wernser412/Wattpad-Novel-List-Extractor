// ==UserScript==
// @name         Wattpad Novel List Extractor
// @namespace    http://tampermonkey.net/
// @version      2025.09.19
// @description  Extrae títulos, enlaces y número de páginas de novelas de Wattpad y guarda en archivo txt o excel.
// @author       wernser412
// @downloadURL  https://github.com/wernser412/Wattpad-Novel-List-Extractor/raw/refs/heads/main/Wattpad%20Novel%20List%20Extractor.user.js
// @icon         https://raw.githubusercontent.com/wernser412/Wattpad-Novel-List-Extractor/3ac9664ac4c5425310eb18e531e71b74ed206f41/ICONO.svg
// @match        https://www.wattpad.com/list/*
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Function to download a .txt file
    function downloadText(filename, text) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    // Function to download an Excel file
    function downloadExcel(data, listTitle, listURL) {
        // Create a worksheet with the list title and URL at the top
        const worksheet = XLSX.utils.aoa_to_sheet([
            [`List: ${listTitle}`],  // First row: page title
            [`URL: ${listURL}`],     // Second row: page URL
            [],                      // Third row: empty row
            ['Title', 'Link', 'Pages'] // Fourth row: table headers
        ]);

        // Add the data starting from the fifth row
        XLSX.utils.sheet_add_json(worksheet, data, { origin: 'A5', skipHeader: true });

        // Create and download the Excel file
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Novels");
        XLSX.writeFile(workbook, "novel_list.xlsx");
    }

    // Extract titles, links, and the number of pages of novels
    function extractTitlesLinksAndPages() {
        const novels = document.querySelectorAll('.list-group-item');
        const totalNovels = novels.length;
        const listTitle = (document.title || 'Sin título') + ` (Total: ${totalNovels})`; // Get the page title and add the total count
        const listURL = window.location.href; // Get the list URL
        let result = `Lista: ${listTitle}\nURL: ${listURL}\n\n`; // Add title and URL at the beginning
        let excelData = [];

        if (totalNovels === 0) {
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

    // Function to download the list in text format
    function downloadTextList() {
        const { result } = extractTitlesLinksAndPages();
        if (result.trim()) {
            downloadText("novel_list.txt", result);
        } else {
            alert("No se encontraron novelas con títulos, enlaces y páginas.");
        }
    }

    // Function to download the list in Excel format
    function downloadExcelList() {
        const { excelData, listTitle, listURL } = extractTitlesLinksAndPages();
        if (excelData.length) {
            downloadExcel(excelData, listTitle, listURL);
        } else {
            alert("No se encontraron novelas con títulos, enlaces y páginas.");
        }
    }

    // Add commands to the Tampermonkey menu
    GM_registerMenuCommand("Descargar lista (Texto)", downloadTextList);
    GM_registerMenuCommand("Descargar lista (Excel)", downloadExcelList);
})();
