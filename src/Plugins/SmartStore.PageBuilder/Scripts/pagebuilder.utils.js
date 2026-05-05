(function ($, window, document, undefined) {

    window.initThemeColorChooser = function (ctx) {
        $(ctx).find('.theme-color-chooser > option').each(function () {
            var option = $(this);
            option.data("color", localStorage.getItem('--' + this.value));
        });
    };

    initThemeColorChooser('body');

})( jQuery, this, document );