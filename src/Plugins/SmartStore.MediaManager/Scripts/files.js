Vue.component("m-files", {
    template: `
        <div class="m-pane-content">

            <div class="m-pane-header m-toolbar">
				<div class="m-tool-group">
					<button type="button" class="btn btn-light open-file-dialog" v-bind:disabled="$root.selectedFolder.isSpecial" v-on:click="setUploadUrl()">
						<i class="fa fa-upload"></i>
						<span class="d-none d-lg-inline">{{ T.upload }}</span>
					</button>
				</div>
                <div class="m-tool-group">
					<button type="button" class="btn btn-light btn-icon" :title="T.viewModeList" :class="{ 'active': files.viewMode == 'list' }" v-on:click="setViewMode('list')">
						<i class="fa fa-list"></i>
					</button>
					<button type="button" class="btn btn-light btn-icon" :title="T.viewModeGrid" :class="{ 'active': files.viewMode == 'grid' }" v-on:click="setViewMode('grid')">
						<i class="fa fa-th"></i>
					</button>
					<button type="button" class="btn btn-light btn-icon" :title="T.viewModeTiles" :class="{ 'active': files.viewMode == 'tiles' }" v-on:click="setViewMode('tiles')">
						<i class="fa fa-th-list"></i>
					</button>
				</div>
                <div class="m-tool-group">
                    <i class="far fa-image fa-sm mr-2" style="opacity: .25"></i>
                    <div class="range-slider h-auto" data-format="{0}" :title="T.thumbSize">
                        <input type="hidden" id="thumbSizeFactor" value="1.4" />
                        <input type="range" class="form-control-range px-0 custom-range" 
                            data-target="#thumbSizeFactor" 
                            min="0.75" max="2.5" step="0.05"
                            v-bind:disabled="files.viewMode === 'list'"
                            v-bind:value="$root.files.thumbSize"
                            v-on:input="onThumbSizeChanged" />
                    </div>
                    <i class="far fa-image fa-2x ml-2" style="opacity: .25"></i>
                </div>
				<div class="m-tool-group">
                    <div class="dropdown">
					    <button type="button" class="btn btn-light" :title="T.sortByX.format(sortDefs[$root.query.sortBy])" data-toggle="dropdown" aria-expanded="false">
						    <span>{{ sortDefs[$root.query.sortBy] }}</span>
					    </button>
                        <div class="dropdown-menu">
                            <a v-for="(name, field) in sortDefs" class="dropdown-item" href="#" 
                                :data-field="field" 
                                :class="{ 'selected': field === $root.query.sortBy }"
                                v-on:click.prevent="setSortField(field)">
                                <span>{{ name }}</span>
                            </a>
                        </div>
                    </div>
					<button type="button" class="btn btn-light btn-icon" :title="T.reverseSortDir" v-on:click="reverseSortDir">
						<i class="fa" :class="'fa-sort-amount-' + ($root.query.sortDesc ? 'down' : 'up') + '-alt'"></i>
					</button>
				</div>

                <button type="button" class="btn btn-light btn-to-primary ml-auto" 
                    v-if="$root.popup && $root.pickMode"
                    v-bind:disabled="$root.hasSelection ? null : 'disabled'"
                    v-on:click="$root.close">
				    <i class="fa fa-check"></i>
                    <span>{{ T.selectMedia }}</span>
				</button>
            </div>
            
            <div class="m-pane-body w-100 h-100 p-0 d-flex flex-column" style="overflow-y: hidden">
                <m-filter v-if="$root.enableSearch" :query="query"></m-filter>
                
                <div class="m-files p-0 w-100 flex-grow-1 custom-scrollbar"
                    v-on:scroll="loadNextPage"
                    v-on:dragover.prevent.stop="onDragOver">

                    <div v-if="files.data.length == 0 && !files.isLoading" class="p-3 text-muted">
                        {{ T.noFilesFound }}
                    </div>

                    <div v-show="files.data.length > 0" class="m-files-container" tabindex="1"
                        v-bind:class="'m-files-view-' + files.viewMode" 
                        v-bind:style="{ '--m-thumb-size-factor': files.thumbSize }"
                        v-on:keydown.exact.ctrl.a.prevent.stop="$root.selectAllFiles"
                        v-on:keydown.exact.ctrl.i.prevent.stop="$root.invertFileSelection"
                        v-on:keydown.exact.ctrl.x.prevent.stop="$root.setClipboardData('cut', 'file')"
                        v-on:keydown.exact.ctrl.c.prevent.stop="$root.setClipboardData('copy', 'file')"
                        v-on:keydown.exact.ctrl.v.prevent.stop="$root.onPaste"
                        v-on:keydown.exact.delete.prevent.stop="$root.emit('deleteFiles', $root.selectedFolder.path === '?trash')"
                        v-on:mouseup="$root.unselectAllFiles">

                        <pass v-for="(file, index) in files.data" :key="file.id" :icon="getIconHint(file)">
                            <div class="m-file" draggable="true"
                                slot-scope="{ icon }"
                                v-bind:class="{ 'selected': $root.isFileSelected(file) }"
                                v-bind:data-index="index"
                                v-bind:data-id="file.id"
                                v-bind:data-thumb-src="file.type == 'image' || file.type == 'video' ? file.thumbUrl : false"
                                v-on:mousedown="selectFile($event, file, index)"
                                v-on:mouseup="selectFile($event, file, index)"
                                v-on:dblclick="onFileDblClick"
                                v-on:contextmenu.prevent="onContextMenu($event, file)"
                                v-on:dragstart="onDragStart"
                                v-on:dragend="onDragEnd">
                                
                                <figure class="file-figure" :style="{ 'opacity': isCut(file) ? '0.4' : null }">
                                    <i class="file-icon fa-fw show" :class="icon.name" :style="{ color: icon.color }"></i>
                                    <picture v-if="file.type == 'image' || file.type == 'video'" v-show="files.viewMode !== 'list'" class="file-thumb" :data-type="file.type">
                                        <img class="m-file-img" :style="{ 'width': file.ext === '.svg' ? '100%' : null }" />
                                    </picture> 
                                </figure>

                                <div class="m-file-info">
                                    <div class="m-file-attr m-file-name">{{ file.name }}</div>
                                    <div v-show="files.viewMode != 'grid'" class="m-file-attr m-file-size">{{ $root.formatFileSize(file.size) }}</div>
                                    <div v-show="files.viewMode != 'grid'" class="m-file-attr m-file-dimensions">{{ $root.formatFileDimensions(file.dimensions) }}</div>
                                    <div v-show="files.viewMode === 'list' || (files.viewMode != 'grid' && files.thumbSize > 1)" class="m-file-attr m-file-date">{{ $root.formatFileDate(file.lastUpdated) }}</div>
                                </div>
                            </div>
                        </pass>
                    </div>
                    
                    <m-uploader :selected-folder="$root.selectedFolder"></m-uploader>

                    <div class="m-loading py-2 text-center" v-html="spinnerHtml" v-show="files.hasNextPage || files.isLoading"></div>
                </div>
            </div>
        </div>
    `,
    props: {
        query: Object,
        files: Object,
        thumbSize: Number // which gets appended to URL
    },
    created: function () {
        var self = this;
        var root = this.$root;

        // Localization
        this.T = window.Res.Media;

        this.sortDefs = {
            Id: this.T.fileDate,
            Name: this.T.fileName,
            UpdatedOnUtc: this.T.fileUpdatedDate,
            Size: this.T.fileSize,
            PixelSize: this.T.facetImgSize,
            MediaType: this.T.facetType,
            Extension: this.T.facetExtension
        };

        bus.$on('restoreFiles', function () {
            if (root.selectedFolder.path !== '?trash')
                return;

            root.restoreFiles(root.selectedFiles);
        });

        bus.$on('deleteFiles', function (permanent) {
            var files = root.selectedFiles;
            //var permanent = root.selectedFolder.path === '?trash';

            // TODO: (mm) Show info about tracked files?
            var msg = permanent
                ? files.length === 1
                    ? self.T.deleteFile.format('<b class="fwm">' + files[0].name + '</b>')
                    : self.T.deleteFiles.format(files.length)
                : files.length === 1
                    ? self.T.trashFile.format('<b class="fwm">' + files[0].name + '</b>')
                    : self.T.trashFiles.format(files.length);

            confirm2({
                message: msg,
                icon: { type: 'delete' },
                callback: function (accepted) {
                    if (accepted) {
                        root.deleteFiles(files, permanent);
                    }
                }
            });
        });

        bus.$on('renameFile', function (file) {
            file = file || root.selectedFiles[0];
            prompt2({
                message: self.T.renameFile,
                prompt: {
                    value: file.name,
                    invalidChars: INVALID_FILENAME_CHARS,
                    onInit: function (el) {
                        // Select until last dot
                        var endPos = file.name.lastIndexOf('.');
                        if (endPos > 0) {
                            el.setSelectionRange(0, endPos);
                        }
                        else {
                            $(el).select();
                        }
                    }
                },
                callback: function (name) {
                    if (name) {
                        root.renameFile(file, name);
                    }  
                }
            });
        });

        bus.$on('replaceFile', function (file) {
            file = file || root.selectedFiles[0];

            // Get dropzone.
            var dropzone = Dropzone.forElement($(".fu-fileupload").closest('.fu-container')[0]);

            // Set mime type of selected file.
            dropzone.hiddenFileInput.setAttribute("accept", file.type + "/*");

            // Remove multiple attribute for single file replacement.
            dropzone.hiddenFileInput.removeAttribute("multiple");

            // Set callback
            dropzone.onCompleted = root.replaceFile;

            // Open file upload dialog by triggering clickable elemenet of dropzone.
            $(dropzone.clickableElements[0]).trigger("click");

            // Set upload url.
            $(".fu-fileupload").data("upload-url", $('#url_replace_file').val() + "?id=" + file.id);
        });

        bus.$on('filesLoaded', function (scrollToTop) {
            self.paging = false;

            if (scrollToTop && !self.refreshing) {
                self._scrollTop = 0;
                self._elScrollable.scrollTop = 0;
            }
        });

        bus.$on('save', function (op, affectedFiles) {
            root.refreshFileCounts();

            // Work with a cloned query to bypass Vue reactivity
            var q = root.query.clone();
            q.pageSize = (q.pageIndex + 1) * q.pageSize;
            q.pageIndex = 0;

            self.refreshing = true;
            root.loadFiles(null /* folderId */, q, function (files) {
                var selectedFiles = [];

                // Iterate thru refreshed file list...
                files.data.forEach(function (f) {
                    // ...and check whether it contains any of the affected files
                    var affectedFile = affectedFiles[f.id.toString()];
                    if (affectedFile) {
                        // list contains affected file. We gonna show it as selected.
                        selectedFiles.push(f);
                    }
                });

                root.selectedFiles = selectedFiles;

                if (selectedFiles.length) {
                    // Refresh thumbs and scroll to first selected file (with a slight delay to give Vue the chance to complete rendering)
                    _.delay(function () {
                        // Refresh thumbs
                        var elThumbs = $(self._elFiles).find('> .m-file.selected .m-file-img[src]');
                        elThumbs.each(function () {
                            // Enforce thumbnail refresh
                            var img = $(this);
                            img.prop('src', img.prop('src'));
                        });

                        // Scroll to first selected file
                        var firstSelFile = $(self._elFiles).find('> .m-file.selected').get(0);
                        if (firstSelFile && !self.isVisible(firstSelFile)) {
                            $(self._elScrollable).scrollTo(firstSelFile, { duration: 200, offset: -30 });
                        }

                        self.refreshing = false;
                    }, 50);
                }
                else {
                    self.refreshing = false;
                }
            });
        });

        bus.$on('dupesDetected', function (op, result, finalizeCallback) {
            var dupes = result.dupes;
            var isCopy = _.str.startsWith(op, 'copy');
            var data = $.extend(true, {}, result.data);

            _.each(dupes, function (d) {
                // We deal with 'DuplicateFileInfo' type here, which is: { source, dest, uniquePath }.
                // We have to copy 'uniquePath' prop over to dest file obj,
                // because this is what the resolution dialog expects. 
                d.dest.uniquePath = d.uniquePath;
            });

            var dialog = SmartStore.Admin.Media.fileConflictResolutionDialog;
            dialog.open({
                queue: dupes,
                onComplete: function (cancelled) {
                    result.data = data;
                    finalizeCallback();
                },
                onResolve: function (resolutionType, slice) {
                    if (resolutionType === DUPE_ENTRY_SKIP) {
                        this.next();
                    }
                    else {
                        // 2nd pass: copy conflicted dupe files with selected resolution
                        var dlg = this;
                        root.ajax({
                            url: $(isCopy ? '#url_copy_files' : '#url_move_files').val(),
                            silent: true,
                            global: false,
                            data: {
                                files: _.map(slice, function (d) { return { fileId: d.source.id, destPath: d.dest.dir } }),
                                dupeHandling: resolutionType
                            },
                            success: function (result2) {
                                // Push file results from 2nd pass to origin data
                                root.validateFileOperationResult(result2);
                                $.extend(true, data, result2.data);
                                dlg.next();
                            }
                        });
                    }
                }
            });
        });
    },
    mounted: function () {
        this._elScrollable = this.$el.getElementsByClassName('m-files')[0];
        this._elFiles = this._elScrollable.getElementsByClassName('m-files-container')[0];
        this._intersectionObserver = new IntersectionObserver(this.handleIntersection, {
            root: this._elScrollable,
            threshold: 0.5,
            trackVisibility: false,
            delay: 250
        });

        this.spinnerHtml = window.createCircularSpinner(24, true, 6)[0].outerHTML;
    },
    updated: function () {
        var observer = this._intersectionObserver;

        $(this._elFiles).find('.m-file:not(.observed)').each(function () {
            this.classList.add('observed');
            observer.observe(this);
        });
    },
    data: function () {
        return {
            showUploader: false,
            spinnerHtml: '',
            paging: false,
            refreshing: false
        };
    },
    computed: {
        statusMessage: function () {
            var numFiles = this.files.data.length;
            var totalCount = this.files.totalCount;
            if (numFiles || totalCount)
                return '{0} von {1}'.format(numFiles.toLocaleString(), totalCount.toLocaleString());
            else
                return '';
        }
    },
    methods: {
        isCut(file) {
            var cb = this.$root.clipboard;
            return cb.op === 'cut' && cb.type === 'file' && cb.data.length && cb.data.indexOf(file) > -1;
        },
        getIconHint(file) {
            return SmartStore.media.getIconHint(file);
        },
        onContextMenu(e, file) {
            this.$root.showMenu(file, e.pageX, e.pageY);
        },
        onFileDblClick() {
            var root = this.$root;
            if (root.popup && root.pickMode && !root.multiSelect) {
                root.close();
            }
        },
        setUploadUrl() {
            var uploadUrl = $('#url_upload').val();
            uploadUrl = modifyUrl(uploadUrl, "path", this.$root.selectedFolder.path);
            $(".fu-fileupload").data("upload-url", uploadUrl);
        },
        onDragStart(e) {
            this.$root.dataTransfer = {
                type: 'file',
                data: this.$root.selectedFiles
            };
        },
        onDragEnd(e) {
            this.$root.dataTransfer = null;
        },
        onDragOver(e) {
            var dtItems = e.dataTransfer.items;
            var root = this.$root;
            this.showUploader = _.any(dtItems, function (it) {
                return it.kind === 'file' && root.selectedFolder.id > 0;
            });
            if (!this.showUploader) {
                e.dataTransfer.dropEffect = "move";
            }
        },
        selectFile(e, file, index) {
            if (e.button === 1)
                return;

            if ($('#m-body .resizer.is-resizing').length) {
                // Don't attempt to select file if a pane is being resized
                return;
            }

            var right = e.button === 2;
            var ctrl = e.ctrlKey;
            var shift = e.shiftKey;
            var up = e.type === 'mouseup';
            var isFileSelected = this.$root.isFileSelected(file);

            if (right && isFileSelected) {
                // When contextmenu is about to be shown but the context item is
                // selected already, don't make any attempts to unselect other items.
                e.stopPropagation();
                return false;
            }

            if (!up) {
                // Mouse DOWN
                if (shift) {
                    this.selectFileRange(e, file, index);
                }
                else if (!ctrl && !isFileSelected) {
                    // Make single selection when CTRL NOT pressed,
                    // but only when file is NOT selected already.
                    this.$root.unselectAllFiles();
                    this.$root.selectFile(file);             
                }
            }
            else {
                // Mouse UP
                e.stopPropagation(); // Prevent unselection in parent element

                if (ctrl) {
                    // Make additive multi selection when CTRL pressed (but only on mouseup)
                    this.$root.selectFile(file, true);
                }
                else if (!shift && isFileSelected) {
                    // If multiple file are selected and the currently clicked
                    // file is one of them: Unselect all other files, but keep clicked file selected.
                    this.$root.unselectAllFiles();
                    this.$root.selectFile(file);
                }
            }
        },
        selectFileRange(e, file, index) {
            var fromIndex = index;

            var selFiles = $(this._elFiles).find('> .m-file.selected');
            var firstIndex = selFiles.index();

            if (selFiles.length === 1) {
                fromIndex = firstIndex;
            }
            else if (selFiles.length > 1) {
                var isContinuous = true;
                var arrFiles = $.makeArray(selFiles);
                var curIndex = firstIndex;

                // Check whether current selection is continues (without any gaps)
                for (var i = 1; i < arrFiles.length; i++) {
                    var el = $(arrFiles[i]);
                    if (el.index() > curIndex + 1) {
                        isContinuous = false;
                        break;
                    }
                    curIndex++;
                }

                fromIndex = isContinuous
                    ? firstIndex
                    : selFiles.last().index(); 
            }

            this.$root.selectFileRange(fromIndex, index);
        },
        setViewMode(mode) {
            this.files.viewMode = mode;
        },
        onThumbSizeChanged: _.debounce(function (e) {
            this.changeThumbSize(e);
        }, Math.min(this.files ? this.files.data.length / 4 : 0, 100), false),
        changeThumbSize(e) {
            this.files.thumbSize = e.target.value;
        },
        setSortField: function (field) {
            this.$root.query.sortBy = field;
        },
        reverseSortDir: function () {
            this.$root.query.sortDesc = !this.$root.query.sortDesc;
        },
        handleIntersection: function (entries, observer) {
            if (this.files.data.length === 0 || this.files.viewMode === 'list')
                return;

            var loadImage = function (el, src) {
                el.setAttribute('data-thumb-loaded', true);
                var pic = $(el).find('> .file-figure > picture');
                var img = pic.find('> img');
                img.one('load', function () {
                    pic.addClass('show').prev().removeClass('show');
                });

                img.prop('src', src);
            };

            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var el = entry.target;
                    observer.unobserve(el);

                    if (el.getAttribute('data-thumb-loaded'))
                        return;

                    var src = el.getAttribute('data-thumb-src');
                    if (!src)
                        return;

                    loadImage(el, src);  
                } 
            });
        },
        isVisible: function (el, bounds) {
            // Checks whether the .m-file element is visible within the .m-files-container parent.
            if (!bounds) {
                var offset = $(this._elScrollable).offset();
                bounds = { top: offset.top, height: this._elScrollable.clientHeight };
            }

            var rc = el.getBoundingClientRect();
            var tViz = rc.top - bounds.top >= 0 && rc.top < bounds.height + bounds.top;
            var bViz = rc.bottom - bounds.top > 0 && rc.bottom <= bounds.height + bounds.top;
            var visible = (rc.top < 0 && rc.bottom > bounds.height) ? true : tViz || bViz;

            return visible;
        },
        onScroll: _.throttle(function (e) {
            this.loadNextPage(e);
        }, 50, true),
        loadNextPage(e) {
            // Check whether we reached the bottom and lazy load next page
            if (this.refreshing || this.files.isLoading || !this.files.hasNextPage)
                return;

            var scrollable = e.target;
            var list = this._elFiles;
            var offset = 300; // TODO: (mm) (mc) make this smart

            var eol = (scrollable.scrollTop + scrollable.clientHeight) >= list.clientHeight - offset;
            
            if (eol) {
                this.files.appendMode = true;
                this.paging = true;
                this.query.nextPage();
            }
        }
    }
});