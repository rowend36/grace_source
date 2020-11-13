"use strict";
(function(global) {
    var isDirectory = global.FileUtils.isDirectory;
    var SearchTree = function(folder, fileServer, allowDirectory, files) {
        this._files = files || [];
        //this._next = [];
        this._index = 0;
        this._folders = [folder];
        this._current = this._files;
        this._waiting = [];
        this._loading = false;
        this._fileServer = fileServer;
        this._allowDir = allowDirectory;
        this._argfolder = folder;
        this.tag = 0;
    };
    SearchTree.prototype.eatBack = function(file) {
        if (this._index == 0) {
            this._current.unshift(file);
        }
        else {
            this._index--;
            this._current[this._index] = file;
        }
    };
    SearchTree.prototype.addFolder = function(folder) {
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
    SearchTree.prototype.reset = function(clearCache) {
        if (clearCache) {
            this._files = [];
            this._folders = [this._argfolder];
            this._loading = false;
            //this._next = [];
            this._current = [];
            this._waiting = [];
            this.tag++;
        }
        else this._current = this._files;
        this._index = 0;

    };
    SearchTree.prototype.getNext = function(callback, empty, throttle) {
        var self = this;
        if (this._index >= this._current.length) {
            var c = function() {
                var i = 0;
                var b = self._waiting;
                self._waiting = [];
                for (var e in b) {
                    i += 1;
                    self.getNext(b[e], empty, Math.min(70, (throttle || 1) * 2));
                }
            };
            if (!this._loading) {
                var now = throttle && new Date().getTime();
                var a = this._nextFolder(function(files) {
                    self._current = files;
                    self._loading = false;
                    self._index = 0;
                    if (throttle) {
                        var diff = throttle - (new Date().getTime() - now);
                        console.log('retry delay ',diff);
                        setTimeout(c, Math.max(0, diff));
                    }
                    else c();
                });
                this._loading = true;
                if (!a) {
                    setTimeout(empty, 0);
                    this._loading = false;
                }
            }
            this._waiting.push(callback);
        }
        else {
            setTimeout(callback.bind(undefined, this._current[this._index]), 0);
            this._index += 1;
        }
    };
    SearchTree.prototype._nextFolder = function(callback) {
        var a;
        //if (this._next.length < 1) {
        if (this._folders.length < 1) {
            return false;
        }
        else {
            a = this._folders.shift();
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
    SearchTree.prototype._init = function(folder, callback) {
        var self = this;
        var tag = this.tag;
        var a = function(err, res) {
            if (tag != self.tag) {
                return;
            }
            if (err) {
                self._folders.push(folder);
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
    global.SearchTree = SearchTree;
})(Modules);