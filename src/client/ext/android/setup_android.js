define(function(require, exports, module) {
    "use strict";
    var TAG = "Application";
    if (!window[TAG]) return;

    /*globals Base64*/
    require("grace/libs/js/base64");
    var AndroidFs = require("./android_fs").AndroidFs;
    var appEvents = require("grace/core/app_events").AppEvents;
    var storage = require("grace/core/config").storage;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var config = require("grace/core/config").Config.registerAll({
        "runInNewProcess": false,
        "runInExternalBrowser": false,
        "mockHttps": false
    }, "execute");
    require("grace/core/config").Config.registerInfo({
        "mockHttps": "When enabled, local files use https scheme."
    }, "execute");

    var handler = require("./callback_handler").callbackHandler;

    /*
    @type{
        //Common
        requestAccessKey : {Function}
        getCorsProxyUrl : {Function}
        getDocumentTreeUri : {Function}
        releaseDocumentTreeUri : {Function}
        getEncodings : {Function}
        getIntent : {Function}
        
        //FileServer
        n
        closeReadableStream : {Function}
        closeWritableStream : {Function}
        copyFile : {Function}
        copyFileAsync : {Function}
        delete : {Function}
        deleteRecursively : {Function}
        getBytes : {Function}
        getBytesAsync : {Function}
        getError : {Function}
        getFile : {Function}
        getFileAsync : {Function}
        getFiles : {Function}
        getFilesAsync : {Function}
        getGitBlobIdAsync? : {Function}
        moveFile : {Function}
        moveFileAsync : {Function}
        newFolder : {Function}
        openReadableStream : {Function}
        openWritableStream : {Function}
        readlink : {Function}
        readStream : {Function}
        readStreamAsync : {Function}
        rename : {Function}
        runFile : {Function}
        saveBytes : {Function}
        saveBytesAsync : {Function}
        saveFile : {Function}
        saveFileAsync : {Function}
        stat : {Function}
        symlink : {Function}
        writeStream : {Function}
        writeStreamAsync : {Function}
    }
    */
    var app = window[TAG];
    //Stops this from being used in iframes
    //provided the iframe cannot access the parent
    //window either
    var accessKey = app.requestAccessKey();
    window[TAG] = handler;

    handler._notifyIntent = function() {
        appEvents.on("appLoaded", function() {
            var intent = app.getIntent(accessKey);
            if (intent) {
                handler._onNewIntent(intent);
            }
        });
    };
    handler._notifyIntent();


    Env.isWebView = true;
    Env.isLocalHost = false;
    Env.server = null;
    Env.canLocalHost = true;
    /*
        Note on Urls:
        To be used on newer android versions
        where allowUniversalAccessFromFileUrls is deprecated,
        http://grace.androidplatform.net allows mock https,http but not file
        so when enabled, files must be accessesed through 
        http://files.android.platform.net
        And cross-origin requests must use getCorsProxyUrl
        with opts {body,method}. The method and url will be used to
        verify the actual request while the body is stored for transmission
        until later use. This method is of course likely to be superceded by
        a dedicated local server in needs be later on but the API is unlikely
        to change so we make it available first
    */
    Env.getCorsProxyUrl = function(url, opts) {
        if (isUsingFileProtocol)
            return url; //this check is also duplicated on the native side
        opts = opts || {};
        var body;
        if (!opts.body) body = "";
        else if (FileUtils.isBuffer(opts.body)) {
            body = Base64.encode(opts.body);
        } else body = btoa(opts.body);
        return app.getCorsProxyUrl(url, opts.method || '', body,
            accessKey);
    };
    Env.newWindow = function(path) {
        appEvents.pause();//The real pause comes later
        appEvents.resume();
        app.runFile(path, config.runInExternalBrowser ? "browser" :
            config.runInNewProcess ? "process" :
            "webview", accessKey);
    };


    var isUsingFileProtocol = window.location.protocol == "file";
    
    function AppFileServer(path) {
        this.root = path || "/sdcard/";
        this.disk = "local";
        this.fileAccessPrefix = isUsingFileProtocol ? "file://" :
            "http://grace.androidplatform.net/root/";
        AndroidFs.call(this, app, accessKey);
    }
    Object.defineProperty(AppFileServer.prototype, 'href', {
        get: function() {
            return isUsingFileProtocol ? "file://" : (
                    config.mockHttps ? "https" : "http"
                ) +
                "://files.androidplatform.net/";
        }
    });
    FileUtils.registerFileServer('application', "Default FileSystem",
        function(conf) {
            return (window.afs = new AppFileServer(conf && conf
                .root));
        }, [{
            name: "root",
            caption: "Root Directory",
            value: '/storage/emulated/0/',
            type: "text"
        }], true);


    if (!window.DocumentFileSystem) return;

    function DocumentFs(uri) {
        this.root = "/" + uri + "/root_directory/";
        this.disk = uri;
        AndroidFs.call(this, window.DocumentFileSystem,
            accessKey);
    }
    DocumentFs.prototype.destroy = function() {
        app.releaseDocumentTreeUri(this.disk, accessKey);
    };
    FileUtils.registerFileServer('android', "System",
        function(conf) {
            var fs;
            if (conf.id) {
                var uri = storage.getItem("uri:" + conf.id);
                fs = new DocumentFs(uri);
                return fs;
            } else {
                var id = conf.id = require("grace/core/utils")
                    .Utils.genID("s");
                var stub = new require(
                        "grace/core/register_fs_extension")
                    .StubFileServer(function() {
                        return fs;
                    });
                stub.id = id;
                DocumentFs.requestFileSystem(
                    function(uri) {
                        fs = new DocumentFs(uri);
                        fs.id = id;
                        storage.setItem(id, "uri:" + conf
                            .id);
                        stub.$inject();
                    });
                return stub;
            }
        });

}); /*_EndDefine*/