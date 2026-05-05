(function ($, window, document, undefined) {

    var root = $('.overlay-editor-root');
    var urlAdd = root.data('url-add');

    // Add new overlay
    $('.add-overlay-dropdown').on('click', '.overlay-add', function (e) {
        e.preventDefault();

        var order = 1;
        root.children('.overlay-editor-item').each(function () {
            order = Math.max(order, parseInt($(this).data('order')));
        });      

        $.ajax({
            type: 'POST',
            cache: false,
            url: urlAdd,
            data: {
                type: $(this).data('type'),
                region: $(this).closest('.add-overlay-dropdown').data('region'),
                order: order + 1
            },
            success: function (html) {
                // Close open groups
                root.find('[data-toggle=collapse]')
                    .addClass('collapsed')
                    .attr('aria-expanded', 'false')
                    .next()
                    .removeClass('show');

                var el = $(html).appendTo(root);
                applyCommonPlugins(el);
                if (_.isFunction(window.initThemeColorChooser))
                    window.initThemeColorChooser(el);

                setDirty();
            }
        });
    });

    root.sortable({
        handle: '.sortable-grip',
        ghostClass: 'sortable-ghost',
        animation: 150
    }).on('sort', function (e) {
        root.children().each(function (n) {
            $(this).data('order', n).attr('data-order', n);
            $(this).find('.overlay-ordinal').val(n);
        });
        setDirty();
    });

    // Add new overlay
    root.on('click', '.overlay-action', function (e) {
        e.preventDefault();
        e.stopPropagation();

        var action = $(this).data('action');
        var item = $(this).closest('.overlay-editor-item');

        if (action === 'remove') {
            if (confirm(Res['Admin.Common.AreYouSure'])) {
                item.remove();
                setDirty();

            }
        }
    });

    root.on('click', '.admin-config-group .switch', function (e) {
        e.stopPropagation();
    });

    // Upload video
    $(document).on('click', '.upload-video', function (e) {
        e.preventDefault();

        var field = $(this).closest(".input-group").find(".form-control, .text-box");

        SmartStore.media.openFileManager({
            el: this,
            type: '.' + $(this).data('ext'),
            backdrop: false,
            onSelect: function (files) {
                if (!files.length) return;
                field.val(files[0].url).trigger('change').trigger('input');
            }
        });
    });

    // Gradient stuff
    root.on('change', '.select-gradient-type input[type=radio]', function (e) {
        var editor = $(this).closest('.overlay-editor');
        if ($(this).val() === 'Linear') {
            editor.find('[data-gradient-type="linear"]').removeClass('d-none');
            editor.find('[data-gradient-type="radial"]').addClass('d-none');
        }
        else {
            editor.find('[data-gradient-type="radial"]').removeClass('d-none');
            editor.find('[data-gradient-type="linear"]').addClass('d-none');
        }
    });

    root.on('change', '.select-gradient-repeat', function (e) {
        var editor = $(this).closest('.overlay-editor');
        if ($(this).val() === 'NoRepeat') {
            editor.find('[data-gradient-repeat]').addClass('d-none');
        }
        else {
            editor.find('[data-gradient-repeat]').removeClass('d-none');
        }
    });

    root.on('change', '.select-gradient-lineardir .range-slider > input[type=hidden]', function (e) {
        var previewer = $(this).closest('.select-gradient-lineardir').find('.linear-gradient-preview');
        previewer.css('--angle', $(this).val() + 'deg');
    });

    function setDirty() {
        if (window.SmartStore.StoryEditor)
            window.SmartStore.StoryEditor.setDirty(true);
    }

})( jQuery, this, document );