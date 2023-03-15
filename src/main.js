/**
 * Copyright © 2020. TIBCO Software Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

//@ts-check - Get type warnings from the TypeScript language server. Remove if not wanted.

/**
 * Get access to the Spotfire Mod API by providing a callback to the initialize method.
 * @param {Spotfire.Mod} mod - mod api
 */
var lastMarkedIndex = 0;
Spotfire.initialize(async (mod) => {
    var prevIndex = 0;

    // create the read function
    const reader = mod.createReader(
        mod.visualization.data(),
        mod.windowSize(),
        mod.visualization.axis("Content"),
        mod.visualization.axis("Sorting"),
        mod.property("sortOrder"),
        mod.visualization.axis("Card by"),
        mod.property("useCustomCardBy"),
        mod.visualization.axis("Tooltip"),
        mod.visualization.axis("Annotation")
    );

    const modDiv = findElem("#text-card-container");

    // store the context
    const context = mod.getRenderContext();

    // initiate the read loop
    reader.subscribe(render);

    /**
     * @param {Spotfire.DataView} dataView
     * @param {Spotfire.Size} windowSize
     * @param {Spotfire.Axis} contentAxis
     * @param {Spotfire.Axis} sortAxis
     * @param {Spotfire.ModProperty<string>} sortOrder
     * @param {Spotfire.Axis} cardByAxis
     * @param {Spotfire.ModProperty<string>} sortOrder
     * @param {Spotfire.Axis} tooltipAxis
     * @param {Spotfire.Axis} annotationAxis
     */
    // @ts-ignore
    async function render(dataView, windowSize, contentAxis, sortAxis, sortOrder, cardByAxis, useCustomCardBy, tooltipAxis, annotationAxis) {
        // Check card by axis expression.
        if (cardByAxis.expression !== "<baserowid()>" && !useCustomCardBy.value()) {
            createWarning(modDiv, context.styling.general.font.color, cardByAxis, useCustomCardBy);
            mod.controls.errorOverlay.hide();
            return;
        } else {
            clearWarning(modDiv);
        }

        /**
         * Check data axes
         * - Check if content empty
         * - Check if content is multiple
         */

        if (contentAxis.parts.length == 0) {
            mod.controls.errorOverlay.show("Select the 'Content' of the text cards to get started!");
            return;
        } else if (contentAxis.parts.length > 1) {
            if (contentAxis.parts.length > 1) {
                mod.controls.errorOverlay.show("Selecting multiple columns in 'Content' is not supported.");
            } else {
                mod.controls.errorOverlay.show("Something went wrong. Please reload the mod.");
            }
            return;
        }
        mod.controls.errorOverlay.hide();

        // non-global value
        const cardsToLoad = 100;

        // check dataview for errors
        let errors = await dataView.getErrors();
        if (errors.length > 0) {
            // Showing an error overlay will hide the mod iframe.
            // Clear the mod content here to avoid flickering effect of
            // an old configuration when next valid data view is received.
            mod.controls.errorOverlay.show(errors);
            return;
        }
        mod.controls.errorOverlay.hide();

        // Remove 4px to level out top-padding (Math.max to avoid less than 0)
        modDiv.style.height = Math.max(windowSize.height - 4, 0) + "px";

        // get rows/data from dataview via api
        var rows = await dataView.allRows();
        let ha = await dataView.hierarchy("Annotation");
        let ht = await dataView.hierarchy("Tooltip");
        let hierarchy = {
            annotation: ha,
            tooltip: ht
        };

        if (rows == null) {
            // User interaction caused the data view to expire.
            // Don't clear the mod content here to avoid flickering.
            return;
        }

        // Checks if there is content to display
        let contentToDisplay = false;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].categorical("Content").value()[0].key !== null) {
                contentToDisplay = true;
            }
        }

        // Display error if there is no content to display
        if (!contentToDisplay) {
            mod.controls.errorOverlay.show("No available text cards.");
        }

        // check if sorting is enabled
        let sortingEnabled = sortAxis.expression != "" && sortAxis.expression != "<>";
        if (sortingEnabled) {
            // create sort button only if there is a value selected in sorting axis
            sortRows(rows, sortOrder.value(), sortAxis.isCategorical);
        } 

        var rerender = true;

        var returnedObject = renderTextCards(
            rows,
            prevIndex, // When rerendering we always want to render everything
            cardsToLoad,
            rerender,
            windowSize,
            mod,
            hierarchy
        );
        // @ts-ignore
        modDiv.appendChild(returnedObject.fragment);
        // @ts-ignore
        prevIndex = returnedObject.startIndex;

        // de-mark on click on something that isn't text card *
        var modContainer = document.getElementById("text-card-container");
        modDiv.onmousedown = (e) => {
            let width = modDiv.getBoundingClientRect().width;
            if (!(e.clientX < width && e.clientX > width - 12)) {
                dataView.clearMarking();
            }
        };

        // down-key event listener
        document.onkeydown = (e) => {
            var selectedText = getSelectedText();
            if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedText !== "") {
                textToClipboard(selectedText);
                selectedText = "";
            }
            if (e.key === "ArrowUp") {
                modContainer.scrollBy(0, -100);
            }
            if (e.key === "ArrowDown") {
                modContainer.scrollBy(0, 100);
            } else {
                return;
            }
        };

        // scroll event listener
        // @ts-ignore
        modDiv.addEventListener("scroll", async function (e) {
            if (modDiv.scrollHeight - modDiv.scrollTop <= modDiv.clientHeight + 1) {
                // check if dataview is up to date
                if (await dataView.hasExpired()) {
                    return;
                }
                var rerender = false;

                var returnedObject = renderTextCards(
                    rows,
                    prevIndex,
                    cardsToLoad,
                    rerender,
                    windowSize,
                    mod,
                    hierarchy
                );
                // @ts-ignore
                modDiv.appendChild(returnedObject.fragment);
                // @ts-ignore
                prevIndex = returnedObject.startIndex;
            }
        });

        //Create SortButton
        if (sortingEnabled) createSortButton(modDiv, mod.getRenderContext().styling.general.font.color, sortOrder);

        // signal that the mod is ready for export.
        context.signalRenderComplete();
    }
});
