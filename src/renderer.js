//@ts-check
/**
 * @typedef {Object} StylingInfo
 * @property {string} fontColor
 * @property {string} fontSize
 * @property {string} fontFamily
 * @property {string} fontStyle
 * @property {string} fontWeight
 */

/**
 * @typedef {Object} CardDiv
 * @property {HTMLDivElement} textCardDiv
 * @property {HTMLDivElement} content
 * @property {HTMLDivElement} header
 */

/**
 * Render Text Cards
 * @param {Spotfire.DataViewRow[]} rows All the rows from the dataset
 * @param {number} prevIndex Index of the previously rendered text card
 * @param {number} cardsToLoad Number of cards to render at one time
 * @param {boolean} rerender Boolean to check if the text cards needs to be rerendered
 * @param {Spotfire.Size} windowSize WindowSize of the mod in pixels
 * @param {Spotfire.Mod} mod The mod object that will be used to add a tooltip using the "controls"
 * @param {{tooltip: Spotfire.DataViewHierarchy, annotation: Spotfire.DataViewHierarchy  }} hierarchy
 * @returns {{fragment: DocumentFragment, startIndex: number}}
 */
function renderTextCards(rows, prevIndex, cardsToLoad, rerender, windowSize, mod, hierarchy) {
    if (rerender) {
        document.querySelector("#text-card-container").innerHTML = "";
    }
    var fragment = document.createDocumentFragment();

    var whatToLoad = prevIndex + cardsToLoad;
    var startIndex = prevIndex;
    if (rerender) {
        whatToLoad = prevIndex;
        startIndex = 0;
        if (prevIndex == 0) {
            whatToLoad = cardsToLoad;
        }
    }

    // get and group styling attributes
    const styling = mod.getRenderContext().styling;
    // general fonts styling
    const fontStyling = {
        fontSize: styling.general.font.fontSize.toString(),
        fontFamily: styling.general.font.fontFamily,
        fontColor: styling.general.font.color,
        fontStyle: styling.general.font.fontStyle,
        fontWeight: styling.general.font.fontWeight
    };
    // additional styling for scales
    const scalesStyling = {
        lineColor: styling.scales.line.stroke,
        tickMarkColor: styling.scales.tick.stroke
    };

    // customized scrollbar for Text Card and Text Card Container that is adjusting to the theme
    // hex color + "4D" = 30% opacitiy
    // hex color + "BF" = 75% opacity
    var styleElement = document.createElement("style");
    styleElement.appendChild(
        document.createTextNode(
            "::-webkit-scrollbar {width: 8px;} ::-webkit-scrollbar-track {border-radius: 16px; background-color: " +
                scalesStyling.lineColor +
                "4d;} ::-webkit-scrollbar-thumb {border-radius: 16px; background-color: " +
                fontStyling.fontColor +
                "4d;} ::-webkit-scrollbar-thumb:hover {background-color: " +
                fontStyling.fontColor +
                "BF;} ::-webkit-scrollbar-thumb:active {background-color: " +
                fontStyling.fontColor +
                "BF;}"
        )
    );
    document.getElementsByTagName("head")[0].appendChild(styleElement);

    // check if all row are marked
    var allRowsMarked = isAllRowsMarked(rows);

    // create all text cards
    for (let index = startIndex; index < whatToLoad; index++) {
        if (index >= rows.length) {
            break;
        }

        // get value/content for the specifc card
        let textCardContent = rows[index].categorical("Content").formattedValue();

        // textCard not NULL or UNDEFINED
        if (rows[index].categorical("Content").value()[0].key) {
            // create annotation
            var annotation = null;
            if (!hierarchy.annotation.isEmpty) {
                annotation = rows[index].categorical("Annotation").value();
            }

            // get color from api to be used for the side bar of the card
            var color = rows[index].color().hexCode;

            // check if specific row are marked and add boolean for condition is all rows marked
            var markObject = {
                row: rows[index].isMarked(),
                allRows: allRowsMarked
            };

            // create border div
            let borderDiv = document.createElement("div");
            borderDiv.setAttribute("id", "text-card-border");

            // Allow single card to fill full height.
            let paddingHeight = annotation ? 80 : 50;
            let cardMaxHeight = rows.length == 1 ? windowSize.height - paddingHeight : windowSize.height / 2;

            // create the text card
            let divObject = createTextCard(
                textCardContent,
                annotation,
                cardMaxHeight,
                markObject,
                fontStyling,
                scalesStyling.tickMarkColor
            );
            let newDiv = divObject.textCardDiv;
            newDiv.setAttribute("id", "text-card");

            newDiv.style.boxShadow = "0 0 0 1px " + scalesStyling.lineColor;
            newDiv.style.borderLeftColor = color;

            // create on click functionallity, select text and stiling
            newDiv.onmousedown = (event) => {
                if (event.shiftKey) {
                    document.getElementById("text-card-container").style.userSelect = "none";
                }
                var scrolling = true;
                let width = newDiv.getBoundingClientRect().width + 27;
                let height = newDiv.getBoundingClientRect().height;

                // check if card could have scrollbar and check if clicking scrollbar
                if (height < cardMaxHeight || width - event.clientX > 10) {
                    scrolling = false;
                }
                newDiv.onmouseup = function () {
                    if (!scrolling) {
                        /**
                         * Use standard marking operation according to ctrl key state
                         * Mark all rows in sequence as the API will enqueue them all and send as one modify
                         *  @type { Spotfire.MarkingOperation }  */
                        let operation = event.ctrlKey ? "ToggleOrAdd" : "Replace";
                        if (!event.shiftKey) {
                            var selectedText = getSelectedText();
                            if (selectedText === "" && event.button == 0) {
                                rows[index].mark(operation);
                                lastMarkedIndex = index;
                            }
                        } else {
                            if (lastMarkedIndex < index) {
                                for (var i = lastMarkedIndex; i <= index; i++) {
                                    rows[i].mark(operation);
                                }
                            }
                            if (lastMarkedIndex > index) {
                                for (var i = index; i <= lastMarkedIndex; i++) {
                                    rows[i].mark(operation);
                                }
                            }
                        }
                    }
                    document.getElementById("text-card-container").style.userSelect = "auto";
                    event.stopPropagation();
                };
                event.stopPropagation();
            };
            // create mouse over functionallity & Border around card and tooltip
            configureMouseOver(divObject, borderDiv, fontStyling, rows[index], mod, hierarchy);

            borderDiv.appendChild(newDiv);
            fragment.appendChild(borderDiv);
        }
    }
    if (!rerender || prevIndex === 0) {
        prevIndex = prevIndex + cardsToLoad;
    }
    var returnObject = { fragment, startIndex: prevIndex };
    return returnObject;
}
