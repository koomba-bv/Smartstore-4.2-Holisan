Vue.directive('select2', {
    inserted(el) {
        $(el).on('select2:select', function () {
            el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        });

        $(el).on('select2:unselect', function () {
            el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        });
    },
});

Vue.component("m-editor", {
    template: `
        <div class="m-edit">
            <div v-if="languagesCount === 1">
                <div class="form-group">
                    <label class="m-edit-label">{{ T.alt }}</label>
                    <input class="form-control" type="text" v-model="file.alt" v-on:input="onInputChange" />
                </div>
                <div class="form-group">
                    <label class="m-edit-label">{{ T.title }}</label>
                    <input class="form-control" type="text" v-model="file.title" v-on:input="onInputChange" />
                </div>
            </div>
            <div v-else class="m-locale-editor locale-editor">
                <div class="nav-locales tabbable">
                    <ul class="m-nav nav nav-tabs">
                        <li class="nav-item active">
                            <a href="#m-edit-tab-default" class="m-nav-link nav-link active" data-toggle="tab">{{ T.standard }}</a>
                        </li>
                        <li class="nav-item" v-for="locale in file.locales">
                            <a :href="'#m-edit-tab-' + locale.languageId" class="m-nav-link nav-link" data-toggle="tab" :title="locale.languageName">
                                <img :src="locale.flagUrl" />
                            </a>
                        </li>
                    </ul>
                    <div class="tab-content my-0 p-3 bg-white">
                        <div id="m-edit-tab-default" class="tab-pane active">
                            <div class="form-group">
                                <label class="m-edit-label">{{ T.alt }}</label>
                                <input class="form-control" type="text" v-model="file.alt" v-on:input="onInputChange" />
                            </div>
                            <div class="form-group">
                                <label class="m-edit-label">{{ T.title }}</label>
                                <input class="form-control" type="text" v-model="file.title" v-on:input="onInputChange" />
                            </div>
                        </div>
                        <template v-for="locale in file.locales">
                            <div :id="'m-edit-tab-' + locale.languageId" class="tab-pane">
                                <div class="form-group">
                                    <label class="m-edit-label">{{ T.alt }}</label>
                                    <input class="form-control" type="text" v-model="locale.alt" v-on:input="onInputChange" />
                                </div>
                                <div class="form-group">
                                    <label class="m-edit-label">{{ T.title }}</label>
                                    <input class="form-control" type="text" v-model="locale.title" v-on:input="onInputChange" />
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label class="m-edit-label">{{ T.tags }}</label>
                <select id="tags-select" class="form-control" multiple="multiple"
                    v-select2
                    v-model="file.selectedTags"
                    v-on:change="onInputChange">
                    <option v-for="tag in file.tags" v-bind:value="tag.name">{{ tag.name }}</option>
                </select>
            </div>
        </div>
    `,
    props: {
        selectedFiles: Array,
        languagesCount: Number
    },
    created: function () {
        // Localization
        this.T = window.Res.Media;
    },
    mounted: function () {
        if (this.selectedFiles.length === 1) {
            this.loadData(this.selectedFiles[0].id);
        }
        else if (this.languagesCount > 1) {
            // Required to init locale editor.
            this.loadData(0);
        }

        $('#tags-select').selectWrapper({
            tags: true,
            minimumInputLength: 0,
            createTag: function (params) {
                var term = $.trim(params.term);
                if (term === '') {
                    return null;
                }

                return {
                    id: term,
                    text: term,
                    isCustom: true
                };
            },
            ajax: {
                cache: true,
                delay: 250,
                global: false,
                url: $('#url_tags').val() + '?selectedIds=',
                processResults: function (data) {
                    $.each(data, function (i, d) {
                        data[i]['id'] = d.text;
                    });

                    return {
                        results: data
                    }
                }
            },
        });
    },
    data: function () {
        return {
            file: {
                ids: this.getFileIds(),
                title: '',
                alt: '',
                // To be able to process newly entered tags, we need to bind the tag name instead of the tag ID.
                selectedTags: [],
                tags: [],
                locales: []
            }
        }
    },
    methods: {
        getFileIds() {
            return _.map(this.selectedFiles, function (f) { return f.id });
        },
        loadData(id) {
            var self = this;
            this.$root.ajax({
                url: $('#url_edit_file').val(),
                data: { id: id },
                success: function (result) {
                    self.file = result.data;
                    self.file.ids = self.getFileIds();
                }
            });
        },
        onInputChange(e) {
            this.$emit('inputChanged', e);
        },
    },
});