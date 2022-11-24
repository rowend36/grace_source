define(function (require, exports, module) {
    /* globals $ */
    var Utils = require('grace/core/utils').Utils;
    var GitUtils = (exports.GitUtils = exports);
    var Notify = require('grace/ui/notify').Notify;
    var UiThread = require('grace/ext/ui_thread').UiThread;
    var padStart =
        typeof String.prototype.padStart === 'undefined'
            ? function (str, len, pad) {
                  var t = Utils.repeat(
                      Math.floor((len - str.length) / pad.length),
                      pad
                  );
                  return (
                      t + pad.substring(0, len - str.length - t.length) + str
                  );
              }
            : function (str, len, pad) {
                  str.padStart(len, pad);
              };
    exports.padStart = padStart;
    exports.testPlain = function (str) {
        if (!str) return false;
        return /^[A-Za-z][-A-Za-z_0-9]+$/.test(str);
    };
    exports.testUrl = function (str) {
        if (!str) return false;
        return /^([A-Za-z]+\:\/+)?([0-9\.]+(\:[0-9]+)?|[A-Za-z][-\.A-Za-z_0-9]+)(\/+[A-Za-z][A-Za-z_0-9]*)*(\.([a-zA-Z]+))?\/?$/.test(
            str
        );
    };
    exports.success = function () {
        Notify.info('Done');
    };

    exports.createProgress = function (status) {
        var el = $(
            Notify.modal(
                {
                    header: status || 'Starting....',
                    body:
                        "<span class='progress'><span class='determinate'></span></span>",
                    footers: ['Cancel'],
                    className: 'modal-alert',
                    dismissible: true,
                },
                function () {
                    el = null;
                }
            )
        );
        el.find('.modal-cancel').text('Hide');
        return {
            update: function (event) {
                return UiThread.awaitIdle().then(function () {
                    if (!el) return;
                    el.find('.modal-header').text(event.phase);
                    if (event.total) {
                        if (
                            el.find('.progress').children('.determinate')
                                .length < 1
                        ) {
                            el.find('.progress').html(
                                "<span class='determinate'></span>"
                            );
                        }
                        el.find('.progress')
                            .children('.determinate')
                            .css(
                                'width',
                                (event.loaded / event.total) * 100 + '%'
                            );
                    } else {
                        if (
                            el.find('.progress').children('.indeterminate')
                                .length < 1
                        ) {
                            el.find('.progress').html(
                                "<span class='indeterminate'></span>"
                            );
                        }
                    }
                });
            },
            dismiss: function () {
                if (el) {
                    el.modal('close');
                    el = null;
                }
            },
            error: function (e) {
                if (el) {
                    el.modal('close');
                    el = null;
                }
                GitUtils.failure(e);
            },
        };
    };
    exports.handleError = function (e, data) {
        switch (e.code) {
            case 'CheckoutConflictError':
                Notify.modal({
                    header: 'Unable To Checkout ' + (data ? data.ref : ''),
                    body:
                        e.message +
                        "</br><span><i class='material-icons'>info</i></span>Commit your unsaved changes or revert the changes to continue",
                });
                return true;
            default:
                console.error(e);
        }
    };
    exports.failure = function (e) {
        GitUtils.handleError(e);
        if (e.toString == {}.toString) e = e.message || e.code;
        Notify.error('Error: ' + e.toString());
    };
    exports.writeFile = function (name, content, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.mkdir(dir + '/grace', function () {
            fs.writeFile(dir + '/grace/' + name, content, cb);
        });
    };
    exports.readFile = function (name, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.readFile(dir + '/grace/' + name, 'utf8', cb);
    };
    exports.removeFile = function (name, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.unlink(dir + '/grace/' + name, cb);
    };
}); /*_EndDefine*/
