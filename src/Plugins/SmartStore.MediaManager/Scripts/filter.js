var IMG_SIZE_XS = 0;
var IMG_SIZE_SM = 1;
var IMG_SIZE_MD = 2;
var IMG_SIZE_LG = 3;
var IMG_SIZE_XL = 4;

Vue.component("m-filter", {
    template: `
        <div class="m-filter flex-grow-0">
            <div class="m-filter-selectors navbar navbar-slide p-0 row flex-nowrap xs-gutters align-items-center">
                <div v-for="(facet, prop) in facets" class="dropdown m-filter-selector col-auto" 
                    :data-searchable="facet.searchable" 
                    :data-filter="prop" 
                    :data-lazy="facet.lazy">
                    <a class="btn btn-light btn-sm btn-flat m-filter-selector-btn" href="#" data-toggle="dropdown" :class="{ 'disabled': isFixedFilter(prop) }">
                        {{ facet.name }}
                    </a>
                    <div class="dropdown-menu">
                        <div v-if="facet.searchable && facet.items && facet.items.length > 12" class="ml-2 mb-2 mr-2">
                            <input type="text" class="search-term form-control form-control-sm" style="min-width: 150px" 
                                :value="facet.searchTerm" 
                                v-on:input="onSearchTermChange($event, facet)" />
                        </div>
                        <div v-if="!facet.items || facet.items.length === 0" class="px-4 py-1 text-muted">{{ T.listIsEmpty }}</div>
                        <div v-else class="m-filter-items">
                            <a v-for="item in facet.items" class="dropdown-item" href="#"
                                :class="{ 'selected': isSet(prop, item.value) }"
                                v-if="!facet.searchable || matchesSearchTerm(facet.searchTerm, item.name || item.value)" 
                                v-on:click.prevent="setFilter($event, prop, item.value)">
                                <span>{{ item.name || item.value }}</span>
                            </a>
                        </div>
                    </div>
                </div>
                <div class="m-status col text-muted small d-flex align-items-center justify-content-center text-nowrap">
                    <span>{{ $parent.statusMessage }}</span>
                </div>
                <div class="m-filter-selector col" data-filter="term">
                    <input type="text" class="form-control form-control-sm m-filter-term" 
                        :data-xvalue="query.term" 
                        :placeholder="T.searchTermPlaceholder"
                        :title="T.searchTermPlaceholder"
                        v-on:input="debouncedSetTerm"  />
                </div>
            </div>
            <div v-if="hasFilter" class="m-filter-current d-inline-flex flex-row flex-wrap mt-1">
                <div v-for="type in query.mediaTypes" class="badge badge-pill badge-primary">
                    <span>{{ getBadgeName('mediaTypes', type) }}</span>
                    <a v-if="!isFixedBadge(type)" href="#" class="m-filter-del" v-on:click.prevent="setFilter($event, 'mediaTypes', type)">&times;</a>
                </div>
                <div v-for="ext in query.extensions" class="badge badge-pill badge-success">
                    <span>.{{ ext }}</span>
                    <a v-if="!isFixedBadge('.' + ext)" href="#" class="m-filter-del" v-on:click.prevent="setFilter($event, 'extensions', ext)">&times;</a>
                </div>
                <div v-for="tag in query.tags" class="badge badge-pill badge-secondary">
                    <i class="fas fa-tag mr-1" style="opacity: 0.5"></i>
                    <span>{{ getBadgeName('tags', tag) }}</span>
                    <a href="#" class="m-filter-del" v-on:click.prevent="setFilter($event, 'tags', tag)">&times;</a>
                </div>
                <div v-for="dim in query.dimensions" class="badge badge-pill badge-warning">
                    <span>{{ getBadgeName('dimensions', dim) }}</span>
                    <a href="#" class="m-filter-del" v-on:click.prevent="setFilter($event, 'dimensions', dim)">&times;</a>
                </div>
            </div>
        </div>
    `,
    props: {
        query: Object
    },
    data: function () {
        return {
            facets: {
                mediaTypes: {
                    name: this.T.facetType,
                    multiSelect: true,
                    items: [
                        { value: 'image', name: this.T.mediaTypeImage },
                        { value: 'video', name: this.T.mediaTypeVideo },
                        { value: 'audio', name: this.T.mediaTypeAudio },
                        { value: 'document', name: this.T.mediaTypeDocument },
                        { value: 'text', name: this.T.mediaTypeText },
                        { value: 'bin', name: this.T.mediaTypeBin }
                    ]
                },
                extensions: {
                    name: this.T.facetExtension,
                    multiSelect: true,
                    searchable: true,
                    searchTerm: '',
                    lazy: true,
                    items: null,
                },
                tags: {
                    name: this.T.facetTag,
                    multiSelect: true,
                    searchable: true,
                    searchTerm: '',
                    lazy: true,
                    items: null
                },
                dimensions: {
                    name: this.T.facetImgSize,
                    multiSelect: true,
                    items: [
                        { value: IMG_SIZE_XS, name: this.T.imgSizeXs },
                        { value: IMG_SIZE_SM, name: this.T.imgSizeSm },
                        { value: IMG_SIZE_MD, name: this.T.imgSizeMd },
                        { value: IMG_SIZE_LG, name: this.T.imgSizeLg },
                        { value: IMG_SIZE_XL, name: this.T.imgSizeXl }
                    ]
                }
            }
        }
    },
    computed: {
        hasFilter() {
            var q = this.query;
            return q.mediaTypes.length > 0 || q.extensions.length > 0 || (q.tags && q.tags.length > 0) || q.dimensions.length > 0;
        }
    },
    beforeCreate() {
        // Localization
        this.T = window.Res.Media;
    },
    created() {
        var self = this;

        bus.$on('save', function () {
            // Reload these on next dropdown open
            self.facets.extensions.items = null;
            self.facets.tags.items = null;
        });
    },
    mounted: function () {
        var self = this;

        $('.m-filter-selector.dropdown[data-lazy=true]').on('show.bs.dropdown', function (e) {
            var el = $(this);
            var filter = el.data('filter');

            if (filter === 'extensions' && !self.facets.extensions.items) {
                self.loadExtensions();
            }
            else if (filter === 'tags' && !self.facets.tags.item) {
                self.loadTags();
            }
        });

        $('.m-filter-selector.dropdown[data-searchable=true]').on('shown.bs.dropdown', function (e) {
            var self = this;
            _.delay(function () { $(self).find('.search-term').focus() }, 100);
        });
    },
    methods: {
        onSearchTermChange(e, facet) {
            facet.searchTerm = e.target.value;
        },
        matchesSearchTerm(term, value) {
            return (!term || !value) ? true : value.toLowerCase().indexOf(term.toLowerCase()) > -1;
        },
        loadExtensions() {
            var self = this;
            this.$root.ajax({
                url: $('#url_extensions').val(),
                success: function (result) {
                    self.facets.extensions.items = _.map(result, function (val) { return { value: val, name: '.' + val } });
                }
            });
        },
        loadTags() {
            var self = this;
            this.$root.ajax({
                url: $('#url_tags').val(),
                success: function (result) {
                    self.facets.tags.items = result;
                }
            });
        },
        getBadgeName(name, value) {
            var items = this.facets[name].items;
            if (items && items.length) {
                var facetItem = _.find(items, function (v) { return v.value === value });
                if (facetItem) {
                    return facetItem.name || value;
                }
            }

            return value;
        },
        isSet(name, value) {
            var arr = this.query[name];
            if (arr) {
                var index = arr.indexOf(value);
                return index > -1;
            }

            return false;
        },
        isFixedFilter(name) {
            if (name === 'mediaTypes') {
                return this.query._typeFixed || this.query._extFixed;
            }
            else if (name === 'extensions') {
                return this.query._extFixed;
            }

            return false;
        },
        isFixedBadge(value) {
            return this.$root.typeFilter.indexOf(value) > -1;
        },
        setFilter(e, name, value) {
            var arr = this.query[name];
            this.query.refreshFileCounts = true;
            this.query.firstPage();
            var index = arr.indexOf(value);

            if (this.isSet(name, value)) {
                arr.splice(index, 1);
            }
            else {
                arr.push(value);
            }
        },
        debouncedSetTerm: _.debounce(function (e) {
            this.setTerm(e);
        }, 300),
        setTerm(e) {
            var val = (e.target || e.currentTarget).value;
            if (val !== this.query.term) {
                this.query.refreshFileCounts = true;
                this.query.firstPage();
                this.query.term = val;
            }
        }
    }
});