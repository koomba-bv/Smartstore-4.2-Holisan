Vue.component("m-viewer", {
    template: `
        <div class="m-pane-content">
            <div class="m-pane-header m-toolbar">
                <div v-if="!isEdit">
                    <button class="btn btn-primary btn-flat" v-on:click.stop="toggleEdit(true)" :style="{ 'visibility': currentFile === null ? 'hidden' : 'visible' }">
                        <span v-if="selectedFiles.length <= 1">{{ T.edit }}</span>
                        <span v-if="selectedFiles.length > 1">{{ T.batchEdit }}</span>
                    </button>
                </div>
                <div v-else-if="currentFile != null && isEdit" class="row w-100 xs-gutters">
                    <div class="col-6">
                        <button class="btn btn-light btn-flat btn-block" v-on:click.stop="toggleEdit(false)">{{ T.cancel }}</button>
                    </div>
                    <div class="col-6">
                        <button class="btn btn-warning btn-block" v-on:click.stop="save" :class="{ 'disabled btn-flat': !canSave }" :disabled="!canSave">{{ T.save }}</button>
                    </div>
                </div>
            </div>
            <div class="m-pane-body m-viewer custom-scrollbar">
                <div v-show="currentFile === null" class="text-muted">
                    {{ T.noFileSelected }}
                </div>
                <div v-if="currentFile != null && !isEdit">
                    <div class="mb-3 d-flex align-items-center justify-content-center m-preview-container">
                        <div v-if="hasPreview" class="w-100" :class="{ 'embed-responsive embed-responsive-16by9': !isAudio }">
                            <img v-if="isImage" :src="currentFile.url" :alt="currentFile.alt" :title="currentFile.title" class="embed-responsive-item m-preview" />
                            <video v-else-if="isVideo" :src="currentFile.url" class="embed-responsive-item m-preview" controls preload="metadata" />
                            <audio v-else-if="isAudio" :src="currentFile.url" controls preload="metadata" class="m-preview" />
                        </div>
                    </div>
                    <div class="mb-2">
                        <div class="font-weight-medium">{{ T.fileName }}</div>
                        <div class="text-truncate" :title="currentFile.name">{{ currentFile.name }}</div>
                    </div>
                    <div class="mb-2" v-if="currentFile.alt">
                        <div class="font-weight-medium">{{ T.alt }}</div>
                        <div class="text-truncate" :title="currentFile.alt">{{ currentFile.alt }}</div>
                    </div>
                    <div class="mb-2">
                        <div class="font-weight-medium">{{ T.fileSize }}</div>
                        <div class="text-truncate">{{ $root.formatFileSize(currentFile.size) }}</div>
                    </div>
                    <div class="mb-2" v-if="currentFile.type === 'image'">
                        <div class="font-weight-medium">{{ T.fileDimensions }}</div>
                        <div class="text-truncate">{{ $root.formatFileDimensions(currentFile.dimensions) }}</div>
                    </div>
                    <div class="mb-2">
                        <div class="font-weight-medium">{{ T.fileDate }}</div>
                        <div class="text-truncate">{{ $root.formatFileDate(currentFile.lastUpdated) }}</div>
                    </div>
                    <div class="mb-2">
                        <div class="font-weight-medium">{{ T.fileUrl }}</div>
                        <div class="text-truncate" :title="currentFile.url">
                            <a :href="currentFile.url" target="mm_fileviewer">{{ currentFile.path }}</a>
                        </div>
                    </div>
                    <div v-if="$root.selectedFolder.canDetectTracks">
                        <div class="font-weight-medium">{{ T.tracks }}</div>
                        <div><a href="javascript:void(0)" v-show="tracks.fileId == 0" v-on:click.stop="loadTracks">{{ T.show }}</a></div>
                        <div v-show="tracks.fileId != 0">
                            <div v-show="tracks.tracks.length == 0" class="muted">{{ T.noTracksFound }}</div>
                            <div v-show="tracks.tracks.length > 0" class="table-responsive">
                                <table class="m-tracks-table table table-bordered table-sm bg-white shadow-sm mt-2">
                                    <thead>
	                                    <tr>
		                                    <th class="text-center">{{ T.entityId }}</th>
		                                    <th>{{ T.entity }}</th>
	                                    </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="track in tracks.tracks">
                                            <td class="text-center">{{ track.entityId }}</td>
                                            <td :title="track.localizedName">
                                                <span v-if="_.isEmpty(track.url)">{{ track.localizedName }}</span>
                                                <a v-if="!_.isEmpty(track.url)" :href="track.url" target="_blank">{{ track.localizedName }}</a>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                <m-editor ref="editor"
                    v-if="currentFile != null && isEdit" 
                    v-on:inputChanged="onInputChanged($event)"
                    :selected-files="selectedFiles"
                    :languages-count="languagesCount"></m-editor>
            </div>
        </div>
    `,
    props: {
        files: Object,
        selectedFiles: Array,
        languagesCount: Number
    },
    created: function () {
        this.T = window.Res.Media;
    },
    mounted: function () {
    },
    data: function () {
        return {
            isEdit: false,
            isDirty: false,
            isSaving: false,
            tracks: {
                fileId: 0,
                tracks: []
            },
        }
    },
    computed: {
        currentFile() {
            return this.selectedFiles.length ? this.selectedFiles[0] : null;
        },
        canSave() {
            return this.isDirty || this.selectedFiles.length > 1;
        },
        isImage() {
            return this.currentFile.type === 'image';
        },
        isVideo() {
            return this.currentFile.type === 'video';
        },
        isAudio() {
            return this.currentFile.type === 'audio';
        },
        hasPreview() {
            return this.isImage || this.isVideo || this.isAudio;
        },
    },
    watch: {
        selectedFiles() {
            if (this.isEdit) {
                var selectedFileChanged = !this.currentFile;

                if (!selectedFileChanged) {
                    var fileIds = this.$refs.editor.file.ids;
                    selectedFileChanged = fileIds.length !== this.selectedFiles.length || (fileIds.length === 1 && fileIds[0] !== this.currentFile.id);
                }

                if (selectedFileChanged) {
                    this.confirmAndSave();

                    // Get out of edit mode. Avoid triggering AJAX loading of editing data.
                    this.toggleEdit(false);
                }
            }
            else {
                this.tracks = this.currentFile && this.currentFile.tracks
                    ? this.currentFile.tracks
                    : { fileId: 0, tracks: [] };
            }
        }
    },
    methods: {
        toggleEdit(isEdit) {
            this.isEdit = isEdit;
            this.isDirty = false;
        },
        onInputChanged() {
            this.isDirty = true;
        },
        confirmAndSave() {
            if (this.isDirty) {
                if (confirm(this.T.confirmAndSave)) {
                    this.save();
                }
                else {
                    // Not confirmed -> throw away changes.
                    this.isDirty = false;
                }
            }
        },
        save() {
            if (!this.isSaving) {
                var self = this;
                this.isSaving = true;
                var editFile = this.$refs.editor.file;

                this.$root.ajax({
                    url: $('#url_save_file').val(),
                    data: editFile,
                    success: function (result) {
                        self.isDirty = false;
                        if (self.currentFile) {
                            self.currentFile.alt = editFile.alt;
                        }
                        if (result.message) {
                            displayNotification(result.message, 'success');
                        }
                    },
                    complete: function () {
                        self.isSaving = false;
                    },
                });
            }
        },
        loadTracks() {
            if (this.currentFile && this.currentFile.tracks) {
                this.tracks = this.currentFile.tracks;
            }
            else {
                var self = this;

                this.$root.ajax({
                    url: $('#url_tracks').val(),
                    data: { id: self.currentFile.id },
                    success: function (result) {
                        self.tracks = result.data;

                        if (self.currentFile) {
                            self.currentFile.tracks = result.data;
                        }
                    }
                });
            }
        }
    },
});