define(function (require, exports, module) {
    /*globals $*/
    /*
      An elaborate input system overhaul designed for the mundane irrelevant task
      of providing ctrl,alt and shift keys to users that choose not to have them
      using the tested and untrusted technique of hidden textareas
    */
    'use strict';
    var setImmediate = require('grace/core/utils').Utils.setImmediate;
    var appConfig = require('grace/core/config').Config.registerAll(
        {doubleClickIntervalMs: 500},
        'toolbars'
    );
    var RESET_CHAR = '\n\nmod-';
    var TAIL = '\n\n';
    var keys = require('ace!lib/keys');
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var appEvents = require('grace/core/app_events').AppEvents;
    var TextEdit = require('./textedit').TextEdit;
    var event = require('ace!lib/event');
    var times = {};
    var pressed = {};
    var held = {};
    var focus = FocusManager.focusIfKeyboard;
    var editor;
    var host;
    var closed = true;

    function addModifier(key) {
        var clickT = new Date().getTime();
        if (clickT - (times[key] || 0) < appConfig.doubleClickIntervalMs) {
            held[key] = 'double_tap';
            clickT = 0;
        } else {
            if (held[key] == 'double_tap') {
                pressed[key] = held[key] = false;
                clickT = 0;
            } else if (pressed[key]) {
                pressed[key] = false;
            } else {
                pressed[key] = true;
            }
        }
        times[key] = clickT;
        if (pressed[key] || held[key]) openModKey();
        if (!getHash()) {
            closeModKey();
        }
        triggerUpdate(key);
    }

    function getHash(clear) {
        var key = 0;
        if (pressed.shift || held.shift) key |= keys.KEY_MODS.shift;
        if (pressed.ctrl || held.ctrl) key |= keys.KEY_MODS.ctrl;
        if (pressed.alt || held.alt) key |= keys.KEY_MODS.alt;
        if (clear) {
            pressed = {};
            triggerUpdate();
        }
        return key;
    }

    //Acts as a proxy for input events in order not to mess up
    //ace's delicate input architecture
    var modKeyInput;

    function createModKeyInput() {
        modKeyInput = document.createElement('textarea');
        modKeyInput.style.opacity = 0.1;
        modKeyInput.style.width = '50px';
        modKeyInput.style.height = '50px';
        modKeyInput.style.top = '0px';
        modKeyInput.style.zIndex = '-1';
        modKeyInput.style.right = '0px';
        modKeyInput.setAttribute('name', 'mod-key-input');
        modKeyInput.style.position = 'absolute';
        event.addListener(modKeyInput, 'input', function (e) {
            var char = modKeyInput.value;
            if (char.startsWith(RESET_CHAR)) {
                char = char[RESET_CHAR.length];
                handleKey(
                    keys[char.toLowerCase()],
                    /[A-Z]/.test(char) ? keys.KEY_MODS.shift : 0,
                    char
                );
            } else if (RESET_CHAR.slice(0, -1) == char) {
                handleKey(keys.Backspace);
            }
            setSelection();
            e.stopPropagation();
            e.preventDefault();
        });
        document.body.appendChild(modKeyInput);
        event.addListener(modKeyInput, 'blur', handleBlur);
        event.addListener(modKeyInput, 'focus', handleFocus);
        event.addCommandKeyListener(modKeyInput, function (e, hashId, keyCode) {
            handleKey(keyCode, hashId);
            setSelection();
            e.stopPropagation();
            e.preventDefault();
        });
    }

    function setSelection(immediate) {
        modKeyInput.value = '';
        modKeyInput.value = RESET_CHAR + TAIL;
        modKeyInput.selectionStart = modKeyInput.selectionEnd =
            RESET_CHAR.length;
        if (!immediate) setImmediate(setSelection.bind(null, true));
    }

    function visualizeFocus() {
        if (closed) return;
        blurCount = 0;
        FocusManager.hintChangeFocus();
        modKeyInput.focus();
        if (host == editor.textInput.getElement()) {
            editor.renderer.showCursor();
            editor.renderer.visualizeFocus();
        } else {
            $(host).addClass('mod-key-enabled');
            //visualize Nah
        }
    }

    function openModKey() {
        var shifted = keys.KEY_MODS[getHash()] == 'shift-';
        var keepFocus =
            shifted &&
            (closed ? FocusManager.activeElement : host) !=
                editor.textInput.getElement();
        if (keepFocus) {
            if (closed) return;
            return closeModKey();
        }
        if (!closed) return focus(modKeyInput);
        closed = false;
        inExec = false;
        if (!modKeyInput) {
            createModKeyInput();
        }
        host = FocusManager.activeElement;
        if (!host || host == modKeyInput) {
            host = editor.textInput.getElement();
        }
        visualizeFocus();
        setSelection();
        setTimeout(visualizeFocus, 100);
    }

    function closeModKey(forced) {
        if (closed) return;
        closed = true;
        if (host != editor.textInput.getElement())
            $(host).removeClass('mod-key-enabled');
        if (forced) {
            pressed = {};
            held = {};
            triggerUpdate();
        }
        if (FocusManager.activeElement == modKeyInput) {
            focus(host);
            host = null;
        } // else wait for handleFocus
        if (FocusManager.activeElement != editor.textInput.getElement()) {
            editor.renderer.visualizeBlur();
        }
        modKeyInput.blur();
    }

    var inExec = false;
    var blurCount;
    var lastBlurTime = 0;

    function handleBlur(ev) {
        if (closed) return;
        var time = new Date().getTime();
        if (!ev || time - lastBlurTime < appConfig.doubleClickIntervalMs) {
            //two clicks force clears hash
            blurCount++;
        } else if (time - lastBlurTime > appConfig.doubleClickIntervalMs * 2)
            blurCount = 0;

        if (inExec || blurCount > 1) {
            closeModKey(true);
        } else {
            visualizeFocus();
            lastBlurTime = time;
        }
    }

    function handleFocus() {
        if (closed) {
            host = host || editor.textInput.getElement();
            focus(host);
        }
    }

    function handleKey(keyCode, hashId, keyString) {
        if (closed) handleFocus();
        hashId |= getHash(keyCode > -1);

        if (!getHash()) {
            if (/A-Za-z/.test(keyString)) closeModKey();
            else {
                //keyup events are sent to next focus
                //if we close immediately
                setImmediate(closeModKey);
                $(modKeyInput).one('keyup', closeModKey);
            }
        }
        if (hashId) {
            if (host != editor.textInput.getElement()) {
                var defaultAction =
                    defaultHandler[keys.KEY_MODS[hashId] + keys[keyCode]];
                if (defaultAction) {
                    defaultAction();
                    closeModKey(true);
                } else {
                    inExec = true;
                    fireKey(host, keyCode, keys.KEY_MODS[hashId]);
                    blurCount = 0;
                    lastBlurTime = 0;
                    inExec = false;
                }
                return;
            }
            var command = clipboardHandler.findKeyCommand(
                hashId,
                keys[keyCode]
            );
            inExec = true;
            if (command && command.exec) {
                command.exec(editor);
            } else
                command = editor.keyBinding.onCommandKey(null, hashId, keyCode);
            inExec = false;
            if (command) {
                lastBlurTime = 0;
                blurCount = 0;
            } else if (
                held.shift == 'double_tap' ||
                held.ctrl == 'double_tap' ||
                held.alt == 'double_tap'
            ) {
                handleBlur();
            }
        } else if (keyString) {
            //editor.keyBinding.onTextInput(keyString);
        }
    }

    function fireKey(el, keyCode, modifier) {
        var eventObj;
        if (document.createEventObject) {
            eventObj = document.createEventObject();
            eventObj.keyCode = keyCode;
            modifier &&
                modifier.split('-').map(function (m) {
                    if (m) eventObj[m + 'Key'] = true;
                });
            el.fireEvent('onkeydown', eventObj);
            eventObj.keyCode = keyCode;
        } else if (document.createEvent) {
            eventObj = document.createEvent('Events');
            eventObj.initEvent('keydown', true, true);
            eventObj.which = keyCode;
            eventObj.keyCode = keyCode;
            modifier &&
                modifier.split('-').map(function (m) {
                    if (m) eventObj[m + 'Key'] = true;
                });
            el.dispatchEvent(eventObj);
        }
    }

    //Handle left and right arrow keys
    var cursorSwapped = false;

    function handleArrowKey(key, target, modifier) {
        //don't know why I bother
        if (target == modKeyInput) {
            target = host;
        }
        var selection = [target.selectionStart, target.selectionEnd];
        var direction = key == 'left' ? 1 : -1;
        if (!modifier) {
            if (selection[0] == selection[1]) {
                if (selection[0] >= direction) {
                    selection[0] -= direction;
                    selection[1] = selection[0];
                }
            } else if (direction < 1) {
                selection[0] = selection[1];
            } else selection[1] = selection[0];
        } else if (modifier == 'shift-') {
            var start = cursorSwapped ? 1 : 0;
            if (selection[start] >= direction) selection[start] -= direction;
            if (selection[0] > selection[1]) {
                var b = selection[0];
                cursorSwapped = true;
                selection[0] = selection[1];
                selection[1] = b;
            } else if (cursorSwapped && selection[0] == selection[1]) {
                cursorSwapped = false;
            }
        }
        target.selectionStart = selection[0];
        target.selectionEnd = selection[1];

        fireKey(target, keys[key], modifier);
        if (target != editor.textInput.getElement()) {
            if (modifier && modifier != 'shift-') {
                return;
            }
            closeModKey(true); //so user can see selection
            triggerUpdate();
        }
    }

    var listener;
    function triggerUpdate(key) {
        if (listener) listener(key, {held: held, pressed: pressed});
    }

    var clipboard;
    var defaultHandler = {
        'ctrl-c': function () {
            clipboard.text = TextEdit.from(host).selection();
        },
        'ctrl-v': function () {
            clipboard.get(function (text) {
                var t = TextEdit.from(host);
                t.insert(text, true);
                t.commit();
            });
        },
        'ctrl-a': function () {
            host.selectionStart = 0;
            host.selectionEnd = host.value.length;
        },
        'ctrl-x': function () {
            var t = TextEdit.from(host);
            clipboard.text = t.selection();
            t.delete(0);
            t.commit();
        },
    };

    var editorHandler = {
        'ctrl-c': function () {
            editor.once('copy', function (e) {
                clipboard.set(e.text);
            });
            editor.getCopyText();
        },
        'ctrl-x': function doCut() {
            editorHandler['ctrl-c']();
            editor.execCommand('cut');
        },
        'ctrl-v': function doPaste() {
            clipboard.get(0, function (text) {
                editor.execCommand('paste', text);
            });
        },
    };
    var clipboardHandler = new (require('ace!keyboard/hash_handler').HashHandler)();
    clipboardHandler.bindKeys(editorHandler);
    appEvents.on('sidenavClosed', function () {
        closeModKey(true);
    });

    exports.Mods = {
        clear: function () {
            closeModKey(true);
        },
        press: addModifier,
        dispatch: function (key) {
            var target = FocusManager.activeElement;
            if (!target) target = editor.textInput.getElement();
            var modifier = keys.KEY_MODS[getHash(true)];
            if (key == 'left' || key == 'right') {
                handleArrowKey(key, target, modifier);
            } else fireKey(target, keys[key], modifier);
        },
        handleClipboard: function (action) {
            //Depends on ext/enhanced_clipboard.js
            //to call setClipboard
            var handler = defaultHandler;
            if (closed) {
                host = FocusManager.activeElement;
            }
            if (
                !host ||
                host == editor.textInput.getElement() ||
                !FocusManager.isFocusable(host)
            ) {
                handler = editorHandler;
            }
            switch (action) {
                case 'copy':
                    return handler['ctrl-c']();
                case 'cut':
                    return handler['ctrl-x']();
                case 'paste':
                    return handler['ctrl-v']();
            }
        },
        setEditor: function (e) {
            editor = e;
        },
        setClipboard: function (e) {
            clipboard = e;
        },
        setChangeListener: function (cb) {
            listener = cb;
        },
        stopHold: function (touchID) {
            for (var i in held) {
                if (touchID) {
                    if (held[i] == touchID) {
                        held[i] = false;
                    }
                } else if (held[i] != 'double_tap') held[i] = false;
            }
            if (!getHash(false)) closeModKey();
            triggerUpdate();
        },
        startHold: function (key, touchID) {
            if (!held[key]) {
                held[key] = touchID;
                setTimeout(function () {
                    if (held[key] && closed) {
                        openModKey();
                        triggerUpdate(key);
                    }
                }, 250);
            }
        },
    };
});
