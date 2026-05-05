(function ($, window, document) {
    $(function () {
        const galleryElements = document.querySelectorAll(".g-block-mediagallery");
        galleryElements.forEach(galleryElement => {
            const galleryData = galleryElement.querySelector('.g-media-gallery-data');

            if (galleryData.dataset.style == "Masonry") {
                calculateMasonry(galleryData);
            }
            else if (galleryData.dataset.style == "Gallery") {
                calculateGallery(galleryData);
            }
            else if (galleryData.dataset.style == "Slider") {
                calculateSlider(galleryData);
            }
            else {
                // Grid / Justify
                // Set data aos offset - trigger all elements at once > initial offset - element.offsetTop
                const elements = galleryElement.querySelectorAll('.g-gallery-file-container');
                elements.forEach(element => {
                    const aosOffsetInitial = element.dataset.aosOffset;
                    element.dataset.aosOffset = aosOffsetInitial - element.offsetTop;
                });
                AOS.refresh();
            }
        });
    });

    const calculateMasonry = function (galleryData) {
        const masonryGallery = galleryData.querySelector('.g-gallery-masonry');
        const masonryStyle = window.getComputedStyle(masonryGallery);
        let colWidth = 0;

        let border = parseInt(galleryData.dataset.border, 10);
        if (!border) border = 0;

        let padding = parseInt(galleryData.dataset.padding, 10);
        if (!padding) padding = 0;

        let gridGap = parseInt(galleryData.dataset.gap, 10);
        if (!gridGap) gridGap = 0;

        // Get all masonry cells with initial height
        const cellElements = masonryGallery.getElementsByClassName('g-gallery-file-container');
        const cells = Array.prototype.map.call(cellElements, function (cellElement) {
            const file = cellElement.querySelector('.g-gallery-file');
            return {
                'element': cellElement,
                'outerHeight': file.offsetWidth * parseFloat(file.dataset.ratio),
                'outerWidth': file.offsetWidth
            };
        });

        // Encapsulate masonry element with all its cells
        const rootElement = {
            'element': masonryGallery,
            'colCount': 0,
            'cells': cells
        };

        // Recalc masonry column count, column width and cell heights
        const resizeMasonry = function () {
            let newColCount = parseInt(masonryStyle.getPropertyValue('--g-gallery-col-count'), 10);
            if (newColCount > cellElements.length) {
                if (cellElements.length == 0) return;
                newColCount = cellElements.length
            }

            const newColWidth = Math.floor((rootElement.element.offsetWidth / newColCount) - (gridGap - gridGap / newColCount));
            if (newColWidth == colWidth) return;

            // Column width changed > resize masonry
            colWidth = newColWidth;
            rootElement.colCount = newColCount;
            const columns = Array.from(new Array(rootElement.colCount)).map(column => {
                return {
                    'cells': new Array(),
                    'outerHeight': 0
                };
            });

            rootElement.cells.forEach(cell => {
                // Get column with lowest current height
                const minOuterHeight = Math.min(...columns.map(column => {
                    return column.outerHeight;
                }));
                const column = columns.find(column => {
                    return column.outerHeight == minOuterHeight;
                });

                // Set cell to new width
                cell.element.style.width = newColWidth + 'px';
                cell.element.dataset.aosOffset = -column.outerHeight;

                // Add cell and new height to column
                const ratio = newColWidth / cell.outerWidth;
                column.outerHeight += (cell.outerHeight * ratio) + gridGap + padding + border;
                column.cells.push(cell);
            });

            const masonryHeight = Math.max(...columns.map(column => {
                return column.outerHeight;
            }));

            // Set cell order and left over column space
            let order = 0;
            columns.forEach(column => {
                column.cells.forEach(cell => {
                    cell.element.style.order = order++;
                    cell.element.style.flexBasis = 0;
                });

                // Set the last cells flex-basis to fill the leftover space at the bottom
                column.cells[column.cells.length - 1].element.style.flexBasis =
                    column.cells[column.cells.length - 1].element.offsetHeight + masonryHeight - column.outerHeight - 1 + 'px';
            });

            // Sets masonry element max height to force rendering of cells in columns
            // Add one pixel more than the tallest column
            rootElement.element.style.maxHeight = masonryHeight + 1 + 'px';
            rootElement.element.style.visibility = "visible";
        }

        // Initial resize function call
        resizeMasonry();
        // Recalc aos since positions and heights have been changed
        AOS.refresh();

        // Throttle resize event listener
        const resizer = _.throttle(resizeMasonry, 100);
        $(window).on('resize', resizer);
    }

    const calculateSlider = function (galleryData) {
        const interval = galleryData.dataset.interval.toLowerCase() == 'false'
            ? false
            : parseInt(galleryData.dataset.interval, 10);

        $('.carousel').carousel({
            interval: interval
        });
        
        const slider = galleryData.querySelector('.g-gallery-slider');
        resizeToAspectRatio(slider, galleryData);
    }

    const calculateGallery = function (galleryData) {
        const gallery = galleryData.querySelector('.g-gallery-gallery');
        $(gallery).smartGallery({
            startIndex: 0,
            zoom: {
                enabled: galleryData.dataset.zoomer.toLowerCase() == 'true',
            },
            box: {
                enabled: true,
                hidePageScrollbars: false
            }
        });

        if (galleryData.dataset.hideNav.toLowerCase() == 'true') {
            const nav = galleryData.querySelector('.gal-nav-cell');
            nav.classList.add("d-none");
        }

        resizeToAspectRatio(gallery, galleryData, gallery.querySelector('.slick-current'));
    }

    const resizeToAspectRatio = function (element, galleryData, sizeEl) {

        if (!sizeEl) sizeEl = element;

        const aspectRatio = galleryData.dataset.aspectRatio;
        resizeAspectRatio(element, aspectRatio, sizeEl);
        const resizer = _.throttle(resizeAspectRatio(element, aspectRatio, sizeEl), 100);
        $(window).on('resize', resizer);
    }

    const resizeAspectRatio = function (element, aspectRatio, sizeEl) {
        let height = sizeEl.offsetWidth;
        switch (aspectRatio) {
            case '1by1':
                break;

            case '2by1':
                height = height / 2;
                break;

            case '4by3':
                height = height / 4 * 3;
                break;

            case '5by4':
                height = height / 5 * 4;
                break;

            case '16by10':
                height = height / 16 * 10;
                break;

            case '21by9':
                height = height / 21 * 9;
                break;

            case '16by9':
            default:
                height = height / 16 * 9;
                break;
        }
        element.style.setProperty('--g-aspect-height', height + "px");
    }

})(jQuery, this, document);