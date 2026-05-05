"use strict";

(function ($, window, document, undefined) {

    var StoryEditor = window.StoryEditor = (function () {
        function StoryEditor() {
            this.body = $('body');
            this.container = $('.story-container');
            this.frameWrap = $('.story-frame-wrap');
            this.frame = $('.story-frame');
            this.stageSidebar = $('.se-stage');
            this.deviceStateSidebar = $('.se-devicestate');
            this.targets = $('#Targets');
            this.targetsContainer = $('#targets-container');
            this.deviceResizerContainer = $('#device-resizer-container');
            this.deviceSlider = $('#device-slider');
            this.deviceTracks = $('.device-tracks');
            this.deviceStates = null;
            this.blockManagerWrap = $('.block-manager-wrap');
            this.blockManager = $('.block-manager');
            this.dropIndicator = $('#bm-drop-indicator');
            this.showBlockManager = null;
            this.showBlockManager = null;
            this.blocks = null;
            this.activeBlockId = 0;
            this.modes = ['xs', 'sm', 'md', 'lg', 'xl'];
            this.currentDeviceMode = 'xl';
            this.isDirty = false;
            this.previewMode = false;
            this.fullscreen = false;
            this.stack = [];
            this.stackIndex = 0;
            this.missingRedoItem = null;
            this.saving = false;
            this.organizeBlocks = true;
            this._prevActiveBlockId = 0;
            this._prevScrollTop = 0;
            this._drag = null;
            this._sliderInput = false;
            this._initialized = false;

            this._refreshProps();
            this._initialize(); 
        }

        StoryEditor.prototype._refreshProps = function () {
            this.storyId = parseInt(this.container.data('storyid'));
            this.systemName = this.container.data('systemname');
            this.organizeBlocks = this.container.data('organize-blocks');
            this.refreshUrl = $('#btn-refresh').data('href');
        };

        StoryEditor.prototype._initialize = function () {
            var self = this;

            $(window).on('resize', function () {
                self.refreshSliderAttributes(false);
            });

            this.refreshSliderAttributes(true);

            // Tooltips
            $('.se-sidebar').tooltip({
                selector: "a.hint",
                placement: "top",
                trigger: 'hover',
                delay: { show: 400, hide: 0 }
            });

            this.deviceSlider.on('input', function () {
                if (self._sliderInput)
                    return;

                self._sliderInput = true;
                self.frameWidth.apply(self, [ $(this).val(), false ]);
                self._sliderInput = false;
            });

            // Reroute option buttons to invisible counterparts in the sidebar form
            $('.section-header button[data-target]').on('click', function (e) {
                e.preventDefault();
                $($(this).data('target')).trigger('click');
            });

            // Handle unwanted sidebar form submits (due to hidden submit buttons).
            $('#story-sidebar-form').on('keypress', ':input:not(textarea)', function (e) {
                if (13 === (e.which || e.keyCode)) {
                    e.preventDefault();
                    return false;
                }
            });

            this.body.on('click', '.btn-story-save', function (e) {
                e.preventDefault();
                self.save(true);
                return false;
            });

            $('#btn-story-preview-toggle').on('click', function () {
                self.setPreviewMode(!$(this).is('.active'));
            });

            $('#btn-story-fullscreen-toggle').on('click', function () {
                self.setFullscreen(!$(this).is('.active'));
            });

            $('#btn-refresh').on('click', function (e) {
                self.refreshGrid();
            });

            $('#btn-story-saveastemplate').on('click', function (e) {
                e.preventDefault();
                $('#save-as-template-dialog').modal('show').find('.btn-primary').removeAttr('disabled').find('i:first').remove();
                return false;
            });

            $('#save-as-template-dialog').on('click', '.btn-primary', function () {
                self.saveAsTemplate();
            }).on('change', 'input[name=ThumbnailCreation]', function () {
                $('#save-as-template-dialog').find('.picture-upload').toggle($(this).val() === 'upload');
            });

            $('#thumb-frame').on('load', function () {
                self.processTemplateThumbnail();
            });

            $('#btn-undo').on('click', function () {
                self.undoRedo(false);
                return false;
            });

            $('#btn-redo').on('click', function () {
                self.undoRedo(true);
                return false;
            });

            this.stageSidebar.on('click', '.t-arrow-up, .t-arrow-down', function () {
                self.setDirty(true);
            });

            this.stageSidebar.on('click', '.add-target', function (e) {
                e.preventDefault();
                self.addTarget($(this).data('type'));
            });

            this.targetsContainer.on('input change propertychange paste', '.form-control.target', function () {
                self._serializeTargets();
            });

            this.targetsContainer.on('click', '.remove-target', function () {
                $(this).closest('.target-control').remove();
                self._serializeTargets();
                self.setDirty(true);
            });

            _.delay(function () {
                self.stageSidebar.on('input change propertychange paste', 'input, select, textarea', function () {
                    if (!self._initialized) return false;
                    self.setDirty(true);
                });
            }, 250);

            self.deviceStateSidebar.on('change propertychange', '.dvc', function () {
                if (!self.organizeBlocks) return;
                var noUndo = false;
                var noRefresh = false;

                if ($(this).is('.dvc-spacing')) {
                    var stepper = $(self.deviceStateSidebar.data('stepper'));
                    if (stepper.length) {
                        noUndo = stepper.data('stepping');
                        // This prevents flooding the history stack with pointless entries.
                        // We suppress pushing action to history stack during subsequent stepping.
                        // The first step is sufficient.
                        stepper.data('stepping', true);

                        // Check whether control was auto-stepped due to locking with STRG or STRG+ALT
                        noRefresh = stepper.get(0) !== this;
                    }
                }

                self._processDevicePropertyChanged(this, noUndo, noRefresh);
            });

            EventBroker.subscribe("storygrid.unloading", function () {
                self.blocks = null;
                self.deviceStates = null;

                // Prevent IFrame mem leak
                var src = self.frame.prop('src');
                self.frame.remove();
                self.frame = $('<iframe class="story-frame" src="' + src + '"></iframe>').prependTo(self.frameWrap);
            });

            EventBroker.subscribe("storygrid.blocks", function (msg, data) {
                self.blocks = JSON.parse(JSON.stringify(data));
                self.refreshBlockManager();
                //self.sendMessage('blocks.organize');
            });

            EventBroker.subscribe("storygrid.breakpoints", function (msg, data) {
                self.deviceResizerContainer.css('--g-breakpoint-xs', data.xs);
                self.deviceResizerContainer.css('--g-breakpoint-sm', data.sm);
                self.deviceResizerContainer.css('--g-breakpoint-md', data.md);
                self.deviceResizerContainer.css('--g-breakpoint-lg', data.lg);
                self.deviceResizerContainer.css('--g-breakpoint-xl', data.xl);
            });

            EventBroker.subscribe("storygrid.devicestates", function (msg, data) {
                self.deviceStates = data;
            });

            EventBroker.subscribe("storygrid.devicechanged", function (msg, tier) {
                self.processDeviceChanged(tier);
            });

            EventBroker.subscribe("storygrid.block.command", function (msg, data) {
                self.processBlockCommand(data);
            });

            EventBroker.subscribe("storygrid.block.deactivated", function (msg, data) {
                $('.se-block').addClass('d-none');
                $('.se-story').removeClass('d-none');

                self.blockManager.find('.bm-block').removeClass('active');
                self.activeBlockId = 0;
            });

            EventBroker.subscribe("storygrid.block.activated", function (msg, data) {
                $('.se-block').removeClass('d-none');
                $('.se-story').addClass('d-none');

                self.blockManager.find('.bm-block').removeClass('active');
                self.blockManager.find('.bm-block[data-id={0}]'.format(data.id)).addClass('active');
                self.activeBlockId = data.id;
                self.refreshDeviceStateForm();
            });

            // Drag & drop (add block).
            this.stageSidebar.on('dragstart', '.btn-add-block', function () {
                self.sendMessage('drag.start', { op: 'addBlock', source: { blockType: $(this).data('blocktype') } });
            });

            this.stageSidebar.on('dragend', '.btn-add-block', function () {
                self.sendMessage('drag.end');
            });

            EventBroker.subscribe('storygrid.drag.drop', function (msg, data) {
                self.processDragAndDrop(data);
            });

            // Grid tools.
            EventBroker.subscribe('storygrid.grid.tool', function (msg, data) {
                self.processGridTool(data);
            });

            // Notify when leaving if there is anything to save.
            $(window).on('beforeunload', function () {
                if (self.isDirty && !self.saving) {
                    return false;
                }
            });

            $(window).on('keydown', function (e) {
                if (self._handleKeyboardShortcut(e)) {
                    e.preventDefault();
                }
            });

            this._initializeSpacingSteppers();
            this._initializeBlockManager();
            this._initializeBlockOrganization();
            this._initialized = true;
        };

        StoryEditor.prototype._initializeBlockOrganization = function () {
            if (this.organizeBlocks) return;

            this.deviceStateSidebar.find('.dvc').prop('disabled', true);
            this.deviceStateSidebar.find('.dvc-spacing').css('cursor', 'auto');

            var bmTemplateButtons = $('#block-manager-template').find('.bm-commands');
            bmTemplateButtons.find('[data-action="levelup"], [data-action="leveldown"]').addClass('disabled');
        };

        StoryEditor.prototype._initializeSpacingSteppers = function () {
            if (!this.organizeBlocks) return;
            var stepping = false;
            var prevY = 0;
            var sidebar = this.deviceStateSidebar;

            sidebar.on('mousedown', '.dvc-spacing .dvc', function (e) {
                e.stopPropagation();
                if (e.which === 1) {
                    stepping = true;
                    prevY = e.offsetY;
                    sidebar.addClass('stepping');
                    sidebar.data('stepper', this);
                }

                return false;
            });

            $(document).on('mousemove', function (e) {
                if (stepping) {
                    var diff = prevY - e.screenY;
                    if (Math.abs(diff) >= 6) {
                        var stepper = $(sidebar.data('stepper'));
                        var curVal = parseInt(stepper.val());
                        if (isNaN(curVal)) curVal = -1;
                        prevY = e.screenY;

                        if ((curVal === -1 && diff < 0) || (curVal === 6 && diff > 0)) {
                            // reached lbound/ubound
                            return;
                        }

                        var newVal = diff > 0 ? curVal + 1 : curVal - 1;
                        newVal = newVal === -1 ? null : newVal;
                        stepper.val(newVal).trigger('change');

                        if (e.ctrlKey) {
                            var oppositeSide = stepper.data('opposite');
                            var oppositeStepper = stepper.parent().find('> .dvc-spacing-' + oppositeSide);
                            oppositeStepper.val(newVal).trigger('change');

                            if (e.altKey) {
                                var axis = oppositeSide === 'l' || oppositeSide === 'r' ? 'y' : 'x';
                                var sides = axis === 'y' ? ['t', 'b'] : ['l', 'r'];
                                sides.forEach(function (val) {
                                    oppositeStepper = stepper.parent().find('> .dvc-spacing-' + val);
                                    oppositeStepper.val(newVal).trigger('change');
                                });
                            }
                        }
                    }
                }
            });

            $(document).on('mouseup mouseleave', function () {
                if (stepping) {
                    stepping = false;
                    sidebar.removeClass('stepping');
                    var stepper = $(sidebar.data('stepper'));
                    stepper.removeData('stepping');
                    sidebar.removeData('stepper');
                }
            });
        };

        StoryEditor.prototype._initializeBlockManager = function () {
            var self = this;

            // Process block manager click.
            this.blockManager.on('click', '.bm-block', function (e) {
                var block = $(this),
                    blockId = parseInt(block.data('id')) || 0;

                if ($(e.target).closest('.bm-display').length) {
                    // Toggle block visibility.
                    var state = self.getCurrentDeviceState(blockId) || {};

                    self.pushStack({
                        op: 'display',
                        updates: { name: 'display', blockId: blockId },
                        fn: function () {
                            var display = self.updateBlockVisibility(block, state['display'] || '', true);
                            self.updateDeviceStateSetting({ name: 'display', value: display, blockId: blockId });
                            self.setDirty(true);
                        }
                    });
                }
                else if ($(e.target).closest('.btn-block-menu').length) {
                    var childStoryId = block.data('child-story-id');
                    if (childStoryId > 0) {
                        var el = block.find('a[data-action=childstory]');
                        var url = el.data('url').replace('__storyid__', childStoryId);
                        el.attr('href', url).attr('data-url', url).removeClass('d-none');
                    }                    
                }
                else if ($(e.target).closest('.bm-commands, .bm-command').length) {
                    // Do nothing.
                }
                else {
                    // Toggle block active state.
                    var isActive = block.is('.active');

                    self.blockManager.find('.bm-block').removeClass('active');
                    block.toggleClass('active', !isActive);

                    self.grid().toggleActiveState(isActive ? null : blockId, true);
                }
            });

            // Process block manager command.
            this.blockManager.on('click', '.bm-command', function (e) {
                var $el = $(this);
                var data = {
                    op: $el.data('action'),
                    block: $el.closest('.bm-block')
                };

                if (data.op === 'childstory') {
                    return true;
                }

                e.preventDefault();

                if (data.op !== 'levelup' && data.op !== 'leveldown') {
                    data.url = $el.data('url').replace('__blockid__', parseInt(data.block.data('id')) || 0);
                }

                self.processBlockCommand(data);
            });

            if (!this.organizeBlocks) {
                return;
            }

            // Block item drag & drop.
            function finalizeDragging() {
                self._drag = null;
                self.blockManager.find('.bm-block-inner *').css('pointer-events', 'auto');
                self.blockManager.find('.bm-block').removeClass('dragging droppable');
                self.dropIndicator.css('display', 'none');
            }

            this.blockManager.on('dragstart', '.bm-block', function (e) {
                var block = $(this);
                block.addClass('dragging');
                e.originalEvent.dataTransfer.setDragImage(this, -8, -8);
                e.originalEvent.dataTransfer.setData('text/plain', block.data('id'));  // Firefox!
                self.blockManager.find('.bm-block-inner *').css('pointer-events', 'none');
                self.dropIndicator.css({ width: Math.round(block.outerWidth()) + 'px', left: Math.round(block.offset().left) + 'px' });
            });

            this.blockManager.on('dragend', '.bm-block', function () {
                finalizeDragging();
            });

            this.blockManager.on('dragover', '.bm-block', function (e) {
                e.preventDefault();  // Allow dropping.
                var d = self._drag;
                if (d) {
                    if (e.pageY <= d.middleY && d.direction <= 0) {
                        d.direction = 1;    // Upper half of d.dropId.
                        self.dropIndicator.css({ display: 'inline-block', top: d.top + 'px' });
                    }
                    else if (e.pageY > d.middleY && (d.direction === -1 || d.direction === 1)) {
                        d.direction = 0;    // Lower half of d.dropId.
                        self.dropIndicator.css({ display: 'inline-block', top: d.bottom + 'px' });
                    }
                }
            });

            this.dropIndicator.on('dragover', function (e) {
                e.preventDefault();  // Allow dropping.
            });

            this.blockManager.on('dragenter', '.bm-block', function (e) {
                e.preventDefault();

                var block = $(this),
                    offs = block.offset(),
                    pos = block.position(),
                    height = block.outerHeight();

                self._drag = {
                    target: e.target,
                    dropId: block.data('id'),
                    middleY: offs.top + (height / 2),
                    direction: -1,
                    top: pos.top,
                    bottom: pos.top + height
                };
            });

            this.blockManager.on('dragleave', '.bm-block', function (e) {
                if (self._drag && self._drag.target === e.target) {
                    e.preventDefault();
                    self._drag = null;
                    self.dropIndicator.css('display', 'none');
                }
            });

            this.blockManager.on('drop', '.bm-block', function (e) {
                e.preventDefault(); // Firefox!

                var d = self._drag,
                    dragId = parseInt(e.originalEvent.dataTransfer.getData('text/plain')) || 0;

                if (d && dragId !== 0 && dragId !== d.dropId) {
                    self.updateZIndex({
                        blockId: dragId,
                        dropId: d.dropId,
                        op: d.direction === 1 ? 'dragup' : 'dragdown'
                    });
                }

                finalizeDragging();
            });
        };

        StoryEditor.prototype._handleKeyboardShortcut = function (e) {
            var ctrlKey = e.ctrlKey;
            var key = e.key.toLowerCase();

            if (ctrlKey && key === "s") {
                if (this.isDirty) {
                    this.save(true);
                }
                return true;
            }
            else if (ctrlKey && key === "z") {
                this.undoRedo(false);
                return true;
            }
            else if (ctrlKey && key === "y") {
                this.undoRedo(true);
                return true;
            }
            else if (ctrlKey && e.keyCode === 122) {
                // Ctrl+F11 > Fullscreen
                this.setFullscreen(!this.fullscreen);
                return true;
            }
            else if (ctrlKey && e.altKey && key === 'p') {
                // Ctrl+Alt+P > Preview
                this.setPreviewMode(!this.previewMode);
                return true;
            }
            else if (!e.altKey && e.currentTarget !== window && this.activeBlockId) {
                if (e.keyCode === 46) {
                    // DELETE key pressed within grid frame
                    this.processBlockCommand({ op: 'delete', url: this.grid().getBlockActionUrl(this.activeBlockId, 'delete') });
                    return true;
                }
                else if (e.keyCode === 13) {
                    // ENTER key pressed within grid frame
                    this.processBlockCommand({ op: 'edit', url: this.grid().getBlockActionUrl(this.activeBlockId, 'edit') });
                    return true;
                }
            }

            return false;
        };

        StoryEditor.prototype.grid = function () {
            var frameWindow = this.frame[0].contentWindow;

            if (frameWindow && frameWindow.SmartStore) {
                return frameWindow.SmartStore.StoryGrid;
            }

            return null;
        };

        StoryEditor.prototype.sendMessage = function (msg, data) {
            this.frame[0].contentWindow.EventBroker.publish("story." + msg, data);
        };

        StoryEditor.prototype.frameWidth = function (width, animate) {
            if (width === undefined) {
                return this.frame.width();
            }

            width = toInt(width);

            var slider = this.deviceSlider,
                containerWidth = parseInt(this.container.width()),
                min = 350,
                max = containerWidth,
                resultWidth = Math.min(max, Math.max(min, width));

            // "resultWidth >= containerWidth" means: reached right edge of container
            this.frameWrap.css('--sfwidth', resultWidth >= containerWidth ? '100%' : resultWidth + 'px');

            if (!this._sliderInput || resultWidth !== parseInt(slider.val())) {
                slider.val(resultWidth);
            }         

            return resultWidth;
        };

        StoryEditor.prototype.getCurrentDeviceState = function (blockId) {
            blockId = blockId || this.activeBlockId;
            if (!blockId || !this.deviceStates)
                return undefined;

            var states = this.deviceStates['block-' + blockId];
            if (states) {
                return states[this.currentDeviceMode];
            }

            return undefined;
        };

        StoryEditor.prototype.getComputedDeviceState = function (forMode, blockId) {
            // Merges all state data from xs up to current breakpoint.
            blockId = blockId || this.activeBlockId;
            if (!blockId || !this.deviceStates)
                return undefined;

            var states = this.deviceStates['block-' + blockId];
            if (states) {
                var curMode = forMode || this.currentDeviceMode,
                    end = _.indexOf(this.modes, curMode),
                    computed = {};

                for (var i = 0; i <= end; i++) {
                    var mode = this.modes[i];
                    var state = states[mode];
                    if (state) {
                        _.each(state, function (val, key) {
                            if (!_.isEmpty(val)) {
                                var baseValue = computed[key];
                                computed[key] = { value: val, source: mode };
                                if (baseValue && !_.isEmpty(baseValue.value)) {
                                    computed[key]['baseValue'] = baseValue.value;
                                }
                            }
                        });
                    }
                }

                return computed;
            }
        };

        StoryEditor.prototype.refreshDeviceStateForm = function () {
            var curMode = this.currentDeviceMode;
            var state = this.getComputedDeviceState(curMode);
            if (!state)
                return;

            this.deviceStateSidebar.find('.dvc').each(function (i, el) {
                var ctl = $(el),
                    val = state[ctl.attr('name')],
                    isChoice = ctl.is('select'),
                    isEmpty = _.isEmpty(val),
                    isInherited = !isEmpty && val.source !== curMode;

                ctl.val(null).attr('placeholder', '');

                if (isChoice) {
                    var baseValue = val ? val.baseValue : undefined;
                    var firstOption = ctl.find('option').first().text('');
                    var placeholder;

                    if (isInherited) {
                        placeholder = '⚯ ' + ctl.find('option[value="' + val.value + '"]').text();
                    }
                    else if (baseValue) {
                        placeholder = ctl.find('option[value="' + baseValue + '"]').text();
                    }
                    else {
                        placeholder = ctl.find('option[value="' + ctl.data('default') + '"]').text();
                    }

                    if (placeholder) {
                        firstOption.text(placeholder);
                    }

                    ctl.toggleClass('text-muted', isEmpty || isInherited);

                    if (!isEmpty && !isInherited) {
                        ctl.val(val.value);
                    }
                }
                else if (!isEmpty) {
                    if (isInherited) {
                        ctl.attr('placeholder', val.value);
                    }
                    else {
                        ctl.val(val.value);
                    }  
                }
            });
        };

        StoryEditor.prototype.updateDeviceStateSetting = function (data, noRefresh) {
            var self = this;

            if (!this.deviceStates) {
                this.deviceStates = {};
            }

            function updateSettingCore(d) {
                d.blockId = d.blockId || self.activeBlockId;
                d.mode = d.mode || self.currentDeviceMode;
                d.states = self.deviceStates['block-' + d.blockId] || (self.deviceStates['block-' + d.blockId] = {});
                var state = d.states[d.mode] || (d.states[d.mode] = {});

                if (d.name === 'column' || d.name === 'row') {
                    var arr = d.value.split('/');
                    var prefix = d.name === 'column' ? 'col' : 'row';
                    state[prefix + 'start'] = arr[0];
                    state[prefix + 'end'] = arr[1];
                }
                else {
                    state[d.name] = _.isEmpty(d.value) ? null : d.value.toString();
                }
            } // updateSettingCore

            data = Array.isArray(data) ? data : [data];
            if (data.length === 0)
                return;

            for (var i = 0; i < data.length; ++i) {
                updateSettingCore(data[i]);
            }

            if (!noRefresh) {
                this.sendMessage('devicesetting.updated', data);
            }   
        };

        StoryEditor.prototype.processDeviceChanged = function (tier) {
            var marker = $('.device-marker-' + tier),
                modeChanged = this.currentDeviceMode !== tier;

            this.currentDeviceMode = tier;

            $('.blockmode-icon > .fa')
                .attr('class', 'fa fa-2x ' + marker.data('icon'))
                .attr('title', marker.data('title'));

            this.deviceTracks
                .find('.device-track')
                .removeClass('active')
                .filter('.device-track-' + tier)
                .addClass('active');

            this.refreshDeviceStateForm();

            if (modeChanged) {
                this.refreshBlockManager();
                var grid = this.grid();
                if (grid) {
                    grid.setMinSizes();
                }
            }
        };

        StoryEditor.prototype._processDevicePropertyChanged = function (control, noUndo, noRefresh) {
            var self = this,
                el = $(control),
                name = el.attr('name'),
                val = el.val();

            if (el.is('select')) {
                el.toggleClass('text-muted', !val);
            }

            if (name === 'zindex') {
                // No need to disallow undo for zindex
                self.updateZIndex({
                    op: 'set',
                    zIndex: val,
                    blockId: self.activeBlockId
                }, noUndo);
            }
            else {
                var fn = function () {
                    self.updateDeviceStateSetting({ name: name, value: val }, noRefresh);
                    if (_.isEmpty(val)) {
                        self.refreshDeviceStateForm();
                    }
                    self.setDirty(true);
                };

                if (noUndo) {
                    fn();
                }
                else {
                    self.pushStack({ op: name, updates: { name: name }, fn: fn });
                }

                switch (name) {
                    case 'colstart':
                    case 'colend':
                    case 'rowstart':
                    case 'rowend':
                        var grid = self.grid();
                        if (grid) {
                            _.delay(function () { grid.setMinSizes(); }, 100);
                        }
                        break;
                }
            }
        };

        StoryEditor.prototype._confirmAndSave = function () {
            if (this.isDirty && confirm(window.EditorRes['Plugins.SmartStore.PageBuilder.Story.SaveStoryConfirm'])) {
                this.save(false);
                return true;
            }

            // truthy when not dirty.
            return !this.isDirty;
        };

        StoryEditor.prototype.tidyStates = function () {
            var states = this.deviceStates;
            if (!states)
                return;

            function tidyObject(obj) {
                var hasProp = false;
                for (var key in obj) {
                    var prop = obj[key];
                    if (obj.hasOwnProperty(key)) {
                        if ($.isPlainObject(prop)) {
                            obj[key] = tidyObject(prop);
                            if (obj[key]) {
                                hasProp = true;
                            }
                        }
                        else {
                            if (prop !== null && prop !== undefined) {
                                hasProp = true;
                            }
                        }
                    }
                }

                return hasProp ? obj : undefined;
            }

            this.deviceStates = tidyObject(this.deviceStates);
        };

        StoryEditor.prototype.save = function (refresh) {
            if (this.saving)
                return;

            var self = this,
                isNew = this.storyId === 0,
                form = this.stageSidebar,
                states = this.deviceStates;

            if (!isNew && states) {
                // First tidy object by removing empty state objects from states list.
                this.tidyStates();

                // ...then stringify the device states object
                var json = JSON.stringify(states);

                form.find('#AllDeviceStates').val(json);        
            }

            var originalIgnore = form.validate().settings.ignore;

            // Hidden fields won't get validated otherwise
            form.validate().settings.ignore = null;

            function showFaultedControl(ctl) {
                var faultedControlPaneId = ctl.closest('.tab-pane').attr('id');
                var collapse = ctl.closest('.collapse');
                collapse.collapse('show');
                var tab = form.prev().find('.nav-link[href="#' + faultedControlPaneId + '"]');
                //console.log(tab.get(0));
                tab
                    .one('shown.bs.tab', function () {
                        ctl.get(0).scrollIntoView();
                    })
                    .tab('show');
            }

            if (!form.valid()) {
                var firstInvalidControl = form.find('.form-control.is-invalid').first();
                showFaultedControl(firstInvalidControl);
            }
            else {
                this.saving = true;
                $.ajax({
                    type: 'POST',
                    url: form.attr('action'),
                    data: form.serialize() + "&save=true",
                    complete: function (xhr, status) {
                        self.saving = false;
                    },
                    success: function (data) {
                        if (!data.success) {
                            if (data.errors && data.errors.length) {
                                for (var i = 0; i < data.errors.length; i++) {
                                    var state = data.errors[i];
                                    var describedby = state.key + '-error';
                                    var faultedControl = $('#' + state.htmlId);
                                    faultedControl.addClass('is-invalid').attr('aria-describedby', describedby);
                                    console.error(state.key, state.message);
                                    form.find('[data-valmsg-for="' + state.key + '"]')
                                        .removeClass('field-validation-valid')
                                        .addClass('invalid-feedback field-validation-error')
                                        .empty()
                                        .append('<span id="{0}">{1}</span>'.format(describedby, state.message));

                                    if (i === 0) {
                                        showFaultedControl(faultedControl);
                                    }
                                }
                            }          
                        }
                        else if (data.redirectUrl) {
                            self.setDirty(false);
                            setLocation(data.redirectUrl);
                        }
                        else {
                            self.clearStack();
                            self.setDirty(false);

                            if (refresh) {
                                self.refreshGrid();
                            }

                            form.find('.is-invalid, .is-valid').removeClass('is-invalid is-valid');

                            self.container.trigger('saved');
                        }

                        if (!_.isEmpty(data.message)) {
                            displayNotification(data.message, data.success ? 'success' : 'error');
                        }
                    }
                });
            }

            form.validate().settings.ignore = originalIgnore;
        };

        StoryEditor.prototype.setPreviewMode = function (previewMode) {
            if (this.previewMode === previewMode)
                return;

            this.previewMode = previewMode;
            $('#btn-story-preview-toggle').toggleClass("active", previewMode);

            if (previewMode) {
                if (this.blockManagerWrap.hasClass('show')) {
                    this.blockManagerWrap.removeClass('show');
                    this.refreshSliderAttributes(false);
                    this.showBlockManager = true;
                }
            }
            else {
                if (this.showBlockManager === true) {
                    this.blockManagerWrap.addClass('show');
                    this.refreshSliderAttributes(false);
                    this.showBlockManager = null;
                }
            }

            if (this.isDirty) {
                this.save(false);
            }

            this.refreshGrid(true);
        };

        StoryEditor.prototype.setFullscreen = function (fullscreen) {
            var self = this;

            this.fullscreen = fullscreen;
            var btn = $('#btn-story-fullscreen-toggle').toggleClass("active", fullscreen);
            this.body.toggleClass("fullscreen", fullscreen);

            btn.find('> .fa')
                .removeClass(fullscreen ? 'fa-expand' : 'fa-compress')
                .addClass(fullscreen ? 'fa-compress' : 'fa-expand');

            $(window).trigger('resize');
            self.deviceSlider.trigger('input');
        };

        StoryEditor.prototype.setDirty = function (dirty) {
            this.isDirty = dirty;
            if (dirty) {
                $('button.btn-story-save').removeClass('disabled').removeAttr('disabled');
            }
            else {
                $('button.btn-story-save').addClass('disabled').attr('disabled', true);
            }
        };

        StoryEditor.prototype.refreshGrid = function (forModeSwitch) {
            var self = this;
            var url = window.modifyUrl(this.refreshUrl, 'viewMode', this.previewMode ? "Preview" : "GridEdit");
            var isSwitchToPreviewMode = forModeSwitch && this.previewMode;
            var isEditRefresh = !forModeSwitch && !this.previewMode;
            var remember = isSwitchToPreviewMode || isEditRefresh;
            var isSwitchToEditMode = forModeSwitch && !this.previewMode;

            if (remember) {
                // When switching to preview mode we need to remember the scroll position of the editor,
                // so that we are able to restore it when user comes back.
                this._prevScrollTop = $(self.frame.get(0).contentWindow).scrollTop();

                if (isSwitchToPreviewMode) {
                    // When switching to preview mode we need to deactivate the current active block,
                    // but remember it so that we can restore state after switching back.
                    if (this.activeBlockId) {
                        this._prevActiveBlockId = this.activeBlockId;
                        var grid = this.grid();
                        if (grid) {
                            grid.toggleActiveState(null);
                        }
                    }
                }
            }

            var onLoad = function (e) {
                // DOM is fully loaded and parsed now.
                if (isSwitchToEditMode || isEditRefresh) {
                    // Refresh occurs after editing the story or a block in edit mode, OR
                    // after coming back from preview mode.
                    // In both cases we must restore the previous window state (scroll position & active block selection)
                    this.contentWindow.scrollTo(0, self._prevScrollTop);

                    var grid = self.grid();
                    if (grid) {
                        grid.toggleActiveState(self.activeBlockId || self._prevActiveBlockId); 
                    }

                    self._prevScrollTop = 0;
                    self._prevActiveBlockId = 0;
                }
            };

            var eventToken = EventBroker.subscribe("storygrid.unloading", function () {
                // Only handle this event once
                EventBroker.unsubscribe(eventToken);

                // Restore grid document state (scroll position & active block) once the frame has been refreshed.
                self.frame.one('load', onLoad);
            });

            // Reload now
            this.frame.prop('src', url);
        };

        StoryEditor.prototype.refreshSliderAttributes = function (initial) {
            var slider = this.deviceSlider,
                sliderWidth = slider.width(),
                val = parseFloat(slider.val()),
                prevMax = parseFloat(slider.attr('data-max'));

            slider.attr('max', sliderWidth);

            if (initial || val === prevMax) {
                slider.val(sliderWidth);
            }

            slider.attr('data-max', sliderWidth);
        };

        StoryEditor.prototype.addTarget = function (targetType) {
            var ctl = this.generateTargetControl(targetType);
            this.targetsContainer.append(ctl);
            window.applyCommonPlugins(ctl);
        };

        StoryEditor.prototype.generateTargetControl = function (type, value, label, gone) {
            var ctl, btn = "";

            if (type === "url") {
                ctl = $('<input type="text" class="form-control" />').val(value);
            }
            else if (type === "topic") {
                ctl = $('<select class="form-control" />')
                    .data('select-url', $('#TopicSelectUrl').val())
                    .data('select-selected-id', value)
                    .data('select-init-text', label);
            }
            else if (type === "category") {
                ctl = $('<select class="form-control" />')
                    .data('select-url', $('#CategorySelectUrl').val())
                    .data('select-selected-id', value)
                    .data('select-init-text', label);
            }
            else if (type === "manufacturer") {
                ctl = $('<select class="form-control" />')
                    .data('select-url', $('#ManufacturerSelectUrl').val())
                    .data('select-selected-id', value)
                    .data('select-init-text', label);
            }
            else if (type === "product") {

                var pickerId = 'productpicker-' + this.targetsContainer.children().length;

                ctl = $('<input type="text" class="form-control" id="' + pickerId + '-target" disabled/>').val(value);

                btn = '<div class="input-group-append">';
                btn += '<a href="javascript:void(0)" id="' + pickerId + '" data-url="' + $('#ProductSelectUrl').val() + '" data-target="#' + pickerId + '-target" data-appendMode="false" data-maxItems="1" class="btn btn-sm btn-secondary">';
                btn += '<i class="fa fa-search" />';
                btn += '</a>';
                btn += '</div>';

                _.delay(function () {
                    $("#" + pickerId).entityPicker();
                }, 500);
            }

            ctl.data('type', type).addClass('target');
            if (gone) {
                ctl.addClass('is-invalid');
            }

            function getIcon() {
                switch (type) {
                    case 'url': return 'fa fa-link';
                    case 'topic': return 'far fa-file';
                    case 'category': return 'fa fa-sitemap';
                    case 'manufacturer': return 'far fa-building';
                    case 'product': return 'fa fa-cube';
                }
            }

            var wrapper = [
                '<div class="target-control mb-2">',
                '	<div class="input-group input-group-sm">',
                '		<div class="input-group-prepend">',
                '			<span class="input-group-text" style="max-width: 45px"><i class="fa-fw ' + getIcon() + '"></i></span>',
                '		</div>',
                '	</div>',
                '</div>'
            ].join("");

            var inputGroup = $(wrapper).find('.input-group');
            inputGroup
                .append(ctl)
                .append(btn)
                .append('<div class="input-group-append"><button type="button" class="btn btn-outline-secondary btn-to-danger remove-target"><i class="far fa-trash-alt"></i></button></div>');

            return inputGroup.parent();
        };

        StoryEditor.prototype._serializeTargets = function () {
            var arrTargets = [];

            this.targetsContainer.find('.target').each(function () {
                var ctl = $(this);
                if (ctl.val()) {
                    var target = ctl.data('type') + ": " + ctl.val();
                    arrTargets.push(target);
                }
            });

            this.targets.val(_.uniq(arrTargets).join("; "));
        };

        StoryEditor.prototype.addOrDeleteColumn = function (data) {
            var deleteCol = data.op === 'delete-column';
            var col = deleteCol
                ? data.col
                : data.col + (data.op === 'add-column-left' ? 0 : 1);

            // Update state setting.
            for (var i = 0; i < data.blocks.length; ++i) {
                var b = data.blocks[i];
                if (col < b.colEnd) {
                    if (deleteCol) {
                        if (col <= b.col) {
                            b.col = Math.max(--b.col, 1);
                        }
                        b.colEnd = Math.max(--b.colEnd, 2);
                    }
                    else {
                        if (col <= b.col) {
                            b.col = Math.min(++b.col, data.maxCol);
                        }
                        b.colEnd = Math.min(++b.colEnd, data.maxCol);
                    }

                    this.updateDeviceStateSetting({ name: 'column', value: '{0}/{1}'.format(b.col, b.colEnd), blockId: b.id });
                }
            }

            this.stageSidebar.find('#GridTemplateColumns').val(data.colTemplate);
            this.setDirty(true);
            this.refreshDeviceStateForm();
        };

        StoryEditor.prototype.addOrDeleteRow = function (data) {
            var deleteRow = data.op === 'delete-row';
            var row = deleteRow
                 ? data.row
                 : data.row + (data.op === 'add-row-above' ? 0 : 1);

            // Update state setting.
            for (var i = 0; i < data.blocks.length; ++i) {
                var b = data.blocks[i];
                if (row < b.rowEnd) {
                    if (deleteRow) {
                        if (row <= b.row) {
                            b.row = Math.max(--b.row, 1);
                        }
                        b.rowEnd = Math.max(--b.rowEnd, 2);
                    }
                    else {
                        if (row <= b.row) {
                            b.row = Math.min(++b.row, data.maxRow);
                        }
                        b.rowEnd = Math.min(++b.rowEnd, data.maxRow);
                    }

                    this.updateDeviceStateSetting({ name: 'row', value: '{0}/{1}'.format(b.row, b.rowEnd), blockId: b.id });
                }
            }

            this.stageSidebar.find('#GridTemplateRows').val(data.rowTemplate);
            this.setDirty(true);
            this.refreshDeviceStateForm();
        };

        StoryEditor.prototype.updateSize = function (data) {
            if (data.op === 'update-row-size') {
                this.stageSidebar.find('#GridTemplateRows').val(data.rowTemplate);
            }
            else if (data.op === 'update-column-size') {
                this.stageSidebar.find('#GridTemplateColumns').val(data.colTemplate);
            }

            this.setDirty(true);
            this.refreshDeviceStateForm();
        };

        StoryEditor.prototype.clearStack = function () {
            this.stack = [];
            this.stackIndex = 0;
            this.refreshStackButtons();
        };

        StoryEditor.prototype.refreshStackButtons = function () {
            $('#btn-undo').prop('disabled', this.stackIndex <= 0);
            $('#btn-redo').prop('disabled', this.stackIndex >= (this.stack.length - 1));
        };

        StoryEditor.prototype.pushStack = function (data) {
            var self = this;

            function createStackItem() {
                // We must always keep all states and all settings otherwise redo does not work correctly.
                var d = {
                    op: data.op,
                    grid: null,
                    states: null
                };

                // Hackish. Undo pitfall of missing updateDeviceStateSetting call when the previous state doesn't contain updated property.
                if (data.updates) {
                    d.updates = {
                        name: data.updates.name,
                        blockId: data.updates.blockId || self.activeBlockId,
                        mode: data.updates.mode || self.currentDeviceMode
                    };
                    //options.updates = null;
                }

                // Deep clone device states.
                d.states = JSON.stringify(self.deviceStates);

                // Grid settings.
                var settings = [
                    { id: 'GridTemplateRows', val: self.stageSidebar.find('#GridTemplateRows').val() },
                    { id: 'GridTemplateColumns', val: self.stageSidebar.find('#GridTemplateColumns').val() },
                    { id: 'GridGap', val: self.stageSidebar.find('#GridGap').val() }
                ];
                d.grid = JSON.stringify(settings);

                return d;
            }
            
            // Invalidate higher stack items if undo was called.
            this.stack = this.stack.slice(0, this.stackIndex);
            this.stack.push(createStackItem());

            // Remove items from the start if limit has been reached.
            while (this.stack.length > 50) {
                this.stack.shift();
            }
            this.stackIndex = this.stack.length;
            this.refreshStackButtons();

            // Execute operation.
            data.fn();

            // Remember the last state so that the last redo step can also be executed.
            this.missingRedoItem = createStackItem();
        };

        StoryEditor.prototype.undoRedo = function (redo) {
            if (this.missingRedoItem) {
                this.stack.push(this.missingRedoItem);
                this.missingRedoItem = null;
            }

            var stackIndex = this.stackIndex + (redo ? 1 : -1);
            if (this.stack.length === 0 || stackIndex < 0 || stackIndex + 1 > this.stack.length) {
                // Out of range.
                return;
            }

            this.stackIndex = stackIndex;
            var d = this.stack[this.stackIndex];
            if (!d) return;

            // Apply grid settings.
            var gridSettings = d.grid ? JSON.parse(d.grid) : [];
            for (var i = 0; i < gridSettings.length; ++i) {
                var gs = gridSettings[i];
                this.stageSidebar.find('#' + gs.id).val(gs.val);
            }

            var refreshBlockManager = false;

            // Apply state settings.
            if (d.states) {
                var applied = false;
                var settings = [];
                this.deviceStates = JSON.parse(d.states);

                for (var block in this.deviceStates) {
                    if (this.deviceStates.hasOwnProperty(block)) {
                        var states = this.deviceStates[block];
                        if (states) {
                            var blockId = parseInt(block.replace('block-', '')) || 0;
                            var state = this.getComputedDeviceState(this.currentDeviceMode, blockId);
                            if (state) {
                                for (var name in state) {
                                    if (state.hasOwnProperty(name)) {
                                        var s = { name: name, value: state[name].value, blockId: blockId, mode: state[name].source, states: states };

                                        if (name === 'colstart') {
                                            s.name = 'column';
                                            s.value = '{0}/{1}'.format(s.value, state['colend'].value);
                                        }
                                        else if (name === 'colend') {
                                            s.name = 'column';
                                            s.value = '{0}/{1}'.format(state['colstart'].value, s.value);
                                        }
                                        else if (name === 'rowstart') {
                                            s.name = 'row';
                                            s.value = '{0}/{1}'.format(s.value, state['rowend'].value);
                                        }
                                        else if (name === 'rowend') {
                                            s.name = 'row';
                                            s.value = '{0}/{1}'.format(state['rowstart'].value, s.value);
                                        }

                                        settings.push(s);

                                        if (d.updates && d.updates.blockId === blockId && d.updates.mode === state[name].source && d.updates.name === name) {
                                            applied = true;
                                        }
                                        if (name === 'display' || name === 'zindex') {
                                            refreshBlockManager = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (!applied && d.updates) {
                    // Undo pitfall. State doesn't contain updated property. Force stage to empty the setting.
                    settings.push({ name: d.updates.name, value: '', blockId: d.updates.blockId, mode: d.updates.mode, states: {} });

                    if (d.updates.name === 'display' || d.updates.name === 'zindex') {
                        refreshBlockManager = true;
                    }
                }

                this.sendMessage('devicesetting.updated', settings);
            }

            this.sendMessage('command.undoRedo', gridSettings);
            this.refreshStackButtons();
            this.refreshDeviceStateForm();
            if (refreshBlockManager) {
                this.refreshBlockManager();
            }

            this.setDirty(true);
        };

        StoryEditor.prototype.refreshBlockManager = function () {
            this.blockManager.empty();

            if (!this.blocks || !this.blocks.length)
                return;

            var self = this;
            var title, template = $('#block-manager-template').find('.bm-block').first();

            // Get current zIndex (required for sorting).
            _.each(this.blocks, function (b) {
                b.zIndex = undefined;
                b.display = '';
                var state = self.getCurrentDeviceState(b.id);
                if (state) {
                    b.display = state['display'] || '';
                    b.zIndex = parseInt(state['zindex']);
                    if (isNaN(b.zIndex)) {
                        b.zIndex = undefined;
                    }
                }
            });

            // Sort by zIndex descending then in the reverse order in which the blocks were rendered.
            this.blocks = _.sortBy(this.blocks, function (o) { return o.zIndex === undefined ? 0 : -o.zIndex; });

            // Append blocks to block manager list.
            _.each(this.blocks, function (b) {
                var block = template.clone();
                title = _.isEmpty(b.title) ? b.name : b.title;

                if (self.activeBlockId === b.id) {
                    block.addClass('active');
                }

                block.attr('data-id', b.id);
                block.attr('data-child-story-id', b.childStoryId);
                block.find('.bm-title').text(title).attr('title', title);
                block.find('.bm-icon').attr('title', b.name).find('i').attr('class', b.icon);

                self.updateBlockVisibility(block, b.display, false);
                self.blockManager.append(block);
            });
        };

        StoryEditor.prototype.updateZIndex = function (data, noUndo) {
            if ((data.blockId || 0) === 0) return;

            var self = this;
            var batch = [];
            var uniqueNum = 0;

            function finalize() {
                self.refreshBlockManager();
                self.refreshDeviceStateForm();
                self.setDirty(true);
            }

            // Ensure that all blocks have a unique z-index.
            for (var i = this.blocks.length - 1; i >= 0; --i) {
                var b = this.blocks[i];
                if (b.zIndex === undefined) {
                    b.zIndex = uniqueNum++;
                    batch.push({ name: 'zindex', value: b.zIndex, blockId: b.id });
                }
            }

            this.updateDeviceStateSetting(batch);
            batch = [];

            // Calculate new z-index.
            var state = this.getCurrentDeviceState(data.dropId || data.blockId);
            var zIndex = parseInt(state ? state['zindex'] : 0) || 0;
            //var log = '{0}: {1}'.format(data.blockId, zIndex);
            if ((data.op === 'levelup' || data.op === 'dragup') && zIndex < 2147483647) {
                ++zIndex;
            }
            else if (data.op === 'leveldown') {
                if (zIndex <= 0) return;
                --zIndex;
            }
            else if (data.op === 'set') {
                zIndex = parseInt(data.zIndex) || 0;
            }

            if (zIndex < 0) zIndex = 0;
            //log += ' {0}... '.format(zIndex);

            var fn = function () {
                if (data.op === 'dragup' || data.op === 'dragdown') {
                    // Displace all blocks with z-index >= new z-index.
                    var last = zIndex;
                    for (var i = self.blocks.length - 1; i >= 0; --i) {
                        var b = self.blocks[i];
                        if (b.id !== data.blockId && b.zIndex >= zIndex && b.zIndex <= last) {
                            b.zIndex = ++last;
                            batch.push({ name: 'zindex', value: b.zIndex, blockId: b.id });
                        }
                    }

                    batch.push({ name: 'zindex', value: zIndex, blockId: data.blockId });
                    self.updateDeviceStateSetting(batch);

                    var div = self.blockManager.find('.bm-block[data-id={0}]'.format(data.blockId));
                    var to = self.blockManager.find('.bm-block[data-id={0}]'.format(data.dropId));

                    if (data.op === 'dragup') {
                        div.hide().insertBefore(to).show(0, finalize);
                    }
                    else {
                        div.hide().insertAfter(to).show(0, finalize);
                    }
                }
                else {
                    self.updateDeviceStateSetting({ name: 'zindex', value: zIndex, blockId: data.blockId });
                    finalize();
                }
            };

            // Apply new zindex.
            if (noUndo) {
                fn();
            }
            else {
                this.pushStack({ op: data.op, updates: { name: 'zindex', blockId: data.blockId }, fn: fn });
            }

            //_.each(this.blocks, function (b) { log += '{0}:{1} '.format(b.id, b.zIndex); });
            //console.log(log + data.op);
        };

        StoryEditor.prototype.updateBlockVisibility = function (block, display, toggle) {
            var val = display || '',
                title = '',
                elIcon = block.find('.bm-display > i'),
                elInner = block.find('.bm-block-inner');

            if (toggle) {
                val = val === 'flex' ? 'none' : (val === 'none' ? '' : 'flex');
            }

            elIcon.removeClass('fa-eye fa-eye-slash fa-link text-danger text-muted');
            elInner.removeClass('text-muted');

            if (val === 'flex') {
                elIcon.addClass('fa-eye');
                title = window.EditorRes['Plugins.SmartStore.PageBuilder.Story.Visible'];
            }
            else if (val === 'none') {
                elIcon.addClass('fa-eye-slash text-danger');
                elInner.addClass('text-muted');
                title = window.EditorRes['Plugins.SmartStore.PageBuilder.Story.NotVisible'];
            }
            else {
                elIcon.addClass('fa-link text-muted');
                title = window.EditorRes['Plugins.SmartStore.PageBuilder.Story.UnspecifiedVisibility'];

                var state = this.getComputedDeviceState(this.currentDeviceMode, parseInt(block.data('id')) || 0);
                if (state && state['display'] && state['display'].value === 'none') {
                    elInner.addClass('text-muted');
                }
            }

            block.find('.bm-display').attr('title', title);

            return val;
        };

        StoryEditor.prototype.processBlockCommand = function (data) {
            var self = this;

            function processServerResponse(response) {
                if (!_.isEmpty(response.message)) {
                    displayNotification(response.message, response.success ? 'success' : 'error');
                }
                if (response.success) {
                    self.refreshGrid();
                }
            }

            if (!self._confirmAndSave())
                return;

            switch (data.op) {
                case 'edit':
                    window.openPopup(data.url, true, true);
                    break;
                case 'copy':
                    $.ajax({
                        type: 'POST',
                        cache: false,
                        url: data.url,
                        success: processServerResponse
                    });
                    break;
                case 'delete':
                    if (confirm(window.Res["Admin.Common.AreYouSure"])) {
                        $.ajax({
                            type: 'POST',
                            cache: false,
                            url: data.url,
                            success: processServerResponse
                        });
                    }
                    break;
                case 'levelup':
                case 'leveldown':
                    this.updateZIndex({
                        op: data.op,
                        blockId: parseInt(data.block.data('id')) || 0
                    });
                    break;
            }
        };

        StoryEditor.prototype.processDragAndDrop = function (data) {
            if (!data.op || !this._initialized) return;

            if (data.op === 'addBlock') {
                if (this.storyId === 0) {
                    displayNotification(window.EditorRes['Plugins.SmartStore.PageBuilder.Story.SaveStory'], 'warning');
                }
                else {
                    if (!this._confirmAndSave()) {
                        return;
                    }

                    var url = $('#se-blocks').data('addurl');
                    url = modifyUrl(url, 'blockType', data.source.blockType);
                    url = modifyUrl(url, 'col', data.target.col);
                    url = modifyUrl(url, 'row', data.target.row);

                    window.openPopup(url, true, true);
                }
            }
            else if (data.op === 'moveBlock' || data.op === 'resizeBlock') {
                var self = this;
                this.pushStack({
                    op: data.op,
                    fn: function () {
                        self.updateDeviceStateSetting([
                            { blockId: data.source.id, name: 'column', value: '{0}/{1}'.format(data.target.col, data.target.colEnd) },
                            { blockId: data.source.id, name: 'row', value: '{0}/{1}'.format(data.target.row, data.target.rowEnd) }
                        ]);
                        self.setDirty(true);
                        self.refreshDeviceStateForm();
                    }
                });
            }
        };

        StoryEditor.prototype.processGridTool = function (data) {
            if (!this._initialized) return;

            var self = this;
            switch (data.op) {
                case 'add-row-above':
                case 'add-row-below':
                case 'delete-row':
                    this.pushStack({
                        op: data.op,
                        fn: function () {
                            self.addOrDeleteRow(data);
                        }
                    });
                    break;
                case 'add-column-left':
                case 'add-column-right':
                case 'delete-column':
                    this.pushStack({
                        op: data.op,
                        fn: function () {
                            self.addOrDeleteColumn(data);
                        }
                    });
                    break;
                case 'update-row-size':
                case 'update-column-size':
                    this.pushStack({
                        op: data.op,
                        fn: function () {
                            self.updateSize(data);
                        }
                    });
                    break;
            }
        };

        StoryEditor.prototype.saveAsTemplate = function () {
            var dialog = $('#save-as-template-dialog'),
                form = dialog.find('form:first');

            if (form.find('input[name=ThumbnailCreation]:checked').val() === 'upload') {
                // The user has uploaded a thumbnail.
                if (form.find('input[name=ThumbnailId]').val()) {
                    if (this.isDirty) {
                        this.save(false);
                    }
                    this.submitSaveAsTemplate();
                }
                else {
                    displayNotification(window.EditorRes['Plugins.SmartStore.PageBuilder.Story.UploadThumbnailNote'], 'warning');
                }
                return;
            }

            // Create the thumbnail automatically.
            dialog.find('.btn-primary').prop('disabled', true).prepend('<i class="fa fa-fw fa-spinner fa-spin"></i>');

            if (this.isDirty) {
                this.save(false);
            }

            var $frame = $('#thumb-frame');
            $frame.attr('src', $frame.attr('data-url'));
        };

        StoryEditor.prototype.submitSaveAsTemplate = function () {
            var dialog = $('#save-as-template-dialog'),
                form = dialog.find('form:first');

            $.ajax({
                type: 'POST',
                url: form.attr('action'),
                data: form.serialize(),
                success: function (response) {
                    if (!_.isEmpty(response.message)) {
                        displayNotification(response.message, response.success ? 'success' : 'error', response.success);
                    }
                },
                complete: function () {
                    dialog.modal('hide');
                }
            });
        };

        StoryEditor.prototype.processTemplateThumbnail = function () {
            var self = this,
                frame = $('#thumb-frame');

            if (_.isEmpty(frame.attr('src'))) {
                return;
            }

            // Thumb frame must be visible and size must fit content.
            var body = frame.contents().find('body')[0];
            frame.css('display', 'block').attr('height', body.scrollHeight);

            // The delay is required even though transition\animation is switched off.
            _.delay(function () {
                // Render g-stage because background settings are applied on it.
                var renderElem = $(body).find('.g-stage')[0];
                // http://html2canvas.hertzen.com/configuration
                html2canvas(renderElem).then(function (canvas) {
                    frame.css('display', 'none').attr('src', '');

                    var data = canvas.toDataURL('image/png');
                    var form = $('#save-as-template-dialog').find('form:first');
                    form.find('input[name=ThumbnailData]').val(data);
                    form.find('input[name=Width]').val(canvas.width);
                    form.find('input[name=Height]').val(canvas.height);
                    self.submitSaveAsTemplate();

                    // Check thumbnail by appending canvas to story frame:
                    //self.frame.contents().find('body')[0].appendChild(canvas);
                    //$('#save-as-template-dialog').modal('hide');
                });
            }, 500);
        };

        return StoryEditor;
    })();

})( jQuery, this, document );