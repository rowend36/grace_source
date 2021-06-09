_Define(function(global) {
    "use strict";
    var isDirectory = global.FileUtils.isDirectory;
    var setImmediate = global.Utils.setImmediate;
    var noop = global.Utils.noop;
    var SearchList = function(folder, fileServer, allowDirectory, files) {
        this._files = files || [];
        //this._next = [];
        this._index = 0;
        this._folders = [folder];
        this._errors = [];
        this._current = this._files;
        this._waiting = [];
        this._loading = false;
        this._fileServer = fileServer;
        this._allowDir = allowDirectory;
        this._argfolder = folder;
        this.tag = 0;
    };
    SearchList.prototype.onDir = noop;
    SearchList.prototype.eatBack = function(file) {
        if (this._index == 0) {
            this._current.unshift(file);
        }
        else {
            this._index--;
            this._current[this._index] = file;
        }
    };
    SearchList.prototype.addFolder = function(folder) {
        for (var i in this._folders)
            if (folder.startsWith(this._folders[i])) {
                throw "Cannot add child folder";
            }
        for (i in this._files)
            if (this._files[i].startsWith(folder)) {
                throw "Already added";
            }
        this._folders.push(folder);
    };
    SearchList.prototype.reset = function(clearCache) {
        if (clearCache) {
            this._files = [];
            this._folders = [this._argfolder];
            this._loading = false;
            //this._next = [];
            this._current = [];
            this._waiting = [];
            this._errors = [];
            this.tag++;
        }
        else{
            for(var i in this._errors){
                this._folders.push(this._errors[i]);
            }
            this._errors.length = 0;
            this._current = this._files;
            this._waiting = [];
        }
        this._index = 0;

    };
    function afterLoad(self, files,empty,throttle) {
        self._current = files;
        self._loading = false;
        self._index = 0;
        var i = 0;
        var b = self._waiting;
        self._waiting = [];
        for (var e in b) {
            i += 1;
            self.getNext(b[e], empty, Math.min(70, (throttle || 1) * 2));
        }
    }
    SearchList.prototype.getNext = function(callback, empty, throttle) {
        if (this._index >= this._current.length) {
            if (!this._loading) {
                this._loading = true;
                var self = this;
                var now = throttle && new Date().getTime();
                var hasNext = this._nextFolder(throttle ? function(files) {
                    var diff = throttle - (new Date().getTime() - now);
                    setTimeout(afterLoad.bind(null, self,files,empty,throttle), Math.max(0, diff));
                } : function(files){
                    afterLoad(self,files,empty,throttle);
                });
                if (!hasNext) {
                    setImmediate(empty);
                    this._loading = false;
                }
            }
            this._waiting.push(callback);
        }
        else {
            setImmediate(callback.bind(undefined, this._current[this._index]));
            this._index += 1;
        }
    };
    SearchList.prototype._nextFolder = function(callback) {
        var a;
        //if (this._next.length < 1) {
        if (this._folders.length < 1) {
            return false;
        }
        else {
            a = this._folders.shift();
            this.onDir(a);
            this._init(a, callback);
            return true;
        }
        //}
        // else {
        //     throw 'Caching not yet supported';
        //     a = this._next.shift();
        //     console.log("using cached ", a);
        //     setTimeout(callback.bind(this, a), 0);
        //     return true;
        // }
    };
    SearchList.prototype._init = function(folder, callback) {
        var self = this;
        var tag = this.tag;
        var a = function(err, res) {
            if (tag != self.tag) {
                return;
            }
            if (err) {
                self._errors.push(folder);
                return callback([]);
            }
            res.sort();
            var files = [];

            for (var i of res) {
                if (isDirectory(i)) {
                    if (self._allowDir) {
                        self._files.push(folder + i);
                    }
                    self._folders.push(folder + i);
                }
                else {
                    files.push(folder + i);
                    self._files.push(folder + i);
                }
            }
            // if (!callback) {
            //     throw 'Caching not yet supported';
            //     console.log("caching files ", folder);
            //     this._next.push(files);
            // }
            //else {
            callback(files);
            //}
        };
        self._fileServer.getFiles(folder, a);
    };
    global.SearchList = SearchList;
})/*_EndDefine*/;