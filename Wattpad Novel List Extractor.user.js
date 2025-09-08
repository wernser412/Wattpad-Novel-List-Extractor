// ==UserScript==
// @name         Wattpad Novel List Extractor
// @namespace    http://tampermonkey.net/
// @version      2025.09.08
// @description  Extrae títulos, enlaces y número de páginas de novelas de Wattpad y guarda en archivo txt o excel.
// @author       wernser412
// @downloadURL  https://github.com/wernser412/Wattpad-Novel-List-Extractor/raw/refs/heads/main/Wattpad%20Novel%20List%20Extractor.user.js
// @icon         data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzciIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAzNyAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcuNDQ3NjMgMjcuMzkxMkMxMi45Njk4IDI3LjM5MTIgMTMuNzQ1OSAyMC43Mjk5IDE3LjUxNjkgMTQuNzgzN0MxNy4zNzc2IDE2LjkwOTUgMTcuNTA2OSAxOC43OTAzIDE3LjkyNDggMjAuMDgzNEMxOS41NjY2IDI1LjE4NzEgMjUuMjE4MSAyNS41Nzg5IDI3Ljc4NTIgMjAuMzk2OEMzMS40MDY5IDEzLjA4OSAzMi40NDE3IDExLjM2NDkgMzYuMDkzMyA2LjEwNDQ5QzM4LjUwMTIgMi42MjY5MSAzNS43MDUyIDAuMzgzNjI4IDMyLjQ3MTUgMS45OTk5N0MzMC44MDk5IDIuODMyNjMgMjguMTEzNSA0Ljg5OTU4IDI0Ljc1MDQgOS4yOTc5OEMyNS4zMzc1IDUuOTU3NTUgMjUuMTc4MyAwLjI5NTQ2NCAyMC4yODMgMC42MTg3MzJDMTcuNjk2IDAuNzg1MjY0IDE0LjM0MjkgMy42NjUyOSA5Ljc2NTk1IDExLjA0MTdDMTAuMTQ0IDYuODk3OTYgMTAuMjkzMyAzLjk1OTE3IDguNDYyNTIgMi40MjExOUM3LjIwODg0IDEuMzYzMjMgNC4yNTM3MyAwLjk2MTU5MiAyLjQ4MjY1IDMuMjI0NDdDMC43MDE2MjcgNS41MDY5MyAwLjI4MzczMyA5Ljk1NDMxIDAuNDYyODMgMTQuNjM2OEMwLjgxMTA3NiAyNC40NDI2IDQuMzMzMzMgMjcuMzkxMiA3LjQ0NzYzIDI3LjM5MTJaIiBmaWxsPSIjRkY1MDBBIi8+Cjwvc3ZnPgo=
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
