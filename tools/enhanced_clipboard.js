_Define(function(global) {
    "use strict";
    global.Clipboard = function() {
        if (this) {
            this._clip = [];
        }
    };
    global.Clipboard.prototype = {
        _clip: [],
        set: function(text, isPaste) {
            //we detect paste events for
            //environments where Env.getClipboard
            //is hacky or unavailable
            if (!text) return;
            if (Env.setClipboard && !isPaste) {
                //might be asynchronous
                Env.setClipboard(text);
            }
            if (text != this._clip[0]) {
                this._clip.unshift(text);
                if (this.onchange) {
                    this.onchange(this._clip, "add");
                }
            }
        },
        delete: function(index) {
            var it = this._clip.splice(index || 0, 1);
            if (!index) this.set(this._clip[0], true);

            if (this.onchange) this.onchange(this._clip, "delete", index || 0);
            return it[0];
        },
        get: function(index, cb) {
            //update value of clipboard
            if (!index && Env.getClipboard) {
                //might be called synchronously
                Env.getClipboard(
                    function(e, r) {
                        if (r && r !== this._clip[0]) this.clip.unshift(r);
                        cb && cb(this._clip[0] || "");
                    }.bind(this)
                );
            } else if (cb) {
                cb(this._clip[index || 0] || "");
                return;
            }
            //return current value
            return this._clip[index || 0] || "";
        },
        clear: function() {
            this._clip = [];
            if (this.onchange) this.onchange(this._clip, "clear");
        },
        set text(i) {
            this.set(i);
        },
        get text() {
            return this.get();
        },
        set length(i) {
            this._clip.length = i;
        },
        get length() {
            return this._clip.length;
        },
    };
}); /*_EndDefine*/
_Define(function(global) {
    var appStorage = global.appStorage;
    var FileUtils = global.FileUtils;
    var FocusManager = global.FocusManager;
    var Functions = global.Functions;
    var Utils = global.Utils;
    var BottomList = global.BottomList;
    var appEvents = global.AppEvents;
    var CharBar = global.CharBar;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    //ClipBoard
    var ClipBoard = global.Clipboard;
    var clipboard = new ClipBoard();
    global.clipboard = clipboard;
    Object.defineProperty(window, "Clip", {
        value: clipboard,
    });
    var savedClip = global.getObj("clipboard", []);
    if (savedClip.length) {
        clipboard._clip = savedClip;
    }
    CharBar.setClipboard(clipboard);
    var copyTextEl;

    if (!Env.setClipboard) {
        /**@type {Function?} useCopyArea*/
        var useCopyArea = function() {
            copyTextEl = document.createElement("textarea");
            document.body.appendChild(copyTextEl);
            copyTextEl.readOnly = true;
            copyTextEl.tabIndex = -1;
            copyTextEl.style.opacity = "0";
            copyTextEl.style.position = "absolute";
            copyTextEl.style.tabIndex = -1;
            copyTextEl.style.height = "1px";
            copyTextEl.style.width = "1px";
            copyTextEl.style.top = "-100vh";
            useCopyArea = null;
        };
        useCopyArea();
        var setClipExec = function(text, callback) {
            copyTextEl.value = text;
            copyTextEl.selectionStart = 0;
            copyTextEl.selectionEnd = text.length;
            var release = FocusManager.visit(copyTextEl, true);
            var result = document.execCommand("copy") ?
                undefined :
                {
                    code: "EUNKNOWN",
                    message: "Failed to write clipboard",
                };
            release();
            callback && callback(result);
        };
        var getClipExec = function(callback) {
            var release = FocusManager.visit(copyTextEl, true);
            copyTextEl.focus();
            copyTextEl.value = "";
            var result = document.execCommand("paste") ?
                undefined :
                {
                    code: "EUNKNOWN",
                    message: "Failed to write clipboard",
                };
            release();
            callback(result, copyTextEl.value);
        };
        if (window.navigator && navigator.clipboard) {
            var readClip = function(callback) {
                navigator.clipboard
                    .readText()
                    .then(function(text) {
                        callback(undefined, text);
                    })
                    .catch(callback);
            };
            var writeClip = function(text, callback) {
                navigator.clipboard
                    .writeText(text)
                    .then(function() {
                        callback();
                    })
                    .catch(callback);
            };
            var failCount = 0;
            Env.getClipboard = function(callback) {
                var passed;
                readClip(function(e, r) {
                    if (e) {
                        if (
                            failCount++ > 3 ||
                            e.message.indexOf("denied") > 0
                        ) {
                            Env.getClipboard = getClipExec;
                        }
                        if (passed === false) callback(e, r);
                        else passed = false;
                    } else {
                        Env.getClipboard = readClip;
                        if (!passed) {
                            passed = true;
                            callback(e, r);
                        }
                    }
                });
                getClipExec(function(e, r) {
                    if (!e && r) {
                        if (!passed) {
                            passed = true;
                            callback(e, r);
                        }
                    } else if (passed === false) callback(e, r);
                    else passed = false;
                });
            };
            Env.setClipboard = function(text, callback) {
                var passed;
                callback = callback || Utils.noop;
                writeClip(text, function(e, r) {
                    if (e) {
                        if (
                            failCount++ > 3 ||
                            e.message.indexOf("denied") > 0
                        ) {
                            Env.setClipboard = setClipExec;
                        }
                        if (passed === false) callback(e, r);
                        else passed = false;
                    } else {
                        Env.setClipboard = writeClip;
                        if (!passed) {
                            callback(e, r);
                            passed = true;
                        }
                    }
                });
                setClipExec(text, function(e, r) {
                    if (!e && r) {
                        if (!passed) {
                            passed = true;
                            callback(e, r);
                        }
                    } else if (passed === false) callback(e, r);
                    else passed = false;
                });
            };
        } else {
            Env.setClipboard = setClipExec;
            Env.getClipboard = getClipExec;
        }
    }
    //todo expose clipboard directly
    Object.assign(Functions, {
        copy: function(e, editor) {
            clipboard.set(e.text, true);
        },
    });

    function initEditor(e) {
        e.editor.on("copy", Functions.copy);
        //hack to get native clipboard content
        e.editor.on("paste", Functions.copy);
    }
    Editors.forEach(function() {
        editor.on("copy", Functions.copy);
        //hack to get native clipboard content
        editor.on("paste", Functions.copy);
    });
    Functions.initMultiClipboard = initEditor;
    appEvents.on("createEditor", initEditor);
    var MAX_CLIP_SIZE = Utils.parseSize("950kb");
    //wanted to avoid this but memory corruption errors
    function trimClip(clip) {
        var data;
        if (clip.length > 20) clip.pop();
        data = JSON.stringify(clip);
        if (data.length > MAX_CLIP_SIZE) {
            //not counting extra tokens such as escpae /, etc
            var needed = data.length-MAX_CLIP_SIZE;
            clip = clip.slice(0);
            var keys = clip.map(function(e, i) {
                return i;
            });
            keys.sort(function(a, b) {
                return (a - b) * 10000 + (clip[a].length - clip[b].length);
            });
            do {
                needed -= keys[0].length;
                data.splice(keys[0], 1);
            } while (clip.length && needed>0);
            data = JSON.stringify(clip);
        }
        return data;
    }
    clipboard.onchange = Utils.throttle(function(clip) {
        appStorage.setItem("clipboard", trimClip(clip));
    }, 40);

    var clipboardList = new BottomList("clipboard-list", clipboard._clip);
    Editors.addCommands([{
        name: "openClipboard",
        bindKey: {
            win: "Ctrl-Shift-V",
            mac: "Command-Shift-V",
        },
        exec: function() {
            clipboardList.show();
        },
    }, ]);
    clipboardList.on("select", function(ev) {
        //remove pasted index
        if (ev.index && clipboard.get(ev.index) == ev.item) {
            clipboard.delete(ev.index);
        }
        Functions.copy({
            text: ev.item,
        });
        getEditor().execCommand("paste", ev.item);
        clipboardList.hide();
    });

    var copyFilePath = {
        caption: "Copy File Path",
        onclick: function(ev) {
            if (ev.filepath && ev.browser.getParent) {
                var root = false;
                var a = ev.browser.getParent();
                while (a && a.rootDir) {
                    root = a.rootDir;
                    a = a.getParent();
                }
                clipboard.text = root ?
                    "./" + FileUtils.relative(root, ev.filepath) :
                    ev.filepath;
            } else clipboard.text = ev.filepath || ev.rootDir;
            ev.preventDefault();
        },
    };
    FileUtils.registerOption(
        "files",
        ["file", "folder"],
        "copy-file-path",
        copyFilePath
    );
    savedClip = null;
}); /*_EndDefine*/
