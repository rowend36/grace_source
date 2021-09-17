_Define(function(global) {
    "use strict";
    global.MultiClipboard = function() {
        if (this) {
            this._clip = [];
        }
    };
    global.MultiClipboard.prototype = {
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
            this._clip.length = 0;
            if (this.onchange) this.onchange(this._clip, "clear");
        },
        set text(text) {
            this.set(text);
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
    var Utils = global.Utils;
    var BottomList = global.BottomList;
    var appEvents = global.AppEvents;
    var Editors = global.Editors;
    var Mods = global.Mods;

    //ClipBoard
    var clipboard = new global.MultiClipboard();
    global.clipboard = clipboard;
    Object.defineProperty(window, "Clip", {
        value: clipboard,
    });
    var savedClip = global.getObj("clipboard", []);
    if (savedClip.length) {
        clipboard._clip = savedClip;
    }
    Mods.setClipboard(clipboard);
    var copyTextEl;

    if (!Env.setClipboard) {
        /**@type {Function?} useCopyArea*/
        var useCopyArea = function() {
            copyTextEl = document.createElement("textarea");
            document.body.appendChild(copyTextEl);
            copyTextEl.readOnly = true;
            copyTextEl.setAttribute("autocomplete", "off");
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
            console.log('visiting');
            var release = FocusManager.visit(copyTextEl, true);
            var result = document.execCommand("copy") ?
                undefined : global.createError({
                    code: "EUNKNOWN",
                    message: "Failed to write clipboard",
                });
            console.log('releasing');
            release();
            callback && callback(result);
        };
        var getClipExec = function(callback) {
            var release = FocusManager.visit(copyTextEl, true);
            copyTextEl.focus();
            copyTextEl.value = "";
            var result = document.execCommand("paste") ?
                undefined : global.createError({
                    code: "EUNKNOWN",
                    message: "Failed to write clipboard",
                });
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

    function initEditor(e) {
        //hack to get native clipboard content
        e.editor.commands.on('exec', function(e) {
            if (e.command.name == "cut" || e.command.name == "copy") {
                clipboard.set(e.editor.getCopyText(), true);

            } else if (e.command.name == "paste") {
                clipboard.set(e.args.text, true);
            }
        });
        e.editor.on("menuClick", function(e, editor) {
            switch (e.action) {
                case "copy":
                case "cut":
                    clipboard.set(editor.getCopyText());
                    break;
                case "paste":
                    clipboard.get(0, function(text) {
                        editor.execCommand(e.action, text || "");
                    });
                    break;
                default:
                    return;
            }
            e.preventDefault();
        });
    }
    Editors.forEach(function(editor) {
        initEditor({
            editor: editor
        });
    });
    appEvents.on("createEditor", initEditor);
    var MAX_CLIP_SIZE = Utils.parseSize("950kb");
    //wanted to avoid this but memory corruption errors
    function trimClip(clip) {
        var data;
        if (clip.length > 20) clip.pop();
        data = JSON.stringify(clip);
        if (data.length > MAX_CLIP_SIZE) {
            //not counting extra tokens such as escpae /, etc
            var needed = data.length - MAX_CLIP_SIZE;
            clip = clip.slice(0);
            var indices = clip.map(function(e, i) {
                return i;
            });
            indices.sort(function(a, b) {
                return (a - b) * 10000 + (clip[a].length - clip[b].length);
            });
            do {
                needed -= indices[0].length;
                clip.splice(indices[0], 1);
            } while (clip.length && needed > 0);
            data = JSON.stringify(clip);
        }
        return data;
    }
    clipboard.onchange = Utils.throttle(function(clip) {
        appStorage.setItem("clipboard", trimClip(clip));
    }, 40);

    var clipboardList = new BottomList("clipboard-list", clipboard._clip);
    clipboardList.headerText = 'Multi Clipboard';
    Editors.addCommands([{
        name: "openClipboard",
        bindKey: {
            win: "Ctrl-Shift-V",
            mac: "Command-Shift-V",
        },
        exec: function() {
            clipboardList.show();
        },
    }, {
        name: "pushIntoClipboard",
        bindKey: {
            win: "Ctrl-Alt-C",
            mac: "Command-Alt-C",
        },
        exec: function(editor) {
            editor.forEachSelection(function() {
                clipboard._clip.unshift(editor.getCopyText());
            });
            clipboard.set(clipboard._clip[0]);
        },
    }, {
        name: "pasteFromClipboard",
        bindKey: {
            win: "Ctrl-Alt-V",
            mac: "Command-Alt-V",
        },
        exec: function(editor, args) {
            var ranges = editor.selection.getAllRanges();
            var allowEmpty = !ranges.some(function(e){
                return !e.isEmpty();
            });
            var pos = ranges.length - 1;
            editor.forEachSelection(function() {
                var text = clipboard._clip[pos] || clipboard._clip[0] || "";
                if (args && args.swap){
                    clipboard.delete(pos);
                    var newText = editor.getSelectedText();
                    if(newText || allowEmpty)
                        clipboard._clip.splice(pos,0,newText||"");
                }
                pos--;
                editor.insert(text,true);
            });
            clipboard.set(clipboard._clip[0]);
        },
    }, {
        name: "swapIntoClipboard",
        bindKey: {
            win: "Ctrl-Alt-X",
            mac: "Command-Alt-X",
        },
        exec: function(editor) {
            editor.execCommand('pasteFromClipboard',{swap:true});
        },
    }]);
    clipboardList.on("select", function(ev) {
        //remove pasted index
        if (ev.index && clipboard.get(ev.index) == ev.item) {
            clipboard.delete(ev.index);
        }
        clipboardList.hide(); //return focus
        clipboard.set(ev.item);
        Mods.handleClipboard('paste');
    });
    clipboardList.on("clear", function( /*ev*/ ) {
        clipboard.onchange(clipboardList.items);
    });
    var copyFilePath = {
        caption: "Copy File Path",
        onclick: function(ev) {
            ev.preventDefault();
            var marked = ev.marked ? ev.marked.map(ev.browser.childFilePath, ev.browser) : null;
            if (!marked && !ev.filepath) return;
            if (ev.browser.getParent) {
                var root = false;
                var a = ev.browser.getParent();
                while (a && a.rootDir) {
                    root = a.rootDir;
                    a = a.getParent();
                }
                if (root) {
                    return (clipboard.text =
                        "./" + marked ?
                        marked.map(FileUtils.relative.bind(null, root)).join(",") :
                        FileUtils.relative(root, ev.filepath));
                }
            }
            return (clipboard.text = marked ? marked.join(",") : ev.filepath || ev.rootDir);
        }
    };
    FileUtils.registerOption(
        "files",
        ["file", "folder"],
        "copy-file-path",
        copyFilePath
    );
    savedClip = null;
}); /*_EndDefine*/
