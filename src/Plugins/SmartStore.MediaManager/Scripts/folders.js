Vue.component("m-folders", {
    template: `
        <div class="m-pane-content">
            <div class="m-pane-header m-toolbar">
					<button :disabled="!canAdd" type="button" class="btn btn-light" :title="T.createFolder" v-on:click="$root.emit('createFolder', selectedFolder)">
						<i class="fa fa-plus"></i>
						<span>{{ T.createNew }}</span>
					</button>
                    <div class="m-tool-group ml-auto">
					    <button type="button" class="btn btn-light btn-icon" :title="T.refresh" v-on:click="$root.loadFolders()">
						    <i class="fa fa-sync"></i>
					    </button>
                    </div>
					<button :disabled="!canRename" type="button" class="btn btn-light btn-icon" :title="T.renameFolder" v-on:click="$root.emit('renameFolder', selectedFolder)">
						<i class="fa fa-pencil-alt"></i>
					</button>
					<button :disabled="!canDelete" type="button" class="btn btn-light btn-to-danger btn-icon" :title="T.deleteFolder" v-on:click="$root.emit('deleteFolder', selectedFolder)">
						<i class="far fa-trash-alt"></i>
					</button>
            </div>
            <div class="m-pane-body px-0 m-folders custom-scrollbar custom-scrollbar-overlay" v-on:dragover="onDragOver">
                <div class="m-node-group" tabindex="0"
                    v-on:keydown.exact.ctrl.x.prevent.stop="$root.setClipboardData('cut', 'folder')"
                    v-on:keydown.exact.ctrl.c.prevent.stop="$root.setClipboardData('copy', 'folder')"
                    v-on:keydown.exact.ctrl.v.prevent.stop="$root.onPaste"
                    v-on:keydown.exact.delete.prevent.stop="$root.emit('deleteFolder')">
                    <m-folder v-for="folder in folders" :model="folder" :parent="null" :key="folder.id"></m-folder>
                </div>
            </div>
        </div>
    `,
    props: {
        folders: Array,
        selectedFolder: Object
    },
    created() {
        var self = this;

        // Localization
        this.T = window.Res.Media;

        bus.$on('createFolder', function (destFolder) {
            if (destFolder && !destFolder.isSpecial) {
                prompt2({
                    message: self.T.createFolderDialog.format('<b class="fwm">' + destFolder.path + '</b>'),
                    prompt: { invalidChars: INVALID_PATH_CHARS },
                    callback: function (name) {
                        if (name) {
                            self.$root.createFolder(destFolder, name);
                        }
                    }
                });   
            } 
        });

        bus.$on('renameFolder', function (folder) {
            if (!folder.isAlbum && !folder.isSpecial) {
                prompt2({
                    title: self.T.renameFolder,
                    prompt: { value: folder.name, invalidChars: INVALID_PATH_CHARS },
                    callback: function (name) {
                        if (name) {
                            self.$root.renameFolder(folder, name);
                        }       
                    }
                });
            }
        });

        bus.$on('deleteFolder', function (folder) {
            folder = folder || self.$root.selectedFolder;
            if (folder && !folder.isSpecial && !folder.isAlbum) {
                confirm2({
                    message: $('#deleteFolderPrompt').html().format('<b class="fwm">' + folder.name + '</b>'), // self.T.deleteFolderDialog.format("<b class=\"fwm\">" + folder.name + "</b>"),
                    icon: { type: 'delete' },
                    centerContent: false,
                    callback: function (accepted) {
                        if (accepted) {
                            fileHandling = parseInt($(this).find("input:radio[name='filehandling']:checked").val());
                            self.$root.deleteFolder(folder, fileHandling);
                        }    
                    }
                });
            }
        });

        bus.$on('detectTracks', function (folder) {
            confirm2({
                message: self.T.detectTracksInfo.format('<b class="fwm">' + folder.name + '</b>'),
                centerContent: false,
                icon: { type: 'warning', name: 'fa fa-link' },
                callback: function (accepted) {
                    if (accepted) {
                        self.$root.detectTracks(folder.path);
                    }  
                }
            });
        });
    },
    computed: {
        canAdd() {
            return !this.selectedFolder.isSpecial;
        },
        canRename() {
            return !this.selectedFolder.isSpecial && !this.selectedFolder.isAlbum;
        },
        canDelete() {
            return !this.selectedFolder.isSpecial && !this.selectedFolder.isAlbum;
        }
    },
    methods: {
        onDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'none';
        }
    }
});

Vue.component("m-folder", {
    template: `
        <div class="m-node" :data-depth="model.depth" 
            v-show="!model.isSpecial || model.numFiles > 0 || model.path == '?trash' || model.path == '?total'"
            :style="{ '--depth': model.depth }" 
            :class="{ selected: isSelected, expanded: isExpanded, 'mt-3': model.beginGroup }" v-on:click.stop="select">
            <div class="m-node-entry" 
                :draggable="model.depth > 1" 
                :class="{ 'indeterm': isIndeterm,  'dragging': isDragging }"
                :data-id="model.id"
                v-on:contextmenu.prevent="onContextMenu"
                v-on:dragstart="onDragStart"
                v-on:dragenter.stop="onDragEnter"
                v-on:dragover.stop="onDragOver"
                v-on:dragleave.stop="onDragLeave"
                v-on:dragend="onDragEnd"
                v-on:drop="onDrop">
                <span v-if="hasChildren" class="m-node-expander" v-on:click.stop="toggle">
                    <i class="fa fa-chevron-right"></i>
                </span>
                <span v-else class="m-node-placeholder"></span>
                <span class="fa-group" :style="{ 'opacity': isCut ? '0.5' : null }">
                    <i class="m-node-icon fa-fw" 
                        :style="{ color: model.color }" 
                        :class="[model.overlayIcon ? 'far' : 'fa', model.icon || ('fa-folder' + (isExpanded ? '-open' : ''))]"></i>
                    <i v-if="model.overlayIcon" class="fa-overlay" :class="model.overlayIcon" :style="{ color: model.overlayColor }"></i>
                </span>
                <span class="m-node-label text-truncate" :title="model.desc">{{ model.name }}</span>
                <span class="m-node-count" v-if="model.numFiles > 0">{{ model.numFiles.toLocaleString() }}</span>
            </div>
            <div class="m-node-group" v-if="model.children && model.children.length">
                <m-folder v-for="folder in model.children" :model="folder" :parent="model" :key="folder.id"></m-folder>
            </div>
        </div>
    `,
    props: {
        model: Object,
        parent: Object
    },
    data: function () {
        return {
            isExpanded: false,
            isDragging: false,
            isDragOver: false
        }
    },
    created() {
        var self = this;
        bus.$on('selectedFolderChanged', function (folder) {
            self.expandIfParentOf(folder);
        });
    },
    mounted() {
        this.expandIfParentOf(this.$root.selectedFolder);
    },
    computed: {
        isCut() {
            var cb = this.$root.clipboard;
            return cb.op === 'cut' && cb.type === 'folder' && cb.data === this.model;
        },
        isIndeterm() {
            return this.isDragOver || this.model === this.$root.menu.context;
        },
        hasChildren() {
            return this.model.children && this.model.children.length > 0;
        },
        isSelected() {
            return this.$root.selectedFolder === this.model;
        }
    },
    methods: {
        expandIfParentOf(folder) {
            if (!_.isEmpty(folder) && !this.isExpanded && this.isParentOf(folder)) {
                this.isExpanded = true;
            }
        },
        isParentOf(folder) {
            //return _.str.startsWith(folder.path, this.model.path + '/');
            return this.$root.isFolderParentOf(this.model, folder);
        },
        toggle() {
            this.isExpanded = !this.isExpanded;
        },
        select() {
            bus.$emit('folderSelected', this.model);
        },
        onContextMenu(e) {  
            this.$root.showMenu(this.model, e.pageX, e.pageY);
        },
        onDragStart(e) {
            this.lastEnter = null;
            this.isDragging = true;
            this.$root.dataTransfer = {
                type: 'folder',
                data: this.model,
                element: e.target
            };
        },
        onDragEnter(e) {
            e.preventDefault();
            this.lastEnter = e.target;
        },
        onDragOver(e) {
            var dt = this.$root.dataTransfer;
            if (!dt) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'none';
                return;
            }     

            var canDrop = !this.model.isSpecial;
            if (canDrop) {
                var isFolder = dt.type === 'folder';
                var isCopy = e.ctrlKey;

                if (isFolder) {
                    var folder = dt.data;
                    // INFO: A folder cannot be MOVED outside album, but can be copied to any other album.
                    // INFO: A folder cannot be moved or copied to itself.
                    canDrop = (isCopy || folder.album === this.model.album) && (folder.path !== this.model.path);
                }
            }

            this.isDragOver = canDrop;

            if (canDrop) {
                e.preventDefault();
                e.dataTransfer.dropEffect = isCopy ? "copy" : "move";
            }
            else {
                e.dataTransfer.dropEffect = 'none';
            }
        },
        onDragLeave(e) {
            this.isDragOver = this.lastEnter !== e.target;
        },
        onDragEnd() {
            this.lastEnter = null;
            this.isDragOver = false;
            this.isDragging = false;
            this.$root.dataTransfer = null;
        },
        onDrop(e) {
            e.preventDefault();

            this.isDragOver = false;
            this.isDragging = false;

            var self = this;
            var root = this.$root;
            var dt = root.dataTransfer;
            if (!dt)
                return;

            var type = dt.type;
            var isCopy = e.ctrlKey;

            if (type === 'folder') {
                root[isCopy ? 'copyFolder' : 'moveFolder'](dt.data, this.model);
            }
            else {
                var fileDestinations = _.map(dt.data, function (f) { return { file: f, destPath: self.model.path } });
                root[isCopy ? 'copyFiles' : 'moveFiles'](fileDestinations);
            }

            this.$root.dataTransfer = null;
        }
    }
});