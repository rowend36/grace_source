define(function (require, exports, module) {
    var getActiveDoc = require('./setup_editors').getActiveDoc;
    var getEditor = require('./setup_editors').getEditor;
    var FileUtils = require('../core/file_utils').FileUtils;
    var Utils = require('../core/utils').Utils;
    var Actions = require('../core/actions').Actions;
    Actions.addAction({
        caption: 'Show console',
        icon: 'bug_report',
        sortIndex: 1000,
        handle: function () {
            require(['./setup_console'], function (e) {
                e._devTools.toggle();
            });
        },
    });

    Object.defineProperties(window, {
        fs: {
            get: function () {
                return getActiveDoc()
                    ? getActiveDoc().getFileServer()
                    : FileUtils.getFileServer();
            },
        },
        doc: {
            get: getActiveDoc,
        },
        editor: {
            get: getEditor,
        },
        gUtils: {
            value: Utils,
        },
        fUtils: {
            value: FileUtils,
        }
    });
});