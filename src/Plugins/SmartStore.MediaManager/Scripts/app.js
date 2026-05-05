
var SPECIAL_FOLDER_ALL = -500;
var SPECIAL_FOLDER_TRASH = -400;
var SPECIAL_FOLDER_ORPHANS = -300;
var SPECIAL_FOLDER_TRANSIENT = -200;
var SPECIAL_FOLDER_UNASSIGNED = -100;

var DUPE_ENTRY_THROW = 0;
var DUPE_ENTRY_OVERWRITE = 1;
var DUPE_ENTRY_RENAME = 2;
var DUPE_ENTRY_SKIP = 3;

var FILE_HANDLING_SOFTDELETE = 0;
var FILE_HANDLING_MOVETOROOT = 1;
var FILE_HANDLING_DELETE = 2;

var INVALID_PATH_CHARS = ':*?&"<>|\0\b\t\n\v\f\r';
var INVALID_FILENAME_CHARS = INVALID_PATH_CHARS + '\\/';

var bus = new Vue();

// https://dev.to/loilo92/an-approach-to-vuejs-template-variables-5aik
Vue.component("pass", {
    render() {
        return this.$scopedSlots.default(this.$attrs);
    }
});

function initializeMediaManager() {
    window.mediaApp = new Vue({
        el: '#media-manager',
        data: {
            popup: false,
            pickMode: false,
            multiSelect: false,
            initialPath: 'file',
            enableSearch: true,
            typeFilter: [],
            selectedFolder: {},
            folders: [],
            query: {
                refreshFileCounts: false,
                mediaTypes: [],
                extensions: [],
                tags: [],
                dimensions: [],
                term: '',
                pageIndex: 0,
                pageSize: 200,
                sortBy: 'Id',
                sortDesc: false,
                clone() {
                    return $.extend({}, this);
                },
                firstPage() {
                    if (!this._pageRequested) {
                        this._pageRequested = true;
                        this.pageIndex = 0;
                    }
                },
                nextPage() {
                    if (!this._pageRequested) {
                        this._pageRequested = true;
                        this.pageIndex++;
                    }
                },
                complete() {
                    this._pageRequested = false;
                }
            },
            files: {
                totalCount: 0,
                pageIndex: 0,
                hasNextPage: false,
                appendMode: false,
                isLoading: false,
                viewMode: 'grid',
                thumbSize: 1.4,
                data: []
            },
            selectedFiles: [],
            clipboard: {
                op: '', // cut || copy
                type: '', // file || folder
                data: null,
                get isValid() {
                    return this.op && this.type && this.data;
                }
            },
            dataTransfer: null,
            menu: {
                show: false,
                type: 'file', // file || folder
                context: null, // fileObj || folderObj
                x: 0,
                y: 0,
                get canMove() {
                    return this.context && !(this.context.isSpecial || this.context.isAlbum);
                },
                get canPaste() {
                    return this.context && !(this.context.isSpecial);
                },
                get canDelete() {
                    return this.context && !(this.context.isSpecial || this.context.isAlbum);
                },
                get canRename() {
                    return this.canDelete;
                },
                get canAdd() {
                    return this.context && !(this.context.isSpecial);
                },
                get canDetectTracks() {
                    return this.type === 'folder' && this.context && this.context.isAlbum && this.context.canDetectTracks;
                }
            },
            leftPaneWidth: '250px',
            rightPaneWidth: '250px'
        },
        created: function () {
            var self = this;

            // Localization
            this.T = window.Res.Media;

            // Control reactivity
            this._selectedFolderId = null;

            // Load user prefs
            this.userPrefs = JSON.parse(localStorage.getItem('mm:userPrefs'));

            bus.$on('folderSelected', function (folder) {
                var q = self.query;
                var f = self.files;

                f.appendMode = false;
                q.pageIndex = 0;

                self.selectedFolder = folder;

                //self.loadFiles();
            });

            bus.$on('paneResized', function (data) {
                var pane = data.pane;

                if (pane.id === 'm-folders')
                    self.leftPaneWidth = data.width;
                else
                    self.rightPaneWidth = data.width;
            });
        },
        beforeMount() {
            var self = this;

            this.popup = toBool(this.$el.getAttribute('data-popup'));
            this.multiSelect = toBool(this.$el.getAttribute('data-multi-select'));
            this.initialPath = this.$el.getAttribute('data-path');
            this.enableSearch = toBool(this.$el.getAttribute('data-enable-search'), true);
            // Cannot pick files when initial path is virtual (like 'trash', 'all' etc.)
            this.pickMode = this.initialPath[0] !== '?' && toBool(this.$el.getAttribute('data-pick-mode'));

            var typeFilter = this.$el.getAttribute('data-type-filter');
            if (typeFilter && typeFilter !== '*') {
                this.typeFilter = _.map(typeFilter.trim().split(','), function (t) { return t.trim() });
                this.typeFilter.forEach(function (t) {
                    if (t[0] === '.') {
                        self.query.extensions.push(t.substring(1));
                        self.query._extFixed = true;
                    }
                    else {
                        self.query.mediaTypes.push(t);
                        self.query._typeFixed = true;
                    }
                });
            }

            // Load folders initially
            this.loadFolders();
        },
        mounted: function () {
            var self = this;
            $(document).on('mousedown', function () {
                self.closeMenu();
            });
        },
        computed: {
            userPrefs: {
                get: function () {
                    return {
                        viewMode: this.files.viewMode,
                        thumbSize: this.files.thumbSize,
                        leftPaneWidth: this.leftPaneWidth,
                        rightPaneWidth: this.rightPaneWidth,
                        sortBy: this.query.sortBy,
                        sortDesc: this.query.sortDesc
                    };
                },
                set: function (value) {
                    if (!value)
                        return;

                    this.leftPaneWidth = value.leftPaneWidth;
                    this.rightPaneWidth = value.rightPaneWidth;
                    this.files.viewMode = value.viewMode;
                    this.files.thumbSize = value.thumbSize;
                    this.query.sortBy = value.sortBy || 'Id';
                    this.query.sortDesc = value.sortDesc || false;
                }
            },
            hasSelection() {
                return this.selectedFiles && this.selectedFiles.length;
            },
            selectedFile() {
                return this.selectedFiles.length ? this.selectedFiles[0] : null;
            },
            canRestoreSelectedFiles() {
                // Can only restore soft-deleted files that are assigned to an existing folder.
                return _.find(this.selectedFiles, function (f) { return f.deleted && f.folderId });
            }
        },
        methods: {
            // Common
            // ======================================================
            emit() {
                bus.$emit.apply(bus, $.makeArray(arguments));
            },
            ajax(opts) {
                var self = this;
                var jopts = $.extend(true, { cache: false }, opts);
                if (!opts.method) jopts.method = 'POST';
                if (!opts.dataType) jopts.dataType = 'json';
                if (opts.global === undefined) jopts.global = toBool(opts.global);

                // HTTP 5** error handler
                jopts.error = function (xhr, status, error) {
                    if (!opts.silent)
                        displayNotification(error, 'error');
                };

                jopts.success = function (result) {
                    var isHardError = !toBool(result.success, true) && result.exceptionType;

                    if (!isHardError) {
                        // conceptual success handler
                        if (_.isFunction(opts.success))
                            opts.success.apply(self, [result]);
                    }
                    else {
                        // conceptual error handler
                        if (_.isFunction(opts.error)) {
                            opts.error.apply(self, [result]);
                        }
                        else {
                            if (result.message && !opts.silent) {
                                displayNotification(result.message, 'error');
                            }
                        }
                    }
                };

                return $.ajax(jopts);
            },

            // UI
            // ======================================================
            showMenu(context, x, y) {
                var offset = $(this.$el).offset();
                var m = this.menu;
                m.context = context;
                m.type = context.mime ? 'file' : 'folder';
                
                _.delay(function () {
                    // Adjust dropdown position so that it fits into the visible screen area
                    var menu = $('.m-contextmenu');
                    var menuEnd = y + menu.outerHeight();
                    var winHeight = $(window).height();

                    if (menuEnd > winHeight - 20) {
                        y -= menuEnd - winHeight + 10;
                    }

                    m.x = x - offset.left;
                    m.y = y - offset.top;

                    m.show = true;
                }, 25);
            },
            onMenuClick(e) {
                var el = $(e.target);
                if (!el.is('.dropdown-menu') && !el.closest('.dropdown-item').is('.disabled')) {
                    this.closeMenu();
                }
            },
            closeMenu() {
                var m = this.menu;
                m.context = null;
                m.type = null;
                m.show = false;
            },

            // File selection
            // ======================================================
            isFileSelected(file) {
                return this.selectedFiles.indexOf(file) > -1;
            },
            isFolderParentOf(parent, child) {
                return _.str.startsWith(child.path, parent.path + '/');
            },
            _validateSelection() {
                if (this.selectedFiles.length >= 500) {
                    displayNotification(this.T.concurrentSelectionError, 'info');
                    return false;
                }

                return true;
            },
            selectFile(file, unselect) {
                var i = this.selectedFiles.indexOf(file);

                if (!this.multiSelect && (unselect ? i === -1 : i > -1))
                    return;

                if (i > -1) {
                    this.selectedFiles.splice(i, 1);
                }
                else {
                    if (this._validateSelection()) {
                        this.selectedFiles.push(file);
                    }
                }
            },
            selectFileRange(fromIndex, toIndex) {
                if (fromIndex > toIndex) {
                    // Swap numbers
                    toIndex = [fromIndex, fromIndex = toIndex][0];
                }

                var files = this.files.data;

                if (fromIndex < files.length && toIndex < files.length) {
                    this.unselectAllFiles();

                    if (!this.multiSelect) {
                        this.selectFile(files[toIndex]);
                    }
                    else {
                        for (var i = fromIndex; i <= toIndex; i++) {
                            if (!this._validateSelection()) break;
                            this.selectedFiles.push(files[i]);
                        }
                    }
                }
            },
            invertFileSelection: function () {
                var self = this;
                this.selectedFiles = _.reject(this.files.data, function (f) { return self.isFileSelected(f); });
            },
            selectAllFiles() {
                //this.selectedFiles = _.without(this.files.data, []);
                this.selectFileRange(0, this.files.data.length - 1);
            },
            unselectAllFiles() {
                this.selectedFiles = [];
            },
            close() {
                var parentWin = window.opener || window.parent;
                if (!this.popup || !this.pickMode || !parentWin)
                    return;

                var self = this;
                var initAlbum = this._getAlbumName(this.initialPath);

                var resolveOutsiders = function () {
                    // Gets selected files that are NOT in the same album as 'initialPath'
                    var arr = [];
                    self.selectedFiles.forEach(function (f) {
                        if (initAlbum !== self._getAlbumName(f.path)) {
                            f.outsider = true;
                            arr.push(f);
                        }
                    });
                    return arr;
                };

                var doClose = function () {
                    if (resultFiles.length > 0) {
                        window.postMessage(resultFiles, window.location.origin);
                    }

                    parentWin.closePopup();
                };

                var outsideFiles = resolveOutsiders();
                var resultFiles = [];

                if (outsideFiles.length === 0) {
                    resultFiles = this.selectedFiles;
                    doClose();
                }
                else {
                    var initAlbumDisplayName = self.findFolder(initAlbum).name;
                    var msg = outsideFiles.length === 1
                        ? self.T.mustCopyFileToAlbum.format('<b class="fwm">' + outsideFiles[0].name + '</b>', '<b class="fwm">' + initAlbumDisplayName + '</b>')
                        : self.T.mustCopyFilesToAlbum.format(outsideFiles.length, '<b class="fwm">' + initAlbumDisplayName + '</b>');

                    // We must copy all files that are not in the initial album to initial album first.
                    confirm2({
                        message: msg,
                        icon: { type: 'question' },
                        callback: function (accepted) {
                            if (!accepted)
                                return;

                            // First collect all selected files that didn't need to be copied over...
                            resultFiles = _.reject(self.selectedFiles, function (f) { return f.outsider });

                            var fileDestinations = _.map(outsideFiles, function (f) { return { file: f, destPath: self.initialPath } });
                            self.copyFiles(fileDestinations, DUPE_ENTRY_RENAME, true, function (result) {
                                for (file of _.values(result.data)) {
                                    // ...then add all copied files to result
                                    resultFiles.push(file);
                                }

                                doClose();
                            });
                        }
                    });
                }
            },

            // Utils
            // ======================================================
            findFolder(idOrPath, node) {
                if (!idOrPath)
                    return null;

                function find(arr) {
                    if (_.isArray(arr)) {
                        for (var i = 0; i < arr.length; i++) {
                            if (idOrPath === arr[i].id || idOrPath === arr[i].path) {
                                return arr[i];
                            }

                            var folder = find(arr[i].children);
                            if (folder) {
                                return folder;
                            }
                        }
                    }

                    return null;
                }

                return find(node ? node.children : this.folders);
            },
            formatFileSize(s) {
                return _.formatFileSize(s);
            },
            formatFileDimensions(d) {
                var result = "";

                if (d) {
                    var arr = d.split(',');
                    if (arr.length === 2) {
                        var w = parseInt(arr[0].trim());
                        var h = parseInt(arr[1].trim());
                        if (w > 0 && h > 0) {
                            return w + " x " + h;
                        }
                    }
                }

                return result;
            },
            formatFileDate(d) {
                return moment.utc(d).local().format('L LT');
            },
            _getAlbumName(path) {
                var i = path.indexOf('/');
                return i > -1 ? path.substring(0, i) : path;
            },

            // Loaders
            // ======================================================
            refreshFileCounts() {
                this.ajax({
                    url: $('#url_counts').val(),
                    data: { query: this.query },
                    success: function (counts) {
                        var refresh = function (folders) {
                            for (var i = 0; i < folders.length; i++) {
                                var folder = folders[i];
                                folder.numFiles = folder.isSpecial
                                    ? counts[folder.path.substring(1)] // strip first '?'
                                    : counts.folders[folder.id.toString()];

                                if (folder.children && folder.children.length) {
                                    refresh(folder.children);
                                }
                            }
                        }

                        refresh(this.folders);
                    }
                });
            },
            loadFolders() {
                var self = this;
                this.ajax({
                    url: $('#url_folders').val(),
                    data: { query: this.query },
                    success: function (rootNode) {
                        self.folders = [];
                        rootNode.children.forEach(function (folder) {
                            self.folders.push(folder);
                        });

                        var path = _.isEmpty(this.selectedFolder) ? this.initialPath : this.selectedFolder.path;
                        this.selectedFolder = this.findFolder(path, rootNode) || _.find(this.folders, function (f) { return f.id > 0; });
                    }
                });
            },
            debouncedLoadFiles: _.debounce(function () {
                this.loadFiles();
            }, 400, false),
            loadFiles(folderId, query, complete) {
                var self = this;
                var q = query || this.query;
                var f = this.files;

                if (f.isLoading)
                    return;

                f.isLoading = true;

                if (!_.isNumber(folderId)) {
                    folderId = this.selectedFolder.id;
                }

                this.ajax({
                    url: $('#url_files').val(),
                    data: { folderId: folderId, query: q },
                    global: false,
                    complete: function () {
                        self.emit('filesLoaded', !f.appendMode);

                        q.refreshFileCounts = false;
                        q.complete();
                        f.appendMode = false;
                        f.isLoading = false;

                        if (_.isFunction(complete)) {
                            complete.apply(self, [f]);
                        }
                    },
                    success: function (result) {
                        f.totalCount = result.totalCount;
                        f.pageIndex = result.pageIndex;
                        f.hasNextPage = result.hasNextPage;

                        if (!f.appendMode) {
                            this.selectedFiles = [];
                            f.data = result.data;
                        }
                        else {
                            for (var i = 0; i < result.data.length; i++) {
                                f.data.push(result.data[i]);
                            }
                        }

                        if (q.refreshFileCounts) {
                            this.refreshFileCounts();
                        }
                    }
                });
            },

            // Clipboard
            // ======================================================
            setClipboardData(op, type, data) {
                data = data || (type === 'file' ? this.selectedFiles : this.selectedFolder)
                if (type === 'folder' && (data.isSpecial || data.isAlbum))
                    return;

                var cb = this.clipboard;
                cb.op = op;
                cb.type = type;
                cb.data = data;
            },
            onPaste(e, destFolder) {
                var cb = this.clipboard;

                if (!cb.isValid)
                    return;

                var isCopy = cb.op === 'copy';
                var isFolder = cb.type === 'folder';

                if (!destFolder && this.menu.type === 'folder' && this.menu.context) {
                    destFolder = this.menu.context;
                }

                destFolder = destFolder || this.selectedFolder;
                var source = cb.data;

                // Reset after done
                cb.op = '';
                cb.type = '';
                cb.data = null;

                this.closeMenu();

                if (isFolder) {
                    return isCopy ? this.copyFolder(source, destFolder) : this.moveFolder(source, destFolder);
                }
                else {
                    var fileDestinations = _.map(source, function (f) { return { file: f, destPath: destFolder.path } });
                    return isCopy ? this.copyFiles(fileDestinations) : this.moveFiles(fileDestinations);
                }
            },

            // File operations
            // ======================================================
            renameFile(file, name) {
                this.ajax({
                    url: $('#url_rename_file').val(),
                    data: { id: file.id, newName: name },
                    success: function (result) {
                        file.name = name;
                        file.path = result.path;
                    }
                });
            },
            copyFiles(fileDestinations, dupeHandling, silent, callback) {
                var self = this;
                var size = 0;
                _.each(fileDestinations, function (d) { size += d.file.size });

                return this.ajax({
                    url: $('#url_copy_files').val(),
                    silent: silent,
                    global: size > 5000000, // Show ajax busy if operation takes longer (size sum > ~ 5MB)
                    data: {
                        files: _.map(fileDestinations, function (d) { return { fileId: d.file.id, destPath: d.destPath } }),
                        dupeHandling: toInt(dupeHandling, DUPE_ENTRY_THROW)
                    },
                    success: function (result) {
                        if (this.validateFileOperationResult(result)) {
                            var onFinalize = function () {
                                if (_.isFunction(callback)) {
                                    callback.apply(this, [result]);
                                }

                                if (!silent) {
                                    self.emit('save', 'copyFiles', result.data);

                                    var numFiles = _.keys(result.data).length;
                                    if (numFiles) {
                                        var msg = numFiles === 1
                                            ? self.T.fileCopied.format('<b class="fwm">' + fileDestinations[0].file.name + '</b>', '<b class="fwm">' + fileDestinations[0].destPath + '</b>')
                                            : self.T.filesCopied.format(numFiles, '<b class="fwm">' + fileDestinations[0].destPath + '</b>');
                                        // Show notification only if at least one file has been copied
                                        displayNotification(msg, 'success');
                                    }
                                }
                            };

                            if (result.dupes && result.dupes.length) {
                                // 2nd pass: let an external module handle duplicate files and recall once resolution is finished.
                                this.emit('dupesDetected', 'copyFiles', result, onFinalize);
                            }
                            else {
                                onFinalize();
                            }
                        }
                    }
                });
            },
            moveFiles(fileDestinations, dupeHandling) {
                var self = this;
                return this.ajax({
                    url: $('#url_move_files').val(),
                    global: fileDestinations && fileDestinations.length > 50,
                    data: {
                        files: _.map(fileDestinations, function (d) { return { fileId: d.file.id, destPath: d.destPath } }),
                        dupeHandling: toInt(dupeHandling, DUPE_ENTRY_THROW)
                    },
                    success: function (result) {
                        if (this.validateFileOperationResult(result)) {
                            var onFinalize = function () {
                                self.emit('save', 'moveFiles', result.data);

                                var numFiles = fileDestinations.length;
                                if (numFiles) {
                                    var msg = numFiles === 1
                                        ? self.T.fileMoved.format('<b class="fwm">' + fileDestinations[0].file.name + '</b>', '<b class="fwm">' + fileDestinations[0].destPath + '</b>')
                                        : self.T.filesMoved.format(numFiles, '<b class="fwm">' + fileDestinations[0].destPath + '</b>');
                                    // Show notification only if at least one file has been moved
                                    displayNotification(msg, 'success');
                                }
                            };

                            if (result.dupes && result.dupes.length) {
                                // 2nd pass: let an external module handle duplicate files and recall once resolution is finished.
                                this.emit('dupesDetected', 'moveFiles', result, onFinalize);
                            }
                            else {
                                onFinalize();
                            }
                        }
                    }
                });
            },
            deleteFiles(files, permanent) {
                var self = this;

                return this.ajax({
                    url: $('#url_delete_files').val(),
                    data: {
                        ids: _.map(files, function (val) { return val.id; }),
                        permanent: permanent
                    },
                    success: function (result) {
                        if (self.validateFileOperationResult(result)) {
                            self.emit('save', 'deleteFiles', result.data);

                            var numFiles = _.keys(result.data).length;
                            if (numFiles) {
                                var msg;
                                if (numFiles === 1)
                                    msg = self.T[permanent ? "fileDeleted" : "fileTrashed"].format('<b class="fwm">' + files[0].name + '</b>');
                                else
                                    msg = self.T[permanent ? "filesDeleted" : "filesTrashed"].format(numFiles);

                                // Show notification only if at least one file has been deleted
                                displayNotification(msg, 'success');
                            }
                        }
                    }
                });
            },
            restoreFiles(files) {
                var self = this;
                this.ajax({
                    url: $('#url_restore_files').val(),
                    data: {
                        ids: _.map(files, function (val) { return val.id; })
                    },
                    success: function (result) {
                        if (self.validateFileOperationResult(result)) {
                            self.emit('save', 'restoreFiles', result.data);

                            var numRestored = result.data.filesRestored.length;
                            if (numRestored) {
                                var msg = numRestored === 1
                                    ? self.T.fileRestored.format('<b class="fwm">' + result.data.filesRestored[0] + '</b>')
                                    : self.T.filesRestored.format(numRestored);
                            }

                            var numSkipped = result.data.filesSkipped.length;
                            if (numSkipped) {
                                var skipped = numSkipped === 1
                                    ? self.T.restoreFileError.format('<b class="fwm">' + result.data.filesSkipped[0] + '</b>')
                                    : self.T.restoreFilesError.format(numRestored);
                                msg = _.str.grow(msg, skipped, ' ');
                            }

                            if (msg) {
                                displayNotification(msg, numSkipped ? 'warning' : 'success');
                            }
                        }
                    }
                });
            },
            validateFileOperationResult(result) {
                var hasErrors = !_.isEmpty(result.errors);
                if (hasErrors) {
                    var errors = _.toArray(result.errors);
                    for (var i = 0; i < errors.length; i++) {
                        if (i < 3) {
                            displayNotification(errors[i].message, 'error');
                        }
                        else {
                            var numRemaining = errors.length - 3;
                            var msg = this.T[numRemaining === 1 ? 'errorHidden' : 'errorsHidden'].format(numRemaining);
                            displayNotification(msg, 'error');
                            break;
                        }
                    }
                }

                // Return true if at least one file operation succeeded or dupe files were detected
                return !hasErrors || !_.isEmpty(result.data) || (result.dupes && result.dupes.length);
            },

            // Folder operations
            // ======================================================
            createFolder(destFolder, name) {
                if (!destFolder || destFolder.isSpecial)
                    return;

                this.ajax({
                    url: $('#url_create_folder').val(),
                    data: { path: destFolder.path, name: name },
                    success: function (result) {
                        var newFolder = _.toArray(result.data)[0];
                        if (newFolder) {
                            this.selectedFolder = {};
                            this.initialPath = newFolder.path;
                            this.loadFolders();
                        }
                    }
                });
            },
            copyFolder(folder, destFolder) {
                var self = this;
                this.ajax({
                    url: $('#url_copy_folder').val(),
                    data: {
                        path: folder.path,
                        destPath: destFolder.path,
                        dupeEntryHandling: DUPE_ENTRY_SKIP
                    },
                    global: true,
                    success: function (result) {
                        var copy = _.toArray(result.data)[0];
                        if (copy) {
                            var onFinalize = function () {
                                self._refreshAfterFolderOperation(folder);
                                displayNotification(self.T.folderCopied.format('<b class="fwm">' + folder.path + '</b>', '<b class="fwm">' + destFolder.path + '</b>'), 'success');
                            };

                            if (result.dupes && result.dupes.length) {
                                // 2nd pass: let an external module handle duplicate files and recall once resolution is finished.
                                this.emit('dupesDetected', 'copyFolder', result, onFinalize);
                            }
                            else {
                                onFinalize();
                            }
                        }
                    }
                });
            },
            moveFolder(folder, destFolder) {
                var self = this;
                this.ajax({
                    url: $('#url_move_folder').val(),
                    data: { path: folder.path, destPath: destFolder.path + '/' + folder.name },
                    success: function (result) {
                        var moved = _.toArray(result.data)[0];
                        if (moved) {
                            self._refreshAfterFolderOperation(folder);
                            displayNotification(self.T.folderMoved.format('<b class="fwm">' + folder.path + '</b>', '<b class="fwm">' + destFolder.path + '</b>'), 'success');
                        }
                    }
                });
            },
            _refreshAfterFolderOperation(affectedFolder) {
                var selFolder = this.selectedFolder;
                if (affectedFolder === selFolder || this.isFolderParentOf(affectedFolder, selFolder)) {
                    var parent = this.findFolder(affectedFolder.parentId);
                    this.initialPath = parent.path;
                }
                else {
                    this.initialPath = selFolder.path;
                }

                this.selectedFolder = {};
                this.loadFolders();
            },
            renameFolder(folder, name) {
                this.ajax({
                    url: $('#url_rename_folder').val(),
                    data: { path: folder.path, newName: name },
                    success: function (result) {
                        folder.name = name;
                        folder.path = result.path;

                        // Resort
                        var parent = this.findFolder(folder.parentId);
                        var arr = _.toArray(parent.children);
                        parent.children = _.sortBy(arr, 'name');
                    }
                });
            },
            deleteFolder(folder, fileHandling) {
                var self = this;

                fileHandling = toInt(fileHandling, FILE_HANDLING_DELETE);

                this.ajax({
                    url: $('#url_delete_folder').val(),
                    data: {
                        path: folder.path,
                        fileHandling: fileHandling // TODO: (mm) Ask user?
                    },
                    global: true,
                    success: function (result) {
                        var deletedFolderIds = result.data.deletedFolderIds;

                        if (folder === self.selectedFolder || self.isFolderParentOf(folder, self.selectedFolder) || self.isFolderParentOf(self.selectedFolder, folder)) {
                            // Select parent of deleted folder after tree refresh
                            var initFolder = folder;
                            while (deletedFolderIds.indexOf(initFolder.id) > -1) {
                                initFolder = self.findFolder(folder.parentId);
                            }
                            self.initialPath = initFolder.path;
                        }
                        else {
                            // Reselect currently selected folder after tree refresh
                            self.initialPath = self.selectedFolder.path;
                        }

                        var deleted = result.data.deletedFileNames;
                        var inUse = result.data.trackedFileNames.concat(result.data.lockedFileNames);

                        var msg = "";
                        if (deleted.length || deletedFolderIds.length) {
                            if (deletedFolderIds.length === 1) {
                                // 1 folder, 1 to n files
                                msg = deleted.length === 1
                                    ? self.T.folderWithFileDeleted.format('<b class="fwm">' + folder.name + '</b>', '<b class="fwm">' + deleted[0] + '</b>')
                                    : self.T.folderWithFilesDeleted.format('<b class="fwm">' + folder.name + '</b>', deleted.length)
                            }
                            else {
                                // n folder, 1 to n files
                                msg = deleted.length === 1
                                    ? self.T.foldersWithFileDeleted.format(deletedFolderIds.length, '<b class="fwm">' + deleted[0] + '</b>')
                                    : self.T.foldersWithFilesDeleted.format(deletedFolderIds.length, deleted.length);                            
                            }
                        }

                        if (inUse.length) {
                            var used = inUse.length === 1
                                ? self.T.fileInUse.format('<b class="fwm">' + inUse[0] + '<b>')
                                : self.T.filesInUse.format(inUse.length);
                            msg = _.str.grow(msg, used, ' ');
                        }

                        if (msg) {
                            displayNotification(msg, inUse.length ? 'warning' : 'success');
                        }
                    },
                    complete: function () {
                        // Always refresh on complete, 'cause folders/files could have been deleted before the first exception was thrown.
                        self.selectedFolder = {};
                        self.loadFolders();
                    }
                });
            },
            detectTracks(albumName) {
                this.ajax({
                    url: $('#url_detect_tracks').val(),
                    global: true,
                    data: { album: albumName },
                    success: function () {
                        displayNotification(this.T.detectTracksComplete, 'success');
                        this.refreshFileCounts();
                    }
                });
            },

            // Download
            // ======================================================
            downloadFolder(folder) {
                var url = $('#url_download_folder').val() + '?id={0}&path={1}'.format(folder.id, folder.path);
                this._download(url);
            },
            downloadFiles(files) {
                var ids = _.map(files, function (f) { return 'ids=' + f.id }).join('&');
                var url = $('#url_download_files').val() + '?' + ids;
                this._download(url);
            },
            _download(url) {
                var xhr = new XMLHttpRequest();

                xhr.onloadstart = function () {
                    $('#ajax-busy').addClass("busy");
                };
                xhr.onloadend = function () {
                    $('#ajax-busy').removeClass("busy");
                };

                xhr.onreadystatechange = function () {
                    if (this.readyState === 4) {
                        if (this.status === 200) {
                            var blob = xhr.response;
                            var fileName = xhr.getResponseHeader("file-name");
                            var link = document.createElement('a');
                            link.href = window.URL.createObjectURL(blob);
                            link.download = fileName;
                            link.click();
                        }
                        else {
                            displayNotification(xhr.statusText, 'error');
                        }
                    }
                };

                xhr.responseType = "blob";
                xhr.open("GET", url, true);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.send();
            }
        },
        watch: {
            selectedFolder(val) {
                if (!_.isEmpty(val)) {
                    this.emit('selectedFolderChanged', val);
                    if (val.id !== this._selectedFolderId) {
                        // Load files list only when folder id has changed.
                        this._selectedFolderId = val.id;
                        this.loadFiles();
                    }
                }
            },
            query: {
                handler: function () {
                    if (!_.isEmpty(this.selectedFolder) && !this.files.isLoading)
                        this.debouncedLoadFiles();
                },
                deep: true
            },
            userPrefs: function (value) {
                localStorage.setItem('mm:userPrefs', JSON.stringify(value));
            }
        }
    });
}