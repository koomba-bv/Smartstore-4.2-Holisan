Vue.component("m-uploader", {
    template: `
        <div class="m-uploader" v-bind:class="{ 'show': $parent.showUploader }" v-on:dragleave="onDragLeave" ref="m-uploader">
            <div class="dropzone-container" v-on:drop.prevent="onDrop">
                <div class="dropzone-target">
                    <div class="m-uploader-info text-white text-center shadow shadow-indigo p-3">
                        <div class="mb-3"><i class="m-uploader-info-icon fas fa-cloud-upload-alt fa-3x text-white"></i></div>
                        <div class="m-uploader-info-text">{{ T.fuMessage }}</div>
                    </div>
                    <div id="file-uploader" class="fu-fileupload">
                        <input class="file-uploader-form-elem" type="hidden" />
                    </div>
                </div>
                
                <div class="fu-status-window container rounded shadow" :class="{ 'show': this.showStatusWindow, 'collapsed': this.collapsedStatusWindow }"> 
                    <div class="header row align-items-center">
                        <div class="col">
                            <span class="current-file-count"></span>
                            <span class="current-file-text"></span>
                        </div>
                        <div class="col-auto">
                            <a href="#" class="btn btn-outline-primary btn-circle btn-icon btn-sm mr-1" data-collapsed="false" v-on:click="onToggleStatusClick" :title="T.statusWindowCollpase">
                                <i class="fas fa-chevron-down" /> 
                            </a>
                            <a href="#" class="btn btn-outline-primary btn-circle btn-icon btn-sm close-status-window" v-on:click.prevent.stop="displayStatusWindow(false)" :title="T.close">
                                <i class="fas fa-times" /> 
                            </a>
                        </div>
                    </div>
                    <div class="flyout-commands row">
                        <div class="col-12 text-right">
                            <a href="#" class="cancel" :title="T.cancel" v-on:click="cancelUploads">
                                {{ T.cancel }}
                            </a>
                            <a href="#" class="resume d-none" :title="T.resume">
                                {{ T.resume }}
                            </a>
                        </div>
                    </div>
                    <div id="m-preview-container" class="preview-container row custom-scrollbar" data-display-list-items="true">
                    </div>
                </div>

	            <div class="file-preview-template-list d-none">
		            <div class="dz-preview row">
                        <div class="col-1">
	                        <figure class="file-figure">
		                        <i class="file-icon fa-fw show"></i>
	                        </figure>
                        </div>
			            <div class="col-9 dz-details">
				            <div class="dz-filename text-truncate"><span data-dz-name></span></div>
				            <div class="dz-size" data-dz-size></div>
			            </div>
			            <div class="col-2 upload-status text-center">
                            <i class="fas fa-fw fa-check text-success d-none" />
                            <span class="fu-item-canceled d-none" :title="T.resume">
                              <i class="far fa-pause-circle fa-2x"></i>
                            </span>
			            </div>
		            </div>
	            </div>
            </div>
        </div>
    `,
    props: {
        selectedFolder: Object
    },
    created: function () {
        // Localization
        this.T = window.Res.Media;
    },
    mounted() {
        var fileUploader = $(".fu-fileupload");
        var uploadUrl = $('#url_upload').val();
        var dupeHandlerUrl = $('#url_conflict_resolver').val();
        var self = this;

        fileUploader.attr("data-upload-url", uploadUrl);
        fileUploader.attr("data-dialog-url", dupeHandlerUrl);

        fileUploader.dropzoneWrapper({
            maxFiles: 1000,
            timeout: 300000,
            maxFilesSize: self.$root.$el.getAttribute('data-max-filesize'),
            previewContainerId: "m-preview-container",
            clickable: ".open-file-dialog",
            onUploading: onUploadingCallback,
            onCompleted: onCompletedCallback
        });

        // Close status window on dupehandler cancel click.
        $(document).on("click", "#duplicate-window .cancel-upload", function () {
            self.showStatusWindow = false;
            return false;
        });

        function onUploadingCallback() {
            self.showStatusWindow = true;
        }

        function onCompletedCallback(files, dialogClosed) {
            if (dialogClosed && self.showStatusWindow) {
                var objFiles = {};
                _.each(files, (file) => {
                    var item = file.media || file;
                    objFiles[item.id.toString()] = item;

                    $(".m-file[data-id='" + file.media.id + "'] .m-file-img").attr("src", file.media.thumbUrl);
                });

                self.$root.emit('save', 'upload', objFiles);
            }
        }
    },
    data: function () {
        return {
            showStatusWindow: false,
            collapsedStatusWindow: false
        };
    },
    methods: {
        onDragLeave(e) {
            if ($(e.relatedTarget).closest('.m-uploader').length === 0) {
                this.$parent.showUploader = false;
            }
        },
        onDrop(e) {
            var uploadUrl = $('#url_upload').val();
            uploadUrl = modifyUrl(uploadUrl, "path", this.selectedFolder.path);

            var fileUploader = $(".fu-fileupload");
            fileUploader.data("upload-url", uploadUrl);

            this.showStatusWindow = true;
            this.$parent.showUploader = false;
            return false;
        },
        requestConfirmation(closeWindow) {
            var self = this;
            var statusWindow = $(".fu-status-window");
            // Set attr to indicate whether DupeFileHandler should be displayed.
            statusWindow.attr("data-confirmation-requested", true);

            confirm2({
                message: self.T.cancelUpload,
                icon: { type: 'info', name: 'far fa-upload' },
                callback: function (accepted) {
                    if (accepted) {
                        if (closeWindow && !statusWindow.data("upload-in-progress")) {
                            self.showStatusWindow = false;
                            self.collapsedStatusWindow = false;
                        }
                        
                        statusWindow.removeAttr("data-confirmation-requested");

                        // Trigger event so dropzonewrapper can cancel current uploads.
                        statusWindow.trigger("uploadcanceled", [closeWindow && !statusWindow.data("upload-in-progress")]);
                    }
                }
            });
        },
        cancelUploads() {
            this.requestConfirmation(false);
            return false;
        },
        displayStatusWindow(show) {
            var statusWindow = $(".fu-status-window");
            if (!show) {
                if (statusWindow.data("files-in-queue")) {
                    this.requestConfirmation(true);
                }
                else {
                    this.showStatusWindow = false;
                    this.collapsedStatusWindow = false;
                    statusWindow.trigger("uploadcanceled", [true]);
                }
            }
            else {
                this.showStatusWindow = show;
                this.collapsedStatusWindow = show;
            }

            return false;
        },
        onToggleStatusClick(e) {
            var el = $(e.target);

            if (!el.is("a"))
                el = el.parent();

            var collapsed = el.data("collapsed");
            this.toggleStatusWindow(!collapsed);

            var icon = el.find("i");
            icon.toggleClass("fa-chevron-down fa-chevron-up");

            el.data("collapsed", !collapsed);
            return false;
        },
        toggleStatusWindow(show) {
            this.collapsedStatusWindow = show;
        }
    }
});