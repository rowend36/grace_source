define(function (require, exports, module) {
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Actions = require('grace/core/actions').Actions;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var Utils = require('grace/core/utils').Utils;
    var Editors = require('grace/editor/editors').Editors;
    var Mods = require('grace/ext/editor/mods').Mods;
    var MultiClipboard = require('./multi_clipboard').MultiClipboard;
    var Depend = require('grace/core/depend');
    var getObj = require('grace/core/config').Config.getObj;
    var putObj = require('grace/core/config').Config.putObj;
    //ClipBoard
    var clipboard = new MultiClipboard();
    exports.clipboard = clipboard;
    Object.defineProperty(window, 'Clip', {
        value: clipboard,
    });
    var savedClip = getObj('clipboard', []);
    if (savedClip.length) {
        clipboard._clip = savedClip;
    }
    Mods.setClipboard(clipboard);
    var copyTextEl;

    if (!Env.setClipboard) {
        /**@type {Function?} useCopyArea*/
        var useCopyArea = function () {
            copyTextEl = document.createElement('textarea');
            document.body.appendChild(copyTextEl);
            copyTextEl.readOnly = true;
            copyTextEl.setAttribute('autocomplete', 'off');
            copyTextEl.tabIndex = -1;
            copyTextEl.style.opacity = '0';
            copyTextEl.style.position = 'absolute';
            copyTextEl.style.tabIndex = -1;
            copyTextEl.style.height = '1px';
            copyTextEl.style.width = '1px';
            copyTextEl.style.top = '-100vh';
            useCopyArea = null;
        };
        useCopyArea();
        var setClipExec = function (text, callback) {
            copyTextEl.value = text;
            copyTextEl.selectionStart = 0;
            copyTextEl.selectionEnd = text.length;
            var release = FocusManager.visit(copyTextEl, true);
            var result = document.execCommand('copy')
                ? undefined
                : FileUtils.createError({
                      code: 'EUNKNOWN',
                      message: 'Failed to write clipboard',
                  });
            release();
            callback && callback(result);
        };
        var getClipExec = function (callback) {
            var release = FocusManager.visit(copyTextEl, true);
            copyTextEl.focus();
            copyTextEl.value = '';
            var result = document.execCommand('paste')
                ? undefined
                : FileUtils.createError({
                      code: 'EUNKNOWN',
                      message: 'Failed to write clipboard',
                  });
            release();
            callback(result, copyTextEl.value);
        };
        if (window.navigator && navigator.clipboard) {
            var readClip = function (callback) {
                navigator.clipboard
                    .readText()
                    .then(function (text) {
                        callback(undefined, text);
                    })
                    .catch(callback);
            };
            var writeClip = function (text, callback) {
                navigator.clipboard
                    .writeText(text)
                    .then(function () {
                        callback();
                    })
                    .catch(callback);
            };
            var failCount = 0;
            Env.getClipboard = function (callback) {
                var passed;
                readClip(function (e, r) {
                    if (e) {
                        if (
                            failCount++ > 3 ||
                            e.message.indexOf('denied') > 0
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
                getClipExec(function (e, r) {
                    if (!e && r) {
                        if (!passed) {
                            passed = true;
                            callback(e, r);
                        }
                    } else if (passed === false) callback(e, r);
                    else passed = false;
                });
            };
            Env.setClipboard = function (text, callback) {
                var passed;
                callback = callback || Utils.noop;
                writeClip(text, function (e, r) {
                    if (e) {
                        if (
                            failCount++ > 3 ||
                            e.message.indexOf('denied') > 0
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
                setClipExec(text, function (e, r) {
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

    Editors.onEach(function initEditor(editor) {
        //hack to get native clipboard content
        editor.commands.on('exec', function (e) {
            if (e.command.name == 'cut' || e.command.name == 'copy') {
                clipboard.set(e.editor.getCopyText(), true);
            } else if (e.command.name == 'paste') {
                clipboard.set(e.args.text, true);
            }
        });
        editor.on('menuClick', function (e, editor) {
            switch (e.action) {
                case 'copy':
                case 'cut':
                    clipboard.set(editor.getCopyText());
                    editor.execCommand(e.action);
                    break;
                case 'paste':
                    clipboard.get(0, function (text) {
                        editor.execCommand(e.action, text || '');
                    });
                    break;
                default:
                    return;
            }
            e.preventDefault();
        });
    });
    var MAX_CLIP_SIZE = Utils.parseSize('950kb');

    function trimClip(clip) {
        while (clip.length > 20) clip.pop();
        for (var i = 0, size = 0; i < clip.length; i++) {
            size += clip[i].length;
        }
        if (size > MAX_CLIP_SIZE) {
            //not counting extra tokens such as escpae /, etc
            var needed = size - MAX_CLIP_SIZE;
            clip = clip.slice(0);
            var indices = clip.map(function (e, i) {
                return i;
            });
            indices.sort(function (a, b) {
                return (a - b) * 10000 + (clip[a].length - clip[b].length);
            });
            do {
                needed -= indices[0].length;
                clip.splice(indices[0], 1);
            } while (clip.length && needed > 0);
        }
        return clip;
    }
    clipboard.onchange = Utils.delay(function (clip) {
        putObj('clipboard', trimClip(clip));
    }, 40);

    var clipboardList;
    Actions.addActions([
        {
            name: 'softClipboardOpen',
            bindKey: {
                win: 'Ctrl-Shift-V',
                mac: 'Command-Shift-V',
            },
            exec: Depend.after(
                function (done) {
                    require(['./clipboard_list'], function (mod) {
                        clipboardList = new mod.ClipboardList(
                            'clipboard-list',
                            clipboard._clip
                        );
                        clipboardList.headerText = 'Multi Clipboard';
                        clipboardList.on('select', function (ev) {
                            //remove pasted index
                            if (
                                ev.index &&
                                clipboard.get(ev.index) == ev.item
                            ) {
                                clipboard.delete(ev.index);
                            }
                            clipboardList.hide(); //return focus
                            clipboard.set(ev.item);
                            Mods.handleClipboard('paste');
                        });
                        clipboardList.on('clear', function (/*ev*/) {
                            clipboard.onchange(clipboardList.items);
                        });
                        done();
                    });
                },
                function () {
                    clipboardList.show();
                }
            ),
        },
        {
            name: 'softClipboardCopy',
            bindKey: {
                win: 'Ctrl-Alt-C',
                mac: 'Command-Alt-C',
            },
            exec: function (editor) {
                editor.forEachSelection(function () {
                    clipboard._clip.unshift(editor.getCopyText());
                });
                clipboard.set(clipboard._clip[0]);
            },
        },
        {
            name: 'softClipboardCut',
            bindKey: {
                win: 'Ctrl-Alt-X',
                mac: 'Command-Alt-X'
            },
            exec: function(editor){
                editor.execCommand('softClipboardCopy');
                editor.execCommand('cut');
            }
        },
        {
            name: 'softClipboardPaste',
            bindKey: {
                win: 'Ctrl-Alt-V',
                mac: 'Command-Alt-V',
            },
            exec: function (editor, args) {
                var ranges = editor.selection.getAllRanges();
                //Cut empty text only if one range has a something selected.
                var allowEmpty = !ranges.some(function (e) {
                    return !e.isEmpty();
                });
                var pos = ranges.length - 1;
                editor.forEachSelection(function () {
                    var text = clipboard._clip[pos] || clipboard._clip[0] || '';
                    if (args && args.remove) {
                        clipboard.delete(pos);
                        if(args.replace){
                            var newText = editor.getSelectedText();
                            if (newText || allowEmpty) clipboard._clip.splice(pos, 0, newText || '');
                        } else pos++;
                    }
                    pos--;
                    editor.insert(text, true);
                });
                clipboard.set(clipboard._clip[0]);
            },
        },
        {
            name: 'softClipboardPop',
            bindKey: {
                win: 'Ctrl-Alt-Y',
                mac: 'Command-Alt-Y',
            },
            exec: function (editor) {
                clipboard.delete(0);
                clipboard.set(clipboard._clip[0]);
            },
        },
    ]);
    Actions.addAction({
        caption: 'Copy file path',
        showIn: ['editor', 'fileview.file', 'fileview.folder'],
        handle: function (ev) {
            ev.preventDefault();
            var marked = ev.marked;
            if (!ev.marked && !ev.filepath) return;
            if (ev.fileview && ev.fileview.getParent) {
                var root = false;
                var a = ev.fileview.getParent();
                while (a && a.rootDir) {
                    root = a.rootDir;
                    a = a.getParent();
                }
                if (root) {
                    return (clipboard.text =
                        './' + marked
                            ? marked
                                  .map(FileUtils.relative.bind(null, root))
                                  .join(',')
                            : FileUtils.relative(root, ev.filepath));
                }
            }
            return (clipboard.text = marked
                ? marked.join(',')
                : ev.filepath || ev.rootDir);
        },
    });

    savedClip = null;
}); /*_EndDefine*/
