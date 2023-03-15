// @ts-check
/**
 * Truncates string
 * @param {string} dataValue the actual string
 * @param {number} maxLength max length of string
 */
function truncateString(dataValue, maxLength) {
    // Slice at maxLength minus 3 to really return maxLength characters
    return dataValue.slice(0, maxLength - 3) + "...";
}

/**
 * Configures mouse over
 * @param {CardDiv} divObject
 * @param {HTMLDivElement} borderDiv
 * @param {StylingInfo} fontStyling
 * @param {Spotfire.DataViewRow} row
 * @param {Spotfire.Mod} mod
 * @param {{tooltip: Spotfire.DataViewHierarchy, annotation: Spotfire.DataViewHierarchy  }} hierarchy
 */
function configureMouseOver(divObject, borderDiv, fontStyling, row, mod, hierarchy) {
    // mouse over text card event listener
    divObject.textCardDiv.onmouseenter = (e) => {
        borderDiv.style.boxShadow = "0 0 0 1px " + fontStyling.fontColor;
        createCopyButton(divObject.textCardDiv, fontStyling.fontColor);
    };

    // mouse leave text card event listener
    divObject.textCardDiv.onmouseleave = (e) => {
        borderDiv.style.boxShadow = "";

        var button = document.getElementById("img-button");
        divObject.textCardDiv.removeChild(button);
    };

    // mouse over text card content event listener
    if (!hierarchy.tooltip.isEmpty) {
        divObject.content.onmouseenter = (e) => {
            var tooltipString = createTooltipString(row, hierarchy.tooltip);
            mod.controls.tooltip.show(tooltipString);
        };

        divObject.content.onmouseleave = (e) => {
            mod.controls.tooltip.hide();
        };
    }

    // mouse over for annotation event listener
    if (!hierarchy.annotation.isEmpty) {
        divObject.header.onmouseenter = (e) => {
            var tooltipString = createTooltipString(row, hierarchy.annotation);
            mod.controls.tooltip.show(tooltipString);
        };

        divObject.header.onmouseleave = (e) => {
            mod.controls.tooltip.hide();
        };
    }
}

/**
 * Check if all rows are marked
 * @param {Spotfire.DataViewRow[]} rows
 */
function isAllRowsMarked(rows) {
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].isMarked()) return false;
    }
    return true;
}

/**
 * Sort rows
 * @param {Spotfire.DataViewRow[]} rows
 * @param {string} sortOrder
 * @param {boolean} categoricalSorting
*/
function sortRows(rows, sortOrder, categoricalSorting) {
    let order = sortOrder == "asc" ? 1 : -1;
    rows.sort(function (row1, row2) {
        if (categoricalSorting) {
            // Categorical sorting should respect the sort order defined by Spotfire
            return order * (row1.categorical("Sorting").leafIndex - row2.categorical("Sorting").leafIndex);
        }

        // Handle continuous sorting for all supported data types.s
        let v1 = row1.continuous("Sorting").value();
        let v2 = row2.continuous("Sorting").value();

        if (v1 instanceof Date && v2 instanceof Date) {
            return order * (v1.getTime() - v2.getTime());
        } else if (typeof v1 == "number" && typeof v2 == "number") {
            return order * (v1 - v2);
        } else if (typeof v1 == "string" && typeof v2 == "string") {
            return order * v1.localeCompare(v2);
        }

        return 0;
    });
}

/**
 * Get text from text card to clipboard
 * @param {string} text Text is the value that the user has chosen, either through selection or copy entire text card
 */
function textToClipboard(text) {
    var temporaryCopyElement = document.createElement("textarea");
    document.body.appendChild(temporaryCopyElement);
    temporaryCopyElement.value = text;
    temporaryCopyElement.select();
    document.execCommand("copy");
    document.body.removeChild(temporaryCopyElement);
}

/**
 * Find element in dom
 * @param {string} selector Selector as string to search for in dom
 * @returns {HTMLElement}
 */
function findElem(selector) {
    return document.querySelector(selector);
}

/**
 * Get selected text
 * @returns {string}
 */
function getSelectedText() {
    var selectedText = "";

    // window.getSelection
    if (window.getSelection) {
        selectedText = window.getSelection().toString();
    }
    // document.getSelection
    if (document.getSelection) {
        selectedText = document.getSelection().toString();
    }
    return selectedText;
}
