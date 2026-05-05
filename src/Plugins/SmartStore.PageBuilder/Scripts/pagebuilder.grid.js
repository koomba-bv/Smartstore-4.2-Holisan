"use strict";

(function ($, window, document, undefined) {

    var viewport = ResponsiveBootstrapToolkit;

    function Spacing(t, r, b, l) {
        this.top = toInt(t, null);
        this.right = toInt(r, null);
        this.bottom = toInt(b, null);
        this.left = toInt(l, null);

        this.allEqual = function () {
            return this.left !== null && this.left === this.right && this.right === this.bottom && this.bottom === this.top;
        };

        this.xEquals = function (other) {
            return this.x !== null && this.x === other.x;
        };

        this.yEquals = function (other) {
            return this.y !== null && this.y === other.y;
        };

        this.difference = function (other) {
            var result = new Spacing(this.top, this.right, this.bottom, this.left);

            if (this.left === other.left) result.left = null;
            if (this.right === other.right) result.right = null;
            if (this.top === other.top) result.top = null;
            if (this.bottom === other.bottom) result.bottom = null;

            return result;
        };

        this.equals = function (other) {
            if (typeof other !== typeof this)
                return false;

            return this.left === other.left && this.right === other.right && this.top === other.top && this.bottom === other.bottom;
        };

        this.applyToElement = function (el, prop, infix, prev) {
            var s = this.difference(prev);

            if (s.allEqual()) {
                // All sides equal
                el.classList.add('{0}{1}-{2}'.format(prop, infix, s.left));
                return;
            }

            var xApplied, yApplied;

            if (s.x !== null && !s.xEquals(prev)) {
                // x equal
                el.classList.add('{0}x{1}-{2}'.format(prop, infix, s.left));
                xApplied = true;
            }

            if (s.y !== null && !s.yEquals(prev)) {
                // y equal
                el.classList.add('{0}y{1}-{2}'.format(prop, infix, s.top));
                yApplied = true;
            }

            if (!xApplied) {
                if (s.left !== null && s.left !== prev.left) {
                    el.classList.add('{0}l{1}-{2}'.format(prop, infix, s.left));
                }
                if (s.right !== null && s.right !== prev.right) {
                    el.classList.add('{0}r{1}-{2}'.format(prop, infix, s.right));
                }     
            }

            if (!yApplied) {
                if (s.top !== null && s.top !== prev.top) {
                    el.classList.add('{0}t{1}-{2}'.format(prop, infix, s.top));
                }
                if (s.bottom !== null && s.bottom !== prev.bottom) {
                    el.classList.add('{0}b{1}-{2}'.format(prop, infix, s.bottom));
                }
            }
        };

        Object.defineProperties(this, {
            x: {
                "get": function () {
                    return this.left !== null && this.left === this.right ? this.left : null;
                }
            },
            y: {
                "get": function () {
                    return this.top !== null && this.top === this.bottom ? this.top : null;
                }
            }
        });
    }

    /*
     * { xs: { align: <rg>, valign: <rg>, ... }, sm: { ... }, ... }
    */
    var cssClassRegexes = {};

    function getCssClassRegex(mapping, infix) {
        var mode = infix ? infix.substr(1) : 'xs';
        var regexes = cssClassRegexes[mode];
        if (!regexes)
            regexes = cssClassRegexes[mode] = {};

        var rg = regexes[mapping.name];
        if (!rg) {
            rg = regexes[mapping.name] = new RegExp('^' + mapping.pattern.format(infix, mapping.suffix) + '$');
        }

        return rg;
    }

    var cssHandlers = {
        "default": {
            compute: function (value) {
                return value;
            },
            reset: function (el, mapping, infix) {
                var classRegex = getCssClassRegex(mapping, infix);
                var matches = [];
                _.each(el.classList, function (cls) {
                    if (classRegex.test(cls)) {
                        matches.push(cls);
                    }
                });

                matches.forEach(function (cls) {
                    el.classList.remove(cls);
                });
            },
            apply: function (el, mapping, infix, value, baseState) {
                el.classList.add(mapping.pattern.format(infix, value));
            }
        },
        "style": {
            reset: function (el, mapping, infix) {
                el.style.removeProperty(mapping.pattern.format(infix, ''));
            },
            apply: function (el, mapping, infix, value, baseState) {
                el.style.setProperty(mapping.pattern.format(infix, ''), value); 
            }
        },
        "rowcol": {
            compute: function (value, styleName, computedState) {
                // Fix attemptedValue if col or row
                if (styleName === 'column') {
                    return computedState.column;
                }
                else if (styleName === 'row') {
                    return computedState.row;
                }
                if (styleName === 'colstart') {
                    return (value || computedState.colstart) + '/' + computedState.colend;
                }
                if (styleName === 'colend') {
                    return computedState.colstart + '/' + (value || computedState.colend);
                }
                if (styleName === 'rowstart') {
                    return (value || computedState.rowstart) + '/' + computedState.rowend;
                }
                if (styleName === 'rowend') {
                    return computedState.rowstart + '/' + (value || computedState.rowend);
                }

                return value;
            },
            reset: function (el, mapping, infix) {
                cssHandlers['style'].reset(el, mapping, infix);
            },
            apply: function (el, mapping, infix, value, baseState) {
                cssHandlers['style'].apply(el, mapping, infix, value, baseState);
            }
        },
        "spacing": {
            compute: function (value, styleName, computedState) {
                value = toInt(value, null);

                // Set origin value (mt, pl, mb etc.)
                var side = styleName[1];
                computedState[styleName] = value;

                if (side === 'l') side = 'left';
                else if (side === 'r') side = 'right';
                else if (side === 't') side = 'top';
                else if (side === 'b') side = 'bottom';

                // Return the composite 'Spacing' type
                var prop = styleName[0] === 'm' ? 'margin' : 'padding';
                return computedState[prop];
            },
            apply: function (el, mapping, infix, value, baseState) {
                var prop = mapping.name === 'margin' ? 'm' : 'p';
                var prev = baseState[mapping.name] || new Spacing();

                // value is of type 'Spacing'
                value.applyToElement(el, prop, infix, prev);
            }
        }
    };

    var styleMappings = {
        'boxAlign': { pattern: 'align-items{0}-{1}', suffix: '(start|center|end|stretch)' },
        'boxValign': { pattern: 'justify-content{0}-{1}', suffix: '(start|center|end|stretch)' },
        'align': { pattern: 'justify-content{0}-{1}', suffix: '(start|center|end|stretch)', el: '.g-padbox' },
        'valign': { pattern: 'align-items{0}-{1}', suffix: '(start|center|end|stretch)', el: '.g-padbox' },
        'textAlign': { pattern: 'text{0}-{1}', suffix: '(left|center|right)', el: '.g-padbox' },
        'display': { pattern: 'd{0}-{1}', suffix: '(flex|none)' },
        'mt': { ref: 'margin' },
        'mr': { ref: 'margin' },
        'mb': { ref: 'margin' },
        'ml': { ref: 'margin' },
        'margin': { pattern: 'm(x|y|l|r|t|b)?{0}-{1}', suffix: '([0-6])', handler: cssHandlers.spacing, el: '.g-block-inner' },
        'pt': { ref: 'padding' },
        'pr': { ref: 'padding' },
        'pb': { ref: 'padding' },
        'pl': { ref: 'padding' },
        'padding': { pattern: 'p(x|y|l|r|t|b)?{0}-{1}', suffix: '([0-6])', handler: cssHandlers.spacing, el: '.g-padbox' },
        'colstart': { ref: 'column' },
        'colend': { ref: 'column' },
        'rowstart': { ref: 'row' },
        'rowend': { ref: 'row' },
        'column': { pattern: '--col{0}', handler: cssHandlers.rowcol },
        'row': { pattern: '--row{0}', handler: cssHandlers.rowcol },
        'zindex': { pattern: '--zix{0}', handler: cssHandlers.style }
    };

    // Add mapping key as 'name' property to assigned mapping object
    for (var name in styleMappings) {
        if (styleMappings.hasOwnProperty(name)) {
            styleMappings[name]['name'] = name;
        }
    }

    var StoryGrid = window.StoryGrid = (function () {
        function StoryGrid(deviceStates, organizeBlocks) {
            this.body = $('body');
            this.stage = $('.g-stage-root');
            this.story = $('.g-story-root');
            this.trackPopup = $('.g-track-popup');
            this.rtl = $('html').attr('dir') === 'rtl';
            this.organizeBlocks = organizeBlocks;
            this._initialized = false;
            this._drag = null;

            this._refreshProps();
            this.setMinSizes();
            this._initialize(deviceStates);
        }

        StoryGrid.prototype._splitGridTemplate = function (template) {
            return template.trim().split(/ (?![^(]*\))/).filter(Boolean);
        };

        StoryGrid.prototype._refreshProps = function () {
            this.cols = this._splitGridTemplate(this.stage.data('grid-cols'));
            this.rows = this._splitGridTemplate(this.stage.data('grid-rows'));
            this.gap = { width: this.getGapSize(true), height: this.getGapSize(false) };
        };

        StoryGrid.prototype.destroy = function () {
            this.sendMessageSync("unloading");
            this.body = null;
            this.stage = null;
            this.story = null;
            this.trackPopup = null;
        };

        StoryGrid.prototype._initialize = function (deviceStates) {
            var self = this;
            var html = $('html');

            // Global events
            // ------------------------------------
            if (deviceStates) {
                this.sendMessage("devicestates", JSON.parse(deviceStates));
            }

            // Last rendered blocks first.
            this.sendMessage("blocks", self.story.find('.g-block-editmode').map(function () {
                var el = $(this);
                return {
                    id: el.data('id'),
                    zIndex: 0,
                    isHidden: false,
                    type: el.data('type'),
                    name: el.data('type-name'),
                    icon: el.data('type-icon'),
                    title: el.data('title'),
                    childStoryId: el.data('child-story-id')
                };
            }).get().reverse());

            // Device stuff
            // ------------------------------------

            this.sendMessage("breakpoints", {
                xs: html.css('--breakpoint-xs'),
                sm: html.css('--breakpoint-sm'),
                md: html.css('--breakpoint-md'),
                lg: html.css('--breakpoint-lg'),
                xl: html.css('--breakpoint-xl')
            });


            EventBroker.subscribe("page.gridtierchanged", function (msg, tier) {
                self.sendMessage("devicechanged", tier);
            });

            EventBroker.subscribe("story.devicesetting.updated", function (msg, data) {
                self.setBlockStyle(data);
            });

            EventBroker.subscribe('story.command.undoRedo', function (msg, data) {
                self.undoRedo(data);
            });

            EventBroker.subscribe('story.drag.start', function (msg, data) {
                self.prepareDragging(data);
            });

            EventBroker.subscribe('story.drag.end', function (msg) {
                self.prepareDragging(null);
            });

            // Events
            // ------------------------------------

            $(window).one('load', function () {
                self.sendMessage("devicechanged", viewport.current());
            });

            $(window).on('keydown', function (e) {
                // Don't call sendMessage here: we need the return value because event.preventDefault()
                // has no effect when called from another frame/window.
                if (window.parent.SmartStore.StoryEditor._handleKeyboardShortcut(e)) {
                    e.preventDefault();
                }
            });

            // Fix cutting of edit buttons.
            this.stage.on('mouseenter', '.g-block-editmode', function () {
                self.alignBlockButtons($(this));
            });

            // Deactivate links in block contents.
            this.stage.on('click', '.g-block-content a', function (e) {
                e.preventDefault();
                return false;
            });

            // Handle block action buttons (left blue panel).
            this.stage.on('mousedown', '.g-block-edit .btn-action', function (e) {
                e.stopPropagation();
            });
            this.stage.on('click', '.g-block-edit .btn-action', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var action = $(this).data('action');
                if (action) {
                    self.sendMessage('block.command', {
                        op: action,
                        block: $(this).closest('.g-block'),
                        url: $(this).attr('href')
                    });
                }
                return false;
            });
            
            this.storeThemeVars();
            this._initializeBlocks();
            this._initializeTrackTools();
            this._initialized = true;
        };

        StoryGrid.prototype._initializeTrackTools = function () {
            if (!this.organizeBlocks) return;
            var self = this;

            this.body.on('mouseup', '.g-track-popup-backdrop', function (e) {
                // Otherwise document.mouseup catches this one and deactivates any active block
                e.stopPropagation();
            });

            this.body.on('mouseenter', '.g-track-header', function (e) {
                var header = $(this);
                if (!self._drag && !header.hasClass('active')) {
                    header.addClass('hover');

                    var isRow = header.hasClass('g-row-header');
                    var tools = $(isRow ? '.g-row-tools' : '.g-column-tools');

                    if (isRow) {
                        var row = parseInt(header.closest('.g-block').data('row')) || 0;
                        var th = row === 1 ? 1 : self.gap.height;
                        var bh = row === self.rows.length ? 1 : self.gap.height;
                        tools.find('.g-add-row-above').css({ height: th + 'px' });
                        tools.find('.g-add-row-below').css({ height: bh + 'px' });
                        tools.find('.g-delete-row').toggle(self.rows.length > 1);
                    }
                    else {
                        // Is column track
                        var col = parseInt(header.closest('.g-block').data('col')) || 0;
                        var lw = col === 1 ? 1 : self.gap.width;
                        var rw = col === self.cols.length ? 1 : self.gap.width;
                        tools.find('.g-add-column-left').css({ width: lw + 'px' });
                        tools.find('.g-add-column-right').css({ width: rw + 'px' });
                        tools.find('.g-delete-column').toggle(self.cols.length > 1);
                    }

                    tools.appendTo(header).show();
                }
            });

            this.body.on('mouseleave', '.g-track-header', function (e) {
                $(this).removeClass('hover');
            });

            // Hide row/column tools.
            this.body.on('mouseleave', '.g-track-header, .g-track-tools', function (e) {
                if ($(this).is('.active') || $(this).closest('.g-track-header').is('.active')) {
                    // INFO: backdrop insertion leads to mouseleave event, but we want
                    // the axis/track tools to keep visible if popover was shown.
                    return;
                }

                $('.g-track-tools').each(function (i, el) {
                    var tools = $(el);
                    if (tools.is(':visible') && !$(e.currentTarget).closest('.g-track-tools').length) {
                        tools.hide().appendTo(this.body);
                    }
                });
            });

            // Execute row/column tool.
            this.stage.on('mousedown', '.g-track-tool', function (e) {
                // Without this event a click on a grid tool shows the edit popover
                e.stopPropagation();
            });
            this.body.on('click', '.g-track-tool', function (e) {
                e.stopPropagation();
                if (e.isDefaultPrevented())
                    return;

                var tool = $(this);
                var data = { op: tool.data('op'), row: 0, col: 0 };

                data.blocks = self.story.find('.g-block-editmode').map(function () {
                    return self.getBlockData($(this));
                }).get();

                switch (data.op) {
                    case 'add-row-above':
                    case 'add-row-below':
                    case 'delete-row':
                        data.row = parseInt(tool.closest('.g-block').attr('data-row'));
                        self.addOrDeleteRow(data);
                        break;
                    case 'add-column-left':
                    case 'add-column-right':
                    case 'delete-column':
                        data.col = parseInt(tool.closest('.g-block').attr('data-col'));
                        self.addOrDeleteColumn(data);
                        break;
                }
            });

            // Show row/column size form.
            this.body.on('mousedown', '.g-track-header', function (e) {
                if (!$(e.target).hasClass('g-track-tool') && e.which === 1) {
                    e.stopPropagation();
                    self.showTrackPopup(this);
                }
            });

            self.trackPopup.on('click', '.btn-update-track', function () {
                self.updateSize();
                self.hideTools();
            });
            
            self.trackPopup.on('change', '#size-unit', function () {
                var $elUnit = $(this);
                var $elSize = self.trackPopup.find('#size-value');

                var unit = $elUnit.val();
                var originalUnit = self.trackPopup.data("original-unit");
                var disableSize = unit === 'auto' || unit === 'min-content' || unit === 'max-content';
                var lenghts = ['fr', 'px', '%', 'vh', 'vw', 'rem', 'em'];

                $elSize
                    .prop('disabled', disableSize)
                    .prop('type', unit === 'minmax' || unit === 'fit-content' ? 'text' : 'number');

                if (unit === 'minmax' || unit === 'fit-content') {
                    var numVal = parseFloat($elSize.val()) || 1;
                    if (originalUnit != "minmax" && originalUnit != "fit-content") {
                        // Only set default value if original unit wasn't minmax or fit-content
                        $elSize.val(numVal + originalUnit);
                    }
                    else {
                        $elSize.val(numVal + "fr");
                    }
                }

                if (unit === 'minmax') {
                    // show max value input
                    var maxValueCtrl = self.trackPopup.find("#max-value").removeClass("hide");
                    if (originalUnit != "minmax") {
                        maxValueCtrl.val("300px");
                    }
                }
                else {
                    self.trackPopup.find("#max-value").addClass("hide");

                    // if $elSize is empty the previously selected unit was minmax or fit-content => so restore original size value
                    if ($elSize.val() == "") {
                        $elSize.val(originalUnit == "minmax" || originalUnit == "fit-content" ? 1 : self.trackPopup.data("original-size") || 1);
                    }
                }

                _.delay(function () { $elSize.focus(); }, 10);
            });        
        };

        StoryGrid.prototype._initializeBlocks = function () {
            var self = this;

            if (!this.organizeBlocks) {
                var editButtons = this.story.find('.g-block-edit-buttons');
                editButtons.find('[data-action="levelup"], [data-action="leveldown"]').addClass('disabled');

                this.story.find('.g-block-editmode').css('cursor', 'auto');
            }

            // Drag & drop (add block).
            this.stage.on('dragstart', '.g-block', function () {
                return false;
            }).on('dragover', '.g-block-empty', function (e) {
                if (self._drag && self._drag.op === 'addBlock') {
                    e.preventDefault(); // Allow dropping.
                }
            }).on('dragenter', '.g-block-empty', function () {
                if (self._drag) {
                    $(this).addClass('highlight');
                }
            }).on('dragleave', '.g-block-empty', function () {
                if (self._drag) {
                    $(this).removeClass('highlight');
                }
            }).on('drop', '.g-block-empty', function () {
                if (self._drag) {
                    var target = $(this);
                    self.sendMessage('drag.drop', $.extend({ target: { col: target.data('col'), row: target.data('row') } }, self._drag));
                }
            });

            // Activate block and init block moving\sizing.
            this.body.on('mousedown', '.g-block-editmode', function (e) {
                $(this).addClass('draggable');
                self._drag = { el: this, op: 'initBlockMoving', x: e.pageX, y: e.pageY };
            }).on('mousedown', '.g-sizer', function (e) {
                e.stopPropagation();
                self.resizeBlock(e, this);
            });

            $(document).on('mousemove', function (e) {
                if (self._drag && self.organizeBlocks) {
                    if (self._drag.op === 'resizeBlock') {
                        self.resizeBlock(e);
                    }
                    else {
                        self.moveBlock(e);
                    }
                }
            }).on('mouseup', function (e, ctx) {
                if (self._drag) {
                    var block = $(self._drag.el);

                    if (self._drag.op === 'initBlockMoving') {
                        // Set block to active.
                        if (!block.is('.active')) {
                            self.toggleActiveState(block);
                        }
                    }
                    else {
                        // Reset the originally active block to active again.
                        var originalBlock = self.stage.find('.g-block-editmode.active');
                        if (originalBlock.length) {
                            self.toggleActiveState(originalBlock);
                        }
                    }

                    self.stopDragging(ctx);
                }
                else if (!$(e.target).closest('.g-block-editmode').length) {
                    // Deactivate any active blocks.
                    self.toggleActiveState(null);
                }
            }).on('keydown', function (e) {
                if (27 === (e.which || e.keyCode)) {
                    $('.g-stage').trigger('mouseup', 'ESC');
                }
            });
        };

        StoryGrid.prototype.storeThemeVars = function () {
            var frameRoot = $(window.document.documentElement);
            var styles = getComputedStyle(frameRoot.get(0));
            var colors = styles.getPropertyValue("--varnames");
            
            var arr = colors
                .replace(/ /g, '')      // remove white-space
                .slice(1, -1)           // remove enclosing quotes
                .split(",");            // make array

            $.each(arr, function (i, val) {
                localStorage.setItem(val, styles.getPropertyValue(val));
            });
        };
        
        StoryGrid.prototype.sendMessage = function (msg, data) {
            window.parent.EventBroker.publish("storygrid." + msg, data);
        };

        StoryGrid.prototype.sendMessageSync = function (msg, data) {
            window.parent.EventBroker.publishSync("storygrid." + msg, data);
        };

        StoryGrid.prototype.setBlockStyle = function (options) {
            var self = this,
                setMinSizes = false,
                infixes = ["", "-sm", "-md", "-lg", "-xl"],
                modes = ["xs", "sm", "md", "lg", "xl"];

            function setStyleCore(o) {
                // o: { states, blockId, deviceMode, name, value }
                var block = self.story.children('.g-block[data-id=' + o.blockId + ']').first();
                if (block.length === 0)
                    return;

                var isRef = false;
                var mapping = styleMappings[o.name];
                if (mapping && mapping.ref) {
                    isRef = o.name !== mapping.ref;
                    mapping = styleMappings[mapping.ref];
                }

                if (!mapping)
                    return;

                var styleName = mapping.name;
                if (styleName === 'display' && o.value === 'none') {
                    setMinSizes = true;
                }

                var computedValue = null,
                    breakpointHit = false,
                    computedState = {},
                    baseState = {};

                var el = mapping.el
                    ? block.find(mapping.el).get(0)
                    : block.get(0);

                var defaultHandler = cssHandlers['default'],
                    handler = mapping.handler || defaultHandler,
                    computeFn = handler.compute || defaultHandler.compute,
                    resetFn = handler.reset || defaultHandler.reset,
                    applyFn = handler.apply || defaultHandler.apply;

                for (var i = 0; i < modes.length; i++) {
                    var mode = modes[i];
                    var infix = infixes[i];
                    var modeState = o.states[mode] || {};
                    var modeValue = modeState[o.name];

                    computedState = self.mergeDeviceStates(modeState, baseState);

                    if (!breakpointHit && mode === o.mode) {
                        breakpointHit = true;
                        modeValue = o.value; // the attempted value
                    }

                    if (!_.isEmpty(modeValue)) {
                        computedValue = modeValue;
                    }

                    if (breakpointHit) {
                        var baseValue = baseState[styleName];

                        // Resets the attempted style for the current breakpoint.
                        resetFn(el, mapping, infix);

                        // compute/fix attempted value if necessary
                        computedValue = computeFn(
                            isRef ? modeValue : computedValue,
                            isRef ? o.name : styleName,
                            computedState);

                        var equals = computedValue && _.isFunction(computedValue.equals)
                            ? computedValue.equals(baseValue)
                            : computedValue === baseValue;

                        if (!equals && !_.isEmpty(computedValue)) {
                            // Set updated/merged style or class value (only if not undefined and not equal to base value).
                            applyFn(el, mapping, infix, computedValue, baseState);
                        }
                    }

                    baseState = computedState; 
                }
            } // setStyleCore

            var opts = Array.isArray(options) ? options : [options];
            for (var i = 0; i < opts.length; ++i) {
                setStyleCore(opts[i]);
            }

            // Do what is necessary for a clean stage.
            if (setMinSizes) {
                this.setMinSizes();
            }
            else {
                this.alignBlockButtons(this.stage.find('.g-block-editmode.active'));
            }
        };

        StoryGrid.prototype.mergeDeviceStates = function (currentState, baseState) {
            var isClone = currentState.hasOwnProperty('_clone');
            var mergedState = isClone ? currentState : _.extend({ _clone: true }, currentState);
            if (!isClone) {
                Object.defineProperties(mergedState, {
                    column: {
                        "get": function () {
                            return (this.colstart || 'auto') + '/' + (this.colend || 'auto');
                        }
                    },
                    row: {
                        "get": function () {
                            return (this.rowstart || 'auto') + '/' + (this.rowend || 'auto');
                        }
                    },
                    margin: {
                        "get": function () {
                            return new Spacing(this.mt, this.mr, this.mb, this.ml);
                        }
                    },
                    padding: {
                        "get": function () {
                            return new Spacing(this.pt, this.pr, this.pb, this.pl);
                        }
                    }
                });
            }

            for (var prop in baseState) {
                if (baseState.hasOwnProperty(prop)) {
                    var baseVal = baseState[prop];
                    var currentVal = mergedState[prop];
                    if ((currentVal === undefined || _.isEmpty(currentVal)) && baseVal !== undefined && !_.isEmpty(baseVal)) {
                        mergedState[prop] = baseVal;
                    }
                }
            }

            return mergedState;
        };

        StoryGrid.prototype.getBlockStyleName = function (name) {
            var mode = '-' + viewport.current();
            return '--{0}{1}'.format(name, mode === '-xs' ? '' : mode);
        };

        StoryGrid.prototype.toggleActiveState = function (block, scrollTo) {
            var el;

            if (!block) {
                // Nothing.
            }
            else if (block.jquery) {
                el = block;
            }
            else if (block.className) {
                el = $(block);
            }
            else if (_.isNumber(block)) {
                el = this.stage.find('.g-block-editmode[data-id=' + block + ']');
            }
            
            // Deactivate current active block in any case.
            this.stage.find('.g-block-editmode.active').removeClass('active');

            if (!el) {
                // Either null or something invalid: deactivate everything.
                this.sendMessageSync("block.deactivated");
            }
            else {
                el.addClass('active');
                this.alignBlockButtons(el);
                if (scrollTo) {
                    $('body, html').animate({ scrollTop: el.offset().top - 10 }, 'slow');
                }
                this.sendMessageSync("block.activated", { id: parseInt(el.data('id')) });
            }
        };

        StoryGrid.prototype.getCellSize = function (colIndex, rowIndex) {
            return { width: this.cols[colIndex], height: this.rows[rowIndex] };
        };

        StoryGrid.prototype.getGapSize = function (width) {
            var block1 = this.stage.find('.g-block-empty[data-col=1][data-row=1]');
            if (width && this.cols.length > 1) {
                var right1 = block1.offset().left + block1.outerWidth();
                var left2 = this.stage.find('.g-block-empty[data-col=2][data-row=1]').offset().left;
                return Math.max(Math.round(left2 - right1), 0);
            }
            else if (this.rows.length > 1) {
                var bottom1 = block1.offset().top + block1.outerHeight();
                var top2 = this.stage.find('.g-block-empty[data-col=1][data-row=2]').offset().top;
                return Math.max(Math.round(top2 - bottom1), 0);
            }

            return 0;
        };

        StoryGrid.prototype.setMinSizes = function () {
            var cols = this.cols;
            // We really need to check every single cell.
            this.stage.find('.g-block-empty').removeClass('min-height min-width').each(function (i, el) {
                var $block = $(el);
                if ($block.outerHeight() < 50) {
                    $block.addClass('min-height');
                }
                if ($block.outerWidth() < 50) {
                    var col = cols[i];
                    if (col !== 'auto' && col !== 'min-content' && col !== 'max-content') {
                        $block.addClass('min-width');
                    }
                }
            });
        };

        StoryGrid.prototype.alignBlockButtons = function (block) {
            // Fixes the cutting of edit buttons.
            if (!block || block.length === 0)
                return;

            var panel = block.find('.g-block-edit-buttons');
            var offset = panel.offset();
            if (offset && offset.top < 0) {
                var margin = Math.abs(Math.ceil(offset.top));
                if (margin > 0) {
                    panel.css('margin-top', margin);
                }
            }
            else {
                panel.css('margin-top', '');
            }
        };

        StoryGrid.prototype.prepareDragging = function (data) {
            var $blocks = this.stage.find('.g-block-editmode');

            if (!data) {
                $blocks.removeClass('dragging draggable moving resizing');
                this.body.css('cursor', '');
            }

            this._drag = data;

            this.stage.find('.g-block-empty')
                .css('z-index', data ? ($.topZIndex(this.story) + 1) : '')
                .removeClass('highlight')
                .toggleClass('droppable', data && data.op !== 'addBlock');

            // zIndex must be set to 0, otherwise a block cannot be moved to a cell it already covers.
            $blocks
                .css('z-index', data ? '0' : '')
                .toggleClass('dim');

            // Without hiding headers HTML5 dragging will be damaged.
            this.stage.find('.g-track-header').css('visibility', data && data.op === 'addBlock' ? 'hidden' : '');
            this.stage.css('user-select', data ? 'none' : '');
        };

        StoryGrid.prototype.stopDragging = function (ctx) {
            if (this._drag.op === 'initBlockMoving') {
                $(this._drag.el).removeClass('dragging draggable moving resizing');
                this.body.css('cursor', '');
                this._drag = null;
            }
            else {
                clearTimeout(this._drag.scrollTimer);

                if (ctx === 'ESC') {
                    if (this._drag.op === 'moveBlock' || this._drag.op === 'resizeBlock') {
                        // Reset position or size.
                        var src = this._drag.source;
                        $(this._drag.el).css({
                            [this.getBlockStyleName('col')]: '{0}/{1}'.format(src.col, src.colEnd),
                            [this.getBlockStyleName('row')]: '{0}/{1}'.format(src.row, src.rowEnd)
                        });
                    }
                }
                else {
                    this.sendMessage('drag.drop', this._drag);
                }

                this.prepareDragging(null);
            }
        };

        StoryGrid.prototype.refreshMoveThreshold = function (e) {
            var self = this;
            var col = this._drag.target.col;
            var row = this._drag.target.row;
            var lastCol = this.cols.length - (this._drag.source.colEnd - this._drag.source.col);
            var lastRow = this.rows.length - (this._drag.source.rowEnd - this._drag.source.row);

            // Returns the coordinate of the nearest border next to snapped block.
            function getNearestBorder(x, y, c, r) {
                var result = -1;
                var block = self.stage.find('.g-block-empty[data-col={0}][data-row={1}]'.format(c, r));
                if (!block.length) return result;

                var offs = block.offset();
                if (!offs) return result;

                if (x === -1) {
                    if (self.rtl) {
                        result = offs.left;
                        // Go on with next column when it collapses due to dragging.
                        if (e.pageX > result) return getNearestBorder(x, y, c - 1, r);
                    }
                    else {
                        result = offs.left + block.outerWidth();
                        if (e.pageX < result) return getNearestBorder(x, y, c - 1, r);
                    }
                }
                else if (x === 1) {
                    if (self.rtl) {
                        result = offs.left + block.outerWidth();
                        if (e.pageX < result) return getNearestBorder(x, y, c + 1, r);
                    }
                    else {
                        result = offs.left;
                        if (e.pageX > result) return getNearestBorder(x, y, c + 1, r);
                    }
                }
                else if (y === -1) {
                    result = offs.top + block.outerHeight();
                    if (e.pageY < result) return getNearestBorder(x, y, c, r - 1);
                }
                else if (y === 1) {
                    result = offs.top;
                    if (e.pageY > result) return getNearestBorder(x, y, c, r + 1);
                }

                return Math.round(result);
            }
            
            if (this.rtl) {
                this._drag.left = col <= lastCol ? getNearestBorder(1, 0, col + 1, row) : -1;
                this._drag.right = col > 1 ? getNearestBorder(-1, 0, col - 1, row) : -1;
            }
            else {
                this._drag.left = col > 1 ? getNearestBorder(-1, 0, col - 1, row) : -1;
                this._drag.right = col <= lastCol ? getNearestBorder(1, 0, col + 1, row) : -1;
            }

            this._drag.top = row > 1 ? getNearestBorder(0, -1, col, row - 1) : -1;
            this._drag.bottom = row <= lastRow ? getNearestBorder(0, 1, col, row + 1) : -1;
        };

        StoryGrid.prototype.moveBlock = function (e) {
            var d = this._drag;

            if (d.op === 'initBlockMoving') {
                if (e.pageX < (d.x - 15) || e.pageX > (d.x + 15) || e.pageY < (d.y - 15) || e.pageY > (d.y + 15)) {
                    var block = $(d.el);
                    var blockData = this.getBlockData(block);
                    block.addClass('dragging moving');
                    this.body.css('cursor', 'move');

                    this.prepareDragging({
                        op: 'moveBlock',
                        el: d.el,
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        oldX: 0,
                        oldY: 0,
                        scrollTimer: null,
                        scrollEdgeSize: 50, // How close to the edge the scrolling should start.
                        scrollMaxStep: 20,  // Make the icremental scroll changes more "intense" the closer that the user gets the viewport edge.
                        source: blockData,
                        target: jQuery.extend({}, blockData)
                    });
                    this.refreshMoveThreshold(e);
                }
                return;
            }

            try {
                this.smoothEdgeScrolling(e, d);
            }
            finally {
                // noop
            }

            try {
                var x = 0;
                var y = 0;

                // Move block if a threshold has been reached.
                if (d.left !== -1 && e.pageX < d.left && e.pageX < d.oldX) {
                    x = this.rtl ? 1 : -1;
                }
                else if (d.right !== -1 && e.pageX > d.right && e.pageX > d.oldX) {
                    x = this.rtl ? -1 : 1;
                }
                else if (d.top !== -1 && e.pageY < d.top && e.pageY < d.oldY) {
                    y = -1;
                }
                else if (d.bottom !== -1 && e.pageY > d.bottom && e.pageY > d.oldY) {
                    y = 1;
                }

                d.oldX = e.pageX;
                d.oldY = e.pageY;

                if (x !== 0 || y !== 0) {
                    // Standard case: change to neighboring cell.
                    var col = d.target.col + x;
                    var row = d.target.row + y;

                    // But if the cursor is moved very fast, try to get col\row from where the cursor is.
                    var ctxBlock = this.getBlockAt('.g-block-empty', e.pageX, e.pageY);
                    if (ctxBlock) {
                        var colCtx = parseInt(ctxBlock.data('col'));
                        var rowCtx = parseInt(ctxBlock.data('row'));
                        var lastCol = this.cols.length - (d.source.colEnd - d.source.col);
                        var lastRow = this.rows.length - (d.source.rowEnd - d.source.row);
                        if (colCtx > 0 && colCtx <= lastCol) col = colCtx;
                        if (rowCtx > 0 && rowCtx <= lastRow) row = rowCtx;
                        if (col === d.target.col && row === d.target.row) return;
                    }

                    // Calculate new colEnd and rowEnd.
                    var colEnd = d.source.colEnd + (col - d.source.col);
                    var rowEnd = d.source.rowEnd + (row - d.source.row);
                    if (colEnd === 0) colEnd = col + 1;
                    if (rowEnd === 0) rowEnd = row + 1;

                    d.target.col = col;
                    d.target.row = row;
                    d.target.colEnd = colEnd;
                    d.target.rowEnd = rowEnd;

                    // Snap.
                    $(d.el).css({
                        [this.getBlockStyleName('col')]: '{0}/{1}'.format(col, colEnd),
                        [this.getBlockStyleName('row')]: '{0}/{1}'.format(row, rowEnd)
                    });
                    this.setMinSizes();
                    this.refreshMoveThreshold(e);
                }
            }
            finally {
                // noop
            }
        };

        StoryGrid.prototype.refreshResizeThreshold = function (e) {
            var self = this;
            var d = this._drag;
            var col = d.target.col;
            var row = d.target.row;
            var colEnd = d.target.colEnd - 1;
            var rowEnd = d.target.rowEnd - 1;

            function getThreshold(x, y, c, r) {
                var result = -1;
                var block = self.stage.find('.g-block-empty[data-col={0}][data-row={1}]'.format(c, r));
                if (!block.length) return result;

                var offs = block.offset();
                if (!offs) return result;

                if (x !== 0) {
                    var width = block.outerWidth();
                    result = offs.left + (width / 2);

                    // By changing the cell size, the cursor can jump over the next threshold and skip a cell.
                    // Instead of half the height\width, we take the next cell edge to reduce this risk.
                    if (self.rtl) {
                        if (x === -1 && e.pageX >= result) {
                            result = offs.left + width;
                        }
                        else if (x === 1 && e.pageX <= result) {
                            result = offs.left;
                        }
                    }
                    else {
                        if (x === -1 && e.pageX <= result) {
                            result = offs.left;
                        }
                        else if (x === 1 && e.pageX >= result) {
                            result = offs.left + width;
                        }
                    }
                }
                else if (y !== 0) {
                    var height = block.outerHeight();
                    result = offs.top + (height / 2);

                    if (d.trackY === 1) {
                        if (y === -1 && e.pageY <= result) {
                            result = offs.top;
                        }
                        else if (y === 1 && e.pageY >= result) {
                            result = offs.top + height;
                        }
                    }
                }

                return Math.round(result);
            }

            // Invalidate.
            d.left = d.right = d.top = d.bottom = -1;

            if (d.trackX === -1) {
                // Left edge.
                if (this.rtl) {
                    d.left = col < colEnd ? getThreshold(1, 0, col, row) : -1;
                    d.right = col > 1 ? getThreshold(-1, 0, col - 1, row) : -1;
                }
                else {
                    // Ignore, case cannot occur (no grip).
                    //    d.left = col > 1 ? getThreshold(-1, 0, col - 1, row) : -1;
                    //    d.right = col < colEnd ? getThreshold(1, 0, col, row) : -1;
                }
            }
            else if (d.trackX === 1) {
                // Right edge.
                if (this.rtl) {
                    // Ignore, case cannot occur (no grip).
                }
                else {
                    d.left = colEnd > col ? getThreshold(-1, 0, colEnd, row) : -1;
                    d.right = colEnd <= this.cols.length ? getThreshold(1, 0, colEnd + 1, row) : -1;
                }
            }
            if (d.trackY === -1) {
                // Top edge.
                d.top = row > 1 ? getThreshold(0, -1, col, row - 1) : -1;
                d.bottom = row < rowEnd ? getThreshold(0, 1, col, row) : -1;
            }
            else if (d.trackY === 1) {
                // Bottom edge.
                d.top = rowEnd > row ? getThreshold(0, -1, col, rowEnd) : -1;
                d.bottom = rowEnd <= this.rows.length ? getThreshold(0, 1, col, rowEnd + 1) : -1;
            }
        };

        StoryGrid.prototype.resizeBlock = function (e, el) {
            if (!this._drag) {
                var sizer = $(el);
                var block = sizer.closest('.g-block');
                var blockData = this.getBlockData(block);
                var trackX = 0;
                var trackY = 0;
                this.toggleActiveState(block);
                block.addClass('dragging resizing');

                if (sizer.hasClass('g-sizebar-e')) {
                    trackX = this.rtl ? -1 : 1;
                    this.body.css('cursor', 'ew-resize');
                }
                else if (sizer.hasClass('g-sizebar-ne')) {
                    trackX = this.rtl ? -1 : 1;
                    trackY = -1;
                    this.body.css('cursor', 'ne-resize');
                }
                else if (sizer.hasClass('g-sizebar-se')) {
                    trackX = this.rtl ? -1 : 1;
                    trackY = 1;
                    this.body.css('cursor', 'se-resize');
                }

                if (sizer.hasClass('g-sizebar-n')) {
                    trackY = -1;
                    this.body.css('cursor', 'ns-resize');
                }
                else if (sizer.hasClass('g-sizebar-s')) {
                    trackY = 1;
                    this.body.css('cursor', 'ns-resize');
                }

                this.prepareDragging({
                    op: 'resizeBlock',
                    el: block[0],
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    oldX: 0,
                    oldY: 0,
                    trackX: trackX,
                    trackY: trackY,
                    scrollTimer: null,
                    scrollEdgeSize: 50,
                    scrollMaxStep: 20,
                    source: blockData,
                    target: jQuery.extend({}, blockData)
                });
                this.refreshResizeThreshold(e);
                return;
            }

            var d = this._drag;

            try {
                this.smoothEdgeScrolling(e, d);
            }
            finally {
                // noop
            }

            try {
                var x = 0;
                var y = 0;

                // Resize block if a threshold has been reached.
                if (d.trackX !== 0) {
                    if (d.left !== -1 && e.pageX < d.left && e.pageX < d.oldX) {
                        x = this.rtl ? 1 : -1;
                    }
                    else if (d.right !== -1 && e.pageX > d.right && e.pageX > d.oldX) {
                        x = this.rtl ? -1 : 1;
                    }
                }
                if (d.trackY !== 0) {
                    if (d.top !== -1 && e.pageY < d.top && e.pageY < d.oldY) {
                        y = -1;
                    }
                    else if (d.bottom !== -1 && e.pageY > d.bottom && e.pageY > d.oldY) {
                        y = 1;
                    }
                }

                d.oldX = e.pageX;
                d.oldY = e.pageY;

                if (x !== 0 || y !== 0) {
                    if (x !== 0 && d.trackX === -1) {
                        d.target.col += x;
                    }
                    if (x !== 0 && d.trackX === 1) {
                        d.target.colEnd += x;
                    }
                    if (y !== 0 && d.trackY === -1) {
                        d.target.row += y;
                    }
                    if (y !== 0 && d.trackY === 1) {
                        d.target.rowEnd += y;
                    }

                    $(d.el).css({
                        [this.getBlockStyleName('col')]: '{0}/{1}'.format(d.target.col, d.target.colEnd),
                        [this.getBlockStyleName('row')]: '{0}/{1}'.format(d.target.row, d.target.rowEnd)
                    });
                    this.setMinSizes();
                    this.refreshResizeThreshold(e);
                }
            }
            finally {
                // noop
            }
        };

        StoryGrid.prototype.getBlockActionUrl = function (blockId, action) {
            var url = $('#block-{0} .btn-action[data-action={1}]'.format(blockId, action)).attr('href');
            return url;
        };

        StoryGrid.prototype.getBlockData = function (block) {
            var col = block.css(this.getBlockStyleName('g-column')).split('/');
            var row = block.css(this.getBlockStyleName('g-row')).split('/');
        
            var obj = {
                id: parseInt(block.attr('data-id')) || 0,
                col: parseInt(col[0]),
                colEnd: parseInt(col[1]),
                row: parseInt(row[0]),
                rowEnd: parseInt(row[1])
            };

            if (obj.colEnd <= 0) obj.colEnd = this.cols.length + 1;
            if (obj.rowEnd <= 0) obj.rowEnd = this.rows.length + 1;

            return obj;
        };

        StoryGrid.prototype.getBlockAt = function (selector, x, y) {
            var result = null;

            this.stage.find(selector).each(function () {
                var block = $(this);
                var offs = block.offset();
                if (offs) {
                    if (x >= offs.left && x <= (offs.left + block.outerWidth()) && y >= offs.top && y <= (offs.top + block.outerHeight())) {
                        result = block;
                        return false;
                    }
                }
            });

            return result;
        };

        StoryGrid.prototype.smoothEdgeScrolling = function (e, data) {
            // https://www.bennadel.com/blog/3460-automatically-scroll-the-window-when-the-user-approaches-the-viewport-edge-in-javascript.htm
            var viewportX = e.clientX;
            var viewportY = e.clientY;
            var viewportWidth = document.documentElement.clientWidth;
            var viewportHeight = document.documentElement.clientHeight;
            var edgeTop = data.scrollEdgeSize;
            var edgeLeft = data.scrollEdgeSize;
            var edgeBottom = (viewportHeight - data.scrollEdgeSize);
            var edgeRight = (viewportWidth - data.scrollEdgeSize);
            var isInLeftEdge = (viewportX < edgeLeft);
            var isInRightEdge = (viewportX > edgeRight);
            var isInTopEdge = (viewportY < edgeTop);
            var isInBottomEdge = (viewportY > edgeBottom);
            if (!(isInLeftEdge || isInRightEdge || isInTopEdge || isInBottomEdge)) {
                clearTimeout(data.scrollTimer);
            }
            else {
                var documentWidth = Math.max(
                    document.body.scrollWidth,
                    document.body.offsetWidth,
                    document.body.clientWidth,
                    document.documentElement.scrollWidth,
                    document.documentElement.offsetWidth,
                    document.documentElement.clientWidth
                );
                var documentHeight = Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.body.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight,
                    document.documentElement.clientHeight
                );
                var maxScrollX = (documentWidth - viewportWidth);
                var maxScrollY = (documentHeight - viewportHeight);

                (function checkForWindowScroll() {
                    clearTimeout(data.scrollTimer);

                    function adjustWindowScroll() {
                        var currentScrollX = window.pageXOffset,
                            currentScrollY = window.pageYOffset,
                            canScrollUp = (currentScrollY > 0),
                            canScrollDown = (currentScrollY < maxScrollY),
                            canScrollLeft = (currentScrollX > 0),
                            canScrollRight = (currentScrollX < maxScrollX),
                            nextScrollX = currentScrollX,
                            nextScrollY = currentScrollY,
                            intensity;

                        if (isInLeftEdge && canScrollLeft) {
                            intensity = ((edgeLeft - viewportX) / data.scrollEdgeSize);
                            nextScrollX = (nextScrollX - (data.scrollMaxStep * intensity));
                        } else if (isInRightEdge && canScrollRight) {
                            intensity = ((viewportX - edgeRight) / data.scrollEdgeSize);
                            nextScrollX = (nextScrollX + (data.scrollMaxStep * intensity));
                        }

                        if (isInTopEdge && canScrollUp) {
                            intensity = ((edgeTop - viewportY) / data.scrollEdgeSize);
                            nextScrollY = (nextScrollY - (data.scrollMaxStep * intensity));
                        } else if (isInBottomEdge && canScrollDown) {
                            intensity = ((viewportY - edgeBottom) / data.scrollEdgeSize);
                            nextScrollY = (nextScrollY + (data.scrollMaxStep * intensity));
                        }

                        nextScrollX = Math.max(0, Math.min(maxScrollX, nextScrollX));
                        nextScrollY = Math.max(0, Math.min(maxScrollY, nextScrollY));

                        if (nextScrollX !== currentScrollX || nextScrollY !== currentScrollY) {
                            window.scrollTo(nextScrollX, nextScrollY);
                            return true;
                        }

                        return false;
                    }

                    if (adjustWindowScroll()) {
                        data.scrollTimer = setTimeout(checkForWindowScroll, 30);
                    }
                })();
            }
        };

        StoryGrid.prototype.rebuildEmptyBlocks = function () {
            // Don't remove tools inside empty blocks.
            $('.g-track-tools').hide().appendTo(this.body);

            // The first empty block is always the template.
            var blocks = this.story.find('.g-block-empty');
            var template = blocks.first().clone().removeClass('min-height min-width');

            blocks.remove();

            for (var r = 1; r <= this.rows.length; ++r) {
                for (var c = 1; c <= this.cols.length; ++c) {
                    var newBlock = template.clone();
                    newBlock.attr('data-row', r).attr('data-col', c).css('grid-area', '{0} / {1} / auto / auto'.format(r, c));

                    if (r === 1 && c === 1) {
                        newBlock.find('.g-column-header .g-track-size-label').text(this.cols[c - 1]);
                        newBlock.find('.g-row-header .g-track-size-label').text(this.rows[r - 1]);
                    }
                    else if (r === 1) {
                        newBlock.find('.g-row-header').remove();
                        newBlock.find('.g-column-header .g-track-size-label').text(this.cols[c - 1]);
                    }
                    else if (c === 1) {
                        newBlock.find('.g-column-header').remove();
                        newBlock.find('.g-row-header .g-track-size-label').text(this.rows[r - 1]);
                    }
                    else {
                        newBlock.find('.g-track-header').remove();
                    }

                    newBlock.find('.g-track-header').removeClass('hover active');

                    var lastBlock = this.story.find('.g-block-empty').last();
                    if (!lastBlock.length) {
                        this.story.prepend(newBlock);
                    }
                    else {
                        lastBlock.after(newBlock);
                    }
                }
            }
        };

        StoryGrid.prototype.addOrDeleteColumn = function (data) {
            // Update column template.
            if (data.op === 'delete-column') {
                this.cols.splice(data.col - 1, 1);
            }
            else {
                var index = Math.max(data.col + (data.op === 'add-column-left' ? -1 : 0), 0);
                this.cols.splice(index, 0, '1fr');
            }
            data.colTemplate = this.cols.join(' ');
            data.maxRow = this.rows.length + 1;
            data.maxCol = this.cols.length + 1;

            this.story.css('--g-template-columns', data.colTemplate);
            this.stage.attr('data-grid-cols', data.colTemplate);

            this.rebuildEmptyBlocks();
            this.sendMessage('grid.tool', data);

            var self = this;
            _.delay(function () { self.setMinSizes(); }, 100);
        };

        StoryGrid.prototype.addOrDeleteRow = function (data) {
            // Update row template.
            if (data.op === 'delete-row') {
                this.rows.splice(data.row - 1, 1);
            }
            else {
                var index = Math.max(data.row + (data.op === 'add-row-above' ? -1 : 0), 0);
                this.rows.splice(index, 0, 'auto');
            }
            data.rowTemplate = this.rows.join(' ');
            data.maxRow = this.rows.length + 1;
            data.maxCol = this.cols.length + 1;

            this.story.css('--g-template-rows', data.rowTemplate);
            this.stage.attr('data-grid-rows', data.rowTemplate);

            this.rebuildEmptyBlocks();
            this.sendMessage('grid.tool', data);

            var self = this;
            _.delay(function () { self.setMinSizes(); }, 100);
        };

        StoryGrid.prototype.splitSize = function (str) {
            var val, unit;

            if (!_.isEmpty(str)) {
                // Split functions.
                var arr = str.trim().replace(')', '').split(/\(/).filter(Boolean);
                if (arr.length === 2) {
                    val = arr[1];
                    unit = arr[0];
                }
                else {
                    // Split literal values.
                    arr = arr[0].split(/(\d+)/).filter(Boolean);
                    if (arr.length === 1) {
                        unit = arr[0];
                    }
                    else {
                        unit = arr.pop();
                        val = arr.join('');
                    }
                }
            }

            return { val: val, unit: unit };
        };

        StoryGrid.prototype.showTrackPopup = function (el) {
            var edit = $(el),
                self = this;

            var sizeUnit = self.trackPopup.find('#size-unit');
            var sizeValue = self.trackPopup.find('#size-value');
            var isRow = edit.hasClass('g-row-header');
            var colOrRow = edit.closest('.g-block').attr(isRow ? 'data-row' : 'data-col');
            var currentSize = self.splitSize(isRow ? self.rows[colOrRow - 1] : self.cols[colOrRow - 1]);

            // set new edit-mode
            edit.addClass('active');

            // set current size values
            sizeUnit.val(currentSize.unit || '').trigger('change');
            sizeValue.val(currentSize.val || '');

            // special case minmax
            if (currentSize.unit === 'minmax') {
                var maxValueCtrl = self.trackPopup.find("#max-value");
                var minMaxValue = sizeValue.val().split(",");

                sizeValue.val((minMaxValue[0] || '').trim());
                maxValueCtrl.val((minMaxValue[1] || "300px").trim());
            }

            // set meta data (to find current control when saving & to obtain original size setting)
            self.trackPopup
                .attr(isRow ? 'data-row' : 'data-col', colOrRow)
                .attr(isRow ? 'data-col' : 'data-row', '0')
                .attr('data-original-size', currentSize.val)
                .attr('data-original-unit', currentSize.unit);

            $('<div class="g-track-popup-backdrop"></div>')
                .appendTo(document.body)
                .one('click', function () {
                    self.hideTools();
                });

            // show popover
            edit.popover({
                placement: isRow ? 'right' : 'bottom',
                content: function () {
                    return self.trackPopup.show();
                },
                html: true,
                animation: false
            }).popover('show');
        };

        StoryGrid.prototype.updateSize = function () {
            var self = this;
            var ctrl = self.trackPopup;
            var data = {
                row: parseInt(ctrl.attr('data-row')) || 0,
                col: parseInt(ctrl.attr('data-col')) || 0
            };

            if (data.row === 0 && data.col === 0)
                return;
            
            var val = (ctrl.find('#size-value').val() || '').trim().replace('(', '').replace(')', '');
            var unit = ctrl.find('#size-unit').val() || '';
            
            if (unit === 'minmax') {
                var maxUnit = ctrl.find("#max-value");

                // validation
                if (maxUnit.val() == "") {
                    alert(maxUnit.data("validation-message"));
                    return;
                }
                val = 'minmax({0}, {1})'.format(val, maxUnit.val());
            }
            else if (unit === 'fit-content') {
                val = 'fit-content({0})'.format(val);
            }
            else if (unit === 'auto' || unit === 'min-content' || unit === 'max-content') {
                val = unit;
            }
            else {
                // validation
                if (val == "") {
                    alert(ctrl.data("validation-message"));
                    return;
                }

                val = val + unit;
            }

            if (data.row !== 0) {
                self.rows[data.row - 1] = val;
                data.op = 'update-row-size';
                data.rowTemplate = self.rows.join(' ');
                self.story.css('--g-template-rows', data.rowTemplate);
                self.stage.attr('data-grid-rows', data.rowTemplate);
                self.story
                    .find('.g-block-empty[data-col=1][data-row={0}]'.format(data.row))
                    .find('.g-row-header .g-track-size-label')
                    .text(val);
            }
            else {
                self.cols[data.col - 1] = val;
                data.op = 'update-column-size';
                data.colTemplate = self.cols.join(' ');
                self.story.css('--g-template-columns', data.colTemplate);
                self.stage.attr('data-grid-cols', data.colTemplate);
                self.story
                    .find('.g-block-empty[data-col={0}][data-row=1]'.format(data.col))
                    .find('.g-column-header .g-track-size-label')
                    .text(val);
            }

            self.sendMessage('grid.tool', data);
            
            _.delay(function () { self.setMinSizes(); }, 100);
        };

        StoryGrid.prototype.hideTools = function () {
            this.stage.find('.g-track-header').removeClass('hover active');
            this.stage.find('.g-track-size').show();
            this.trackPopup.hide().appendTo('body');
            $('.popover').remove();
            $('.g-track-popup-backdrop').remove();
            $('.g-track-tools').hide().appendTo(this.body);
        };

        StoryGrid.prototype.undoRedo = function (data) {
            // Apply grid settings.
            for (var i = 0; i < data.length; ++i) {
                var setting = data[i];
                switch (setting.id) {
                    case 'GridTemplateRows':
                        // Skip equal template.
                        if (setting.val === this.rows.join(' ')) continue;

                        // Update template.
                        this.rows = this._splitGridTemplate(setting.val);
                        this.story.css('--g-template-rows', setting.val);
                        this.stage.attr('data-grid-rows', setting.val);
                        this.rebuildEmptyBlocks();
                        break;
                    case 'GridTemplateColumns':
                        // Skip equal template.
                        if (setting.val === this.cols.join(' ')) continue;

                        // Update template.
                        this.cols = this._splitGridTemplate(setting.val);
                        this.story.css('--g-template-columns', setting.val);
                        this.stage.attr('data-grid-cols', setting.val);
                        this.rebuildEmptyBlocks();
                        break;
                    case 'GridGap':
                        this.story.css('--g-gap', setting.val);
                        this.gap = { width: this.getGapSize(true), height: this.getGapSize(false) };
                        break;
                }
            }

            this.setMinSizes();
        };

        return StoryGrid;
    })();

})( jQuery, this, document );