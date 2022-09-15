define(function (require, exports, module) {
    /*globals $*/
    var appEvents = require('grace/core/app_events').AppEvents;
    var runCode = require('./run').Execute.runCode;
    var rootView = require('grace/setup/setup_root').rootView;
    var button = $(
        '<button id="runButton"' +
            'class="btn-floating opaque-on-hover hidden btn btn-large waves-effect waves-light">' +
            '<i class="material-icons">play_arrow</i>' +
            '</button>',
    );
    var appConfig = require('grace/core/config').Config.registerAll(
        {enableFloatingRunButton: 'auto'},
        'ui',
    );
    require('grace/core/config').Config.registerInfo(
        {
            enableFloatingRunButton: {
                default: 'auto',
                values: ['true', 'small', 'center', 'auto', false],
            },
        },
        'ui',
    );
    rootView.$el.append(button);
    button.click(runCode);
    var hideRunButton;
    button.removeClass('hide');

    function update(ev) {
        var enable = appConfig.enableFloatingRunButton;
        if (ev) {
            button.removeClass('centerV');
            button.addClass('btn-large');
            appEvents.off('keyboardChanged', hideRunButton);
        }
        if (enable) {
            switch (enable) {
                case 'center':
                    button.addClass('centerV');
                    break;
                case 'small':
                    button.removeClass('btn-large');
                    break;
                case 'auto':
                    var hidRunButton = true;
                    if (!hideRunButton)
                        hideRunButton = function (ev) {
                            if (hidRunButton !== (ev.isTrusted && ev.visible)) {
                                if (hidRunButton) {
                                    button.removeClass('slide-out');
                                    hidRunButton = false;
                                } else {
                                    button.addClass('slide-out');
                                    hidRunButton = true;
                                }
                            }
                        };
                    appEvents.on('keyboardChanged', hideRunButton);
            }
        } else {
            button.hide();
        }
    }
    require('grace/core/config').Config.on('ui', update);
    update();
});