/** Tern web worker, which is used by default
 * This file also contains all files that are needed for the web worker to run (the server can load files on demand, but its messy to have all these files for once peice of ace functionality) *
 *
 *
 * Last updated 4/8/2015
 * Versions:
 *      Acorn: 1.0.1
 *      Tern:  0.10.0
 *
 * NOTE: in order to get latest acorn version you now must get from NPM or manually build Acorn source. Easiest way is to create a new folder and use: npm install acorn
 * 
 * NOTE: There is a bug with chrome.fileSystem that makes saving this file (specifically acorn.js) break (messes up UTF-8 encoding). https://code.google.com/p/chromium/issues/detail?id=474183. This file must be saved with a non-chrome app. If saved with a chrome app, then overwrting save wont fix, instead must delete file and save as new file from non-chrome app. 
 * 
 * NOTE: acorn_csp.js works without eval, but tern still has code that requires eval so there is no reason to use acorn_csp.
 */

// declare global: tern, server
/*jshint maxerr:10000 */


/**
 * this file used in web worker or normal javascript execution
 */
(function(){
    var isWorker = typeof window === 'undefined';
    // #ifdef TEST
    var self = {};
    exports = undefined;
    module = undefined;
    var window = global;
    setTimeout(function () {
        self.onmessage({type: 'init'});
    });
    // #endif
    /**
     * this plugin is used in Caret-T chrome app.
     * tern can't run in a chrome app due to content security policy that disallows eval (which tern uses).
     * this code allows tern to work in chrome app using sandboxed iframe, so this worker file is not acutally
     * a worker in the chrome app.
     *
     * This code is irrelevant for normal usage, set isChromeApp to false when not using in Caret-T chromeApp.
     *
     */
    var isChromeApp = false;

    if (isChromeApp) {
        var parentSource = null,
            parentOrigin = null;

        window.addEventListener('message', function (event) {
            if (parentSource === null) {
                parentSource = event.source;
                parentOrigin = event.origin;
            }
            onmessage(event);
        });

        window.postMessage = function (message) {
            parentSource.postMessage(message, parentOrigin);
        };
    }

    if (isWorker || isChromeApp) {
        if (isChromeApp) self = window;

        var server,
            nextId = 0,
            pending = {};

        self.onmessage = function (e) {
            //console.log('onmessage');
            var data = e.data;
            switch (data.type) {
                case 'init':
                    if (data.defs && data.defs.length > 0) {
                        var tmp = [];
                        for (var i = 0; i < data.defs.length; i++) {
                            tmp.push(getDefFromName(data.defs[i]));
                        }
                        data.defs = tmp;
                    }
                    return startServer(data.defs, data.plugins, data.scripts);
                case 'add':
                    return server.addFile(data.name, data.text);
                case 'del':
                    return server.delFile(data.name);
                case 'req':
                    //console.log('request received on server, data=',data.body);
                    return server.request(data.body, function (err, reqData) {
                        postMessage({
                            id: data.id,
                            body: reqData,
                            err: err && String(err),
                        });
                    });
                case 'getFile':
                    var c = pending[data.id];
                    delete pending[data.id];
                    return c(data.err, data.text);
                case 'addDefs':
                    return addDefs(data.defs, true);
                case 'delDefs':
                    return delDefs(data.defs);
                case 'debug':
                    debug(data.body);
                    break;
                default:
                    throw new Error('Unknown message type: ' + data.type);
            }

            function addDefs(defs, infront) {
                if (Array.isArray(defs)) {
                    defs.forEach(function (def) {
                        server.addDefs(def, infront);
                    });
                } else server.addDefs(defs, infront);
            }
            function delDefs(defs) {
                if (Array.isArray(defs)) {
                    defs.forEach(function (def) {
                        server.deleteDefs(def);
                    });
                } else server.deleteDefs(defs);
            }

            //(hack)- gets def from name at the bottom of this file (jquery,ecma5,browser,underscore)
            function getDefFromName(name) {
                try {
                    if (typeof name !== 'string') return name;
                    return tern_Defs[name];
                } catch (ex) {
                    if (isWorker)
                        console.log(
                            'error getting tern def (definition file) from name: ' +
                                name
                        );
                    else
                        console.log(
                            'error getting tern def (definition file) from name: ',
                            name,
                            ex
                        );
                    throw ex;
                }
            }

            //(hack)- do something with debug messages
            function debug(message) {
                var r = '';
                if (message == 'files' || message == 'filecontents') {
                    for (var i = 0; i < server.files.length; i++) {
                        if (i > 0) r += '\n';
                        if (message == 'filecontents') {
                            r +=
                                'file: ' + server.files[i].name + '\n\nbody:\n';
                            r += server.files[i].text + '\n\n\n';
                        } else {
                            r += server.files[i].name;
                        }
                    }
                } else {
                    console.log(
                        'unknown debug message in tern worker:' + message
                    );
                }
                if (r) {
                    console.log(
                        'worker server debug - ' + message + '\n\n' + r
                    );
                }
            }
        };

        self.getFile = function (file, c) {
            postMessage({
                type: 'getFile',
                name: file,
                id: ++nextId,
            });
            pending[nextId] = c;
        };

        self.startServer = function (defs, plugins, scripts) {
            console.log('tern: starting server');
            if (scripts) importScripts.apply(null, scripts);
            server = new tern.Server({
                getFile: getFile,
                async: true,
                defs: defs,
                plugins: plugins,
            });
        };

        if (!self.console)
            self.console = {
                log: function (v) {
                    postMessage({
                        type: 'debug',
                        message: v,
                    });
                },
            };
    }
})();
//prevent amd definition
(function(define,require){

//#region tern/node_modules/acorn/dist/acorn.js
// #include "tern/node_modules/acorn/dist/acorn.js"
//#endregion


//#region tern/node_modules/acorn-loose/dist/acorn-loose.js
// #include "tern/node_modules/acorn-loose/dist/acorn-loose.js"
//#endregion


//#region tern/node_modules/acorn-walk/dist/walk.js
// #include "tern/node_modules/acorn-walk/dist/walk.js"
//#endregion


//#region tern/lib/signal.js
// #include "tern/lib/signal.js"
//#endregion


//#region tern/lib/tern.js
// #include "tern/lib/tern.js"
//#endregion



//#region tern/lib/def.js
// #include "tern/lib/def.js"
//#endregion


//#region tern/lib/infer.js
// #include "tern/lib/infer.js"
//#endregion


//#region tern/lib/comment.js
// #include "tern/lib/comment.js"
//#endregion


//#region tern/plugin/requirejs.js
// #include "tern/plugin/requirejs.js"
//#endregion


//#region tern/plugin/modules.js
// #include "tern/plugin/modules.js"
//#endregion


//#region tern/plugin/commonjs.js
// #include "tern/plugin/commonjs.js"
//#endregion


//#region tern/plugin/es_modules.js
// #include "tern/plugin/es_modules.js"
//#endregion


//#region tern/plugin/node_resolve.js
// #include "tern/plugin/node_resolve.js"
//#endregion


//#region tern/plugin/node.js
// #include "tern/plugin/node.js"
//#endregion


//#region tern/plugin/doc_comment.js
// #include "tern/plugin/doc_comment.js"
//#endregion


//#region tern/plugin/complete_strings.js
// #include "tern/plugin/complete_strings.js"
//#endregion


//#region node-express.js
// #include "node-express.js"
//#endregion

//#region tern/plugin/angular.js
// #include "tern/plugin/angular.js"
//#endregion
})(undefined);
var tern_Defs = {};



//#region tern/defs/browser.json
tern_Defs.browser = // #include "tern/defs/browser.json"
//#endregion


//#region tern/defs/ecmascript.json
tern_Defs.ecmascript = // #include "tern/defs/ecmascript.json"
//#endregion

//#region mongoose.json
tern_Defs.mongoose = // #include "mongoose.json"

//#endregion


//#region tern/defs/jquery.json
tern_Defs.jquery = // #include "tern/defs/jquery.json"
//#endregion


//#region tern/defs/underscore.json
tern_Defs.underscore = // #include "tern/defs/underscore.json"
//#endregion


//#region tern/defs/react.json
tern_Defs.react =// #include "tern/defs/react.json"
//#endregion


