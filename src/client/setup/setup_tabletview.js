define(function (require, exports, module) {
    /*globals $*/
    var configEvents = require('./core/config').Config;
    var Dropdown = require('../ui/dropdown').Dropdown;
    var appConfig = require('../core/config').Config.registerAll(
        {
            tabletView: window.innerWidth > 720,
        },
        'ui'
    );
    require('../core/config').Config.registerInfo(
        {
            tabletView: 'Optimize view for wide screens',
        },
        'ui'
    );
    configEvents.on('ui', function (ev) {
        if (ev.config == 'tabletView') {
            $(document.body)[ev.value() ? 'on' : 'off'](
                'mousedown',
                'select',
                Dropdown.openSelect
            );
        } else if (ev.config == 'enableTouchKeyboardFeatures') {
            Env.isHardwareKeyboard = !ev.value();
        }
    });

    if (appConfig.tabletView)
        $(document.body).on('mousedown', 'select', Dropdown.openSelect);
});