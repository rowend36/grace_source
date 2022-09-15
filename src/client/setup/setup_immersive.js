define(function (require, exports, module) {
    var Actions = require('../core/actions').Actions;
    if (!Env.isWebView) {
        var method =
            'requestFullscreen' in document.body
                ? 'requestFullscreen'
                : 'webkitRequestFullscreen' in window
                ? 'webkitRequestFullscreen'
                : 'webkitRequestFullScreen' in window
                ? 'webkitRequestFullScreen'
                : null;
        if (method !== null)
            Actions.addAction({
                caption: 'Enable immersive mode',
                icon: 'fullscreen', //TODO hide this
                handle: function () {
                    document.body[method]();
                },
            });
    }
});