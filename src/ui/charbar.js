_Define(function(global) {
    global.TextEdit = {
        cursorPos: 0,
        data: 0,
        selectionStart: 0,
        selectionEnd: 0,
        indent: "",
        target: null,
        commit: function() {
            this.target.value = this.data;
            this.target.selectionStart = this.selectionStart;
            this.target.selectionEnd = this.selectionEnd;
            if (window.InputEvent) {
                this.target.dispatchEvent(
                    new window.InputEvent("input", {
                        data: this.data /*unneeded*/ ,
                    })
                );
            } else {
                $(this.target).trigger('input');
            }
        },
        wordBefore: function() {
            var word = /[\w\$\-]+$/.exec(this.data.substring(0, this.selectionStart));
            if (word) return word[0];
            return "";
        },
        selection: function() {
            return this.data.substring(this.selectionStart, this.selectionEnd);
        },
        moveAnchor: function(offset) {
            this.selectionStart = Math.min(Math.max(0, this.selectionStart + offset), this.data.length);
        },
        moveCursor: function(offset, collapse) {
            this.selectionEnd = Math.min(Math.max(0, this.selectionEnd + offset), this.data.length);
            if (collapse) this.selectionEnd = this.selectionStart;
        },
        insert: function(text) {
            this.data = this.data.substring(0, this.selectionStart) +
                text +
                this.data.substring(this.selectionEnd);
            this.selectionEnd = this.selectionStart = this.selectionStart + text.length;
        },
        delete: function(numChars) {
            numChars = Math.min(numChars, this.selectionStart);
            this.data = this.data.substring(0, this.selectionStart - numChars) +
                this.data.substring(this.selectionEnd);
            this.selectionEnd = this.selectionStart = this.selectionStart - numChars;
        },
        from: function(textArea) {
            var env = textArea.parentElement.env;
            var edit;
            if (env) {
                edit = Object.create(AceTextEdit);
                edit.editor = env.editor;
                edit.doc = env.editor.session.getDocument();
            } else {
                edit = Object.create(this);
                edit.selectionStart = textArea.selectionStart;
                edit.selectionEnd = textArea.selectionEnd;
                edit.data = textArea.value || "";
                edit.target = textArea;
            }
            return edit;
        }
    };

    var AceTextEdit = {};
    AceTextEdit._insert = function(text, pasted) {
        this.editor.insert(text, pasted);
    };
    AceTextEdit._delete = function(num) {
        //dont allow behaviours here
        var selection = this.editor.selection;
        var range = selection.getRange();
        range.start.column -= num;
        this.doc.remove(range);
    };
    AceTextEdit._moveCursor = function(num, collapse) {
        var selection = this.editor.selection;
        var range = selection.getRange();
        var pos = range.end;
        var endOfLine = this.doc.getLine(pos.row).length;
        var dir = Math.sign(num);
        num = Math.abs(num);
        while (num > 0) {
            pos.column += dir;
            num--;
            if (pos.column > 0 && pos.column < endOfLine) continue;
            if (pos.column < 0) {
                pos.row--;
            }
            if (pos.column > endOfLine) {
                pos.row++;
            }
            endOfLine = this.doc.getLine(pos.row);
            pos.column = dir > 0 ? 0 : endOfLine;
        }
        if (collapse)
            selection.setRange({
                start: pos,
                end: pos
            });
        else selection.setRange(range);
    };
    AceTextEdit._moveAnchor = function(num) {
        var selection = this.editor.selection;
        var range = selection.getRange();
        var pos = range.start;
        var endOfLine = this.doc.getLine(pos.row).length;
        var dir = Math.sign(num);
        num = Math.abs(num);
        while (num > 0) {
            pos.column += dir;
            num--;
            if (pos.column > 0 && pos.column < endOfLine) continue;
            if (pos.column < 0) {
                pos.row--;
            }
            if (pos.column > endOfLine) {
                pos.row++;
            }
            endOfLine = this.doc.getLine(pos.row);
            pos.column = dir > 0 ? 0 : endOfLine;
        }
        selection.setRange(range);
    };
    AceTextEdit.insert = function(text, pasted) {
        this.editor.forEachSelection(this._insert.bind(this, text, pasted));
    };
    AceTextEdit.delete = function(num) {
        this.editor.forEachSelection(this._delete.bind(this, num));
    };
    AceTextEdit.moveCursor = function(num, collapse) {
        this.editor.forEachSelection(this._moveCursor.bind(this, num, collapse));
    };
    AceTextEdit.moveAnchor = function(num) {
        this.editor.forEachSelection(this._moveAnchor.bind(this, num));
    };
    AceTextEdit.wordBefore = function() {
        var range = this.editor.selection.getRange();
        var line = this.doc.getLine(range.start.row).substring(0, range.start.column);
        var word = /[\w\$\-]+$/.exec(line);
        if (word) return word[0];
        return "";
    };
    AceTextEdit.selection = function() {
        return this.doc.getTextRange(this.editor.selection.getRange());
    };
    AceTextEdit.commit = global.Utils.noop;
});
_Define(function(global) {
    /*
      An elaborate input system overhaul designed for the mundane irrelaevant task
      of providing ctrl,alt and shift keys to users that choose not to have them
      using the tested and untrusted technique of hidden textareas
    */
    "use strict";
    var setImmediate = global.Utils.setImmediate;
    var appConfig = global.registerAll({}, 'toolbars');
    var RESET_CHAR = "\n\nmod-";
    var TAIL = "\n\n";
    var keys = global.keys;
    var FocusManager = global.FocusManager;
    var TextEdit = global.TextEdit;
    var event = global.event;
    var times = {};
    var pressed = {};
    var held = {};
    var focus = FocusManager.focusIfKeyboard;
    var editor;
    var host;
    var toolbar = $("");
    var closed = true;

    function addModifier(key, target) {
        var clickT = new Date().getTime();
        if (clickT - (times[key] || 0) < appConfig.characterBarDoubleClickIntervalMs) {
            held[key] = "double_tap";
            clickT = 0;
        } else {
            if (held[key] == "double_tap") {
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
        if (!(getHash())) {
            closeModKey();
        }
        updateModColors(target, key);
    }

    function getHash(clear) {
        var key = 0;
        if (pressed.shift || held.shift) key |= keys.KEY_MODS.shift;
        if (pressed.ctrl || held.ctrl) key |= keys.KEY_MODS.ctrl;
        if (pressed.alt || held.alt) key |= keys.KEY_MODS.alt;
        if (clear) {
            pressed = {};
            updateModColors();
        }
        return key;
    }

    //Acts as a proxy for input events in order not to mess up
    //ace's delicate input architecture
    var modKeyInput;

    function createModKeyInput() {
        modKeyInput = document.createElement("textarea");
        modKeyInput.style.opacity = 0.1;
        modKeyInput.style.width = "50px";
        modKeyInput.style.height = "50px";
        modKeyInput.style.top = "0px";
        modKeyInput.style.zIndex = "-1";
        modKeyInput.style.right = "0px";
        modKeyInput.setAttribute("name", "mod-key-input");
        modKeyInput.style.position = "absolute";
        event.addListener(modKeyInput, "input", function(e) {
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
        event.addListener(modKeyInput, "blur", handleBlur);
        event.addListener(modKeyInput, "focus", handleFocus);
        event.addCommandKeyListener(
            modKeyInput,
            function(e, hashId, keyCode) {
                handleKey(keyCode, hashId);
                setSelection();
                e.stopPropagation();
                e.preventDefault();
            }
        );
    }

    function setSelection(immediate) {
        modKeyInput.value = "";
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
            $(host).addClass("mod-key-enabled");
            //visualize Nah
        }
    }

    function openModKey() {
        var shifted = keys.KEY_MODS[getHash()] == "shift-";
        var keepFocus = shifted && ((closed ? FocusManager.activeElement : host) != editor.textInput
            .getElement());
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
            $(host).removeClass("mod-key-enabled");
        if (forced) {
            pressed = {};
            held = {};
            updateModColors();
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
        if (!ev || time - lastBlurTime < appConfig.characterBarDoubleClickIntervalMs) {
            //two clicks force clears hash
            blurCount++;
        } else if (time - lastBlurTime > appConfig.characterBarDoubleClickIntervalMs * 2)
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
                $(modKeyInput).one("keyup", closeModKey);
            }
        }
        if (hashId) {
            if (host != editor.textInput.getElement()) {
                var defaultAction = defaultHandler[keys.KEY_MODS[hashId] + keys[keyCode]];
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
                command = editor.keyBinding.onCommandKey(
                    null,
                    hashId,
                    keyCode
                );
            inExec = false;
            if (command) {
                lastBlurTime = 0;
                blurCount = 0;
            } else if (
                held.shift == "double_tap" ||
                held.ctrl == "double_tap" ||
                held.alt == "double_tap"
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
                modifier.split("-").map(function(m) {
                    if (m) eventObj[m + "Key"] = true;
                });
            el.fireEvent("onkeydown", eventObj);
            eventObj.keyCode = keyCode;
        } else if (document.createEvent) {
            eventObj = document.createEvent("Events");
            eventObj.initEvent("keydown", true, true);
            eventObj.which = keyCode;
            eventObj.keyCode = keyCode;
            modifier &&
                modifier.split("-").map(function(m) {
                    if (m) eventObj[m + "Key"] = true;
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
        var direction = key == "left" ? 1 : -1;
        if (!modifier) {
            if (selection[0] == selection[1]) {
                if (selection[0] >= direction) {
                    selection[0] -= direction;
                    selection[1] = selection[0];
                }
            } else if (direction < 1) {
                selection[0] = selection[1];
            } else selection[1] = selection[0];
        } else if (modifier == "shift-") {
            var start = cursorSwapped ? 1 : 0;
            if (selection[start] >= direction)
                selection[start] -= direction;
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
            if (modifier && modifier != "shift-") {
                return;
            }
            closeModKey(true); //so user can see selection
            updateModColors();
        }
    }

    //Remember when stupid previous regex code cost me hours of debugging, tip: if you put enough spaces spaces (like 10000) in a className, it changes something 
    function setCls(name, cls, yes) {
        yes = !!yes;
        var i = name.indexOf(cls);
        if (yes === (i < 0)) {
            if (yes)
                name.push(cls);
            else name.splice(i, 1);
        }
    }

    function updateModColors(target, key) {
        if (target) {
            var isMod = key == 'ctrl' || key == 'alt' || key == 'shift';
            var name = target.className.split(" ");
            setCls(name, "mod-key-held", held[key]);
            setCls(name, "mod-key-active", !isMod || pressed[key] && !held[key]);
            setCls(name, "color-inactive", isMod && !(held[key] || pressed[key]));
            target.className = name.join(" ").replace("  ", " "); //:)
        } else {
            var all = toolbar.find(".mod-key");
            for (var i = 0; i < all.length; i++) {
                updateModColors(all[i], all[i].getAttribute("id"));
            }
        }
    }

    var clipboard;
    var defaultHandler = {
        "ctrl-c": function() {
            clipboard.text = TextEdit.from(host).selection();
        },
        "ctrl-v": function() {
            clipboard.get(function(text) {
                var t = TextEdit.from(host);
                t.insert(text, true);
                t.commit();
            });
        },
        "ctrl-a": function() {
            host.selectionStart = 0;
            host.selectionEnd = host.value.length;
        },
        "ctrl-x": function() {
            var t = TextEdit.from(host);
            clipboard.text = t.selection();
            t.delete(0);
            t.commit();
        }
    };

    var editorHandler = {
        'ctrl-c': function() {
            editor.once("copy", function(e) {
                clipboard.set(e.text);
            });
            editor.getCopyText();
        },
        'ctrl-x': function doCut() {
            editorHandler['ctrl-c']();
            editor.execCommand("cut");
        },
        'ctrl-v': function doPaste() {
            clipboard.get(0, function(text) {
                editor.execCommand("paste", text);
            });
        }
    };
    var clipboardHandler = new global.HashHandler();
    clipboardHandler.bindKeys(editorHandler);

    global.Mods = {
        clear: function() {
            closeModKey(true);
        },
        press: addModifier,
        dispatch: function(key) {
            var target =
                FocusManager.activeElement;
            if (!target)
                target = editor.textInput.getElement();
            var modifier = keys.KEY_MODS[getHash(true)];
            if (key == 'left' || key == 'right') {
                handleArrowKey(key, target, modifier);
            } else fireKey(target, keys[key], modifier);
        },
        handleClipboard: function(action) {
            //Depends on tools/enhanced_clipboard.js
            //to call setClipboard
            var handler = defaultHandler;
            if (closed) {
                host = FocusManager.activeElement;
            }
            if (!host || host == editor.textInput.getElement() || !FocusManager.isFocusable(host)) {
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
        setEditor: function(e) {
            editor = e;
        },
        setClipboard: function(e) {
            clipboard = e;
        },
        setToolbar: function(e) {
            toolbar = e || $("");
            updateModColors();
        },
        stopHold: function(touchID) {
            for (var i in held) {
                if (touchID) {
                    if (held[i] == touchID) {
                        held[i] = false;
                    }
                } else if (held[i] != "double_tap") held[i] = false;
            }
            if (!(getHash(false))) closeModKey();
            updateModColors();
        },
        startHold: function(key, touchID, target) {
            if (!held[key]) {
                held[key] = touchID;
                setTimeout(function() {
                    if (held[key] && closed) {
                        openModKey();
                        updateModColors(target[0], key);
                    }
                }, 250);
            }
        },
    };
});
_Define(function(global) {
    //swipe to open
    var TextEdit = global.TextEdit;
    var Mods = global.Mods;
    //Could just use Hammer for these
    var SwipeDetector = function(bottomBar, updateBar) {
        "use strict";
        var startTimeT = 0;
        var startX = 0,
            startY = 0,
            originalStartY = 0;
        var swipeConfig = {
            swipeThreshold: 0.7,
            distanceThreshold: 30,
            dragThreshold: 100,
            failThreshold: 100,
        };
        var swipeDetected = false;
        var swipeFailed = false;

        function startSwipe(e) {
            if (e.originalEvent.touches) {
                e = e.originalEvent.touches[0];
            }
            originalStartY = e.clientY;
            startTimeT = new Date().getTime();
            startY = originalStartY;
            startX = e.clientX;
            swipeDetected = false;
            swipeFailed = false;
        }

        function detectSwipe(e) {
            if (swipeFailed || swipeDetected) {
                return;
            }
            var t = e.timeStamp;
            if (e.originalEvent.touches) {
                e = e.originalEvent.touches[0];
            }
            var l = e.clientY;
            var m = e.clientX;
            if (t - startTimeT < 500) {
                var dy = l - startY;
                var dx = m - startX;
                var dragT = Math.abs(l - originalStartY);
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (Math.abs(dx) > Math.abs(dy) * 3) swipeFailed = true;
                    //
                } else if (dragT > swipeConfig.distanceThreshold) {
                    var vt = Math.abs(dy / (t - startTimeT));
                    if (
                        vt > swipeConfig.swipeThreshold ||
                        dragT > swipeConfig.dragThreshold
                    ) {
                        swipeDetected = true;
                        if (dy < 0 && !bottomBar.hasClass("toolbar-unfold")) {
                            bottomBar.addClass("toolbar-unfold");
                            updateBar(true);
                        } else if (dy > 0 && bottomBar.hasClass("toolbar-unfold")) {
                            bottomBar.removeClass("toolbar-unfold");
                            updateBar(false);
                        }
                    }
                }
            }
            startX = m;
            startY = l;
            startTimeT = t;
        }
        return {
            start: startSwipe,
            move: detectSwipe,
        };
    };
    var ScrollLock = function() {
        "use strict";
        var scrollData = null;
        var lockTimeout = null;

        function scrollLock(e) {
            if (!scrollData) {
                scrollData = {
                    x: e.target.scrollLeft,
                    vel: 0,
                    orig: e.target.scrollLeft + 20,
                    t: new Date().getTime(),
                    max: 0,
                    detected: false,
                    dir: 0,
                };
                return;
            } else if (scrollData.cancelled) return;
            var detected = scrollData.detected;
            var x = e.target.scrollLeft;
            var dir = x - scrollData.x;
            //change direction
            if (dir * scrollData.dir < 0) {
                if (detected) {
                    clearTimeout(lockTimeout);
                    lockTimeout = null;
                }
                scrollData = null;
                return;
            }
            var t = new Date().getTime();
            var diffT = t - scrollData.t;
            var vel = Math.abs(dir) / diffT;
            scrollData = {
                x: x,
                t: t,
                vel: vel,
                max: Math.max(vel, scrollData.max),
                dir: dir,
                orig: scrollData.orig,
                detected: scrollData.detected,
            };
            if (lockTimeout) {
                if (vel > 0.2) {
                    clearTimeout(lockTimeout);
                    lockTimeout = setTimeout(lockScroll, diffT * 2);
                }
            } else if (scrollData.max > 0.6) {
                //hysterisis 0.2
                scrollData.detected = e.target;
                lockTimeout = setTimeout(lockScroll, diffT * 2);
            }
        }

        function lockScroll() {
            lockTimeout = null;
            var elements = scrollData.detected.getElementsByClassName(
                "scroll-point"
            );
            var scrollLeft = scrollData.detected.scrollLeft;
            var width = scrollData.detected.clientWidth;
            // var right = scrollLeft + width;
            var scrollPointToLeft = 0,
                scrollPointToRight = scrollData.detected.scrollWidth - width;
            for (var i = 0; i < elements.length; i++) {
                var x = elements[i].offsetLeft;
                if (x < scrollLeft) {
                    scrollPointToLeft = x;
                } else {
                    scrollPointToRight = x;
                    break;
                }
            }
            var finalScrollPoint;
            if (scrollData.dir > 0 && scrollPointToLeft <= scrollData.orig) {
                //scrolled left, lock to next
                finalScrollPoint = scrollPointToRight;
            } else if (
                scrollData.dir < 0 &&
                scrollPointToRight >= scrollData.orig
            ) {
                //scrolled right, lock to previous
                finalScrollPoint = scrollPointToLeft;
            } else {
                //lock to closest since scrollPointToLeft hasn't changed
                if (
                    scrollLeft + scrollData.dir * 2 - scrollPointToLeft <
                    scrollPointToRight - scrollLeft
                ) {
                    finalScrollPoint = scrollPointToLeft;
                } else {
                    finalScrollPoint = scrollPointToRight;
                }
                if (Math.abs(
                        finalScrollPoint - scrollLeft
                    ) > width / 2) return (scrollData.cancelled = true);
            }
            animate(scrollLeft,
                finalScrollPoint - 20);

            scrollData.cancelled = true;
        }
        var animTimeout;

        var ramp = [0, 0.008, 0.032, 0.072, 0.128, 0.2, 0.3, 0.4, 0.5];
        var steps = [];
        for (var j = 0; j < ramp.length - 1; j++) {
            steps.push(ramp[j]);
            steps.push(0.25 * ramp[j + 1] + 0.75 * ramp[j]);
            steps.push(0.5 * (ramp[j] + ramp[j + 1]));
            steps.push(0.25 * ramp[j] + 0.75 * ramp[j + 1]);
        }
        for (var i = steps.length - 2; i >= 0; i--) {
            steps.push(1 - steps[i]);
        }

        var STEPS = steps.length;

        function animate(startX, targetX) {
            var x = 0;
            var delta = targetX - startX;
            var speed = Math.abs(delta) < 100 ? 3 : 1;
            animTimeout = setInterval(function() {
                scrollData.detected.scrollLeft = startX + delta * (STEPS[x += speed] | 1);
                if (x >= STEPS) {
                    clearInterval(animTimeout);
                    animTimeout = null;
                }
            }, 13);

        }
        return {
            onScroll: scrollLock,
            onRelease: function() {

            },
            cancel: function() {
                if (lockTimeout) {
                    clearTimeout(lockTimeout);
                    lockTimeout = null;
                }
                if (animTimeout) {
                    clearInterval(animTimeout);
                    animTimeout = null;
                }
                scrollData = null;
            },
        };
    };
    var RepeatDetector = function(
        mods,
        allTools,
        appConfig,
        shortcut_click
    ) {
        "use strict";
        var repeatTimeout;

        function getIdentifier(e) {
            if (e && e.originalEvent && e.originalEvent.changedTouches) {
                return "touch-" + e.originalEvent.changedTouches[0].identifier;
            }
            return "repeat";
        }
        var pressedElems = [];

        function startLongPress(e) {
            var target = $(e.target).closest("button");
            if (!target.length) return;
            target.addClass("pressed");
            pressedElems.push(target);
            var key = target.attr("id");
            var targetSpeed, handler;
            if (/shift|alt|ctrl/.test(key)) {
                return mods.startHold(key, getIdentifier(e), target);
            }
            var tool = allTools[key];
            if (!tool) return;
            if (repeatTimeout) return; //should not happen
            if (tool.onhold == 'repeatKey') {
                key = key.slice(2);
                handler = mods.dispatch;
                targetSpeed = appConfig.characterBarRepeatingKeyIntervalMs;
            } else if (tool.onhold == 'repeat') {
                handler = shortcut_click;
                targetSpeed = appConfig.characterBarRepeatingActionIntervalMs;
            } else return;
            if (getIdentifier(e) == "touch-1") {
                pendingClick = {
                    id: "touch-1",
                    key: key,
                    func: handler,
                    time: new Date().getTime(),
                };
            }
            var speed = targetSpeed * 5;
            var a = function() {
                handler(key);
                speed = speed * 0.7 + targetSpeed * 0.3;
                repeatTimeout = setTimeout(a, speed);
            };
            repeatTimeout = setTimeout(a, appConfig.characterBarRepeatingKeyStartDelayMs);
        }
        var pendingClick;

        function clearRepeat() {
            mods.stopHold();
            clearTimeouts();
        }

        function clearTimeouts() {
            if (repeatTimeout) {
                for (var i in pressedElems) {
                    pressedElems[i].removeClass("pressed");
                }
                pressedElems.length = 0;
                clearTimeout(repeatTimeout);
                repeatTimeout = null;
            }
        }

        function stopLongPress(e) {
            var identity = getIdentifier(e);
            mods.stopHold(identity);
            if (
                pendingClick &&
                new Date().getTime() - pendingClick.time <
                appConfig.characterBarRepeatingKeyStartDelayMs
            ) {
                pendingClick.func(e);
                pendingClick = null;
            }
            setTimeout(mods.update);
            clearTimeouts();
        }

        return {
            end: stopLongPress,
            start: startLongPress,
            cancel: clearRepeat,
        };
    };

    var editor;
    var FocusManager = global.FocusManager;
    //var SplitManager = global.SplitManager;

    var appConfig = global.registerAll({
        showCharacterBar: !Env.isHardwareKeyboard,
        toolbarPosition: "below",
        enableModKeys: !Env.isHardwareKeyboard && "shift,ctrl,alt",
        enableArrowKeys: !Env.isHardwareKeyboard,
        enableLockScrolling: true,
        showCharacterBarToggle: true,
        characterBarRepeatingKeyIntervalMs: 20,
        characterBarRepeatingActionIntervalMs: 100,
        characterBarRepeatingKeyStartDelayMs: 700,
        characterBarDoubleClickIntervalMs: 500,
        characterBarChars: [
            "\t",
            "<",
            "</",
            ">",
            "/",
            "=",
            "{--S--}",
            "</>--N--<--W----C--></--W-->",
            "--L--@",
            ":",
            "*",
            "+",
            "-",
            "(",
            ")",
            "[",
            "]",
            "{",
            "}",
            "_--L--",
            "func--N----L--function(){\n\t--C--}",
            "class--N--class --W-- {\n--C--}",
            "--S--",
        ],
    }, "toolbars");
    global.registerValues({
            characterBarChars: "characters to show on character bar\n\
It's a bit similar to snippets. But with a different syntax\n\
--S-- represents selected text,\n\
--C-- shows where to move cursor to.\
<caption>--N-- denotes the display caption(must come before any other text example: func--N----L--function(){\t--C--}) , \
\n--L-- a point to lock character bar scrolling see .lockScrolling\n\
--W-- represents the word before the cursor - Note: using it will also remove the word\n",
            showCharacterBar: "Whether to show character bar",
            toolbarPosition: {
                doc: "How to show toolbar",
                values: ["above", "below", [false, "Don't show"]]
            },
            enableModKeys: {
                type: "boolean|[shift,ctrl,alt,esc,home,end]",
                doc: "Whether to show control keys. Can be true,false, or a comma delimited list of keys :[shift,ctrl,alt,esc,home,end]"
            },
            enableLockScrolling: "Allows character bar to jump to clamp scroll",
            enableArrowKeys: "Whether to show directional keys",
        },
        "toolbars"
    );

    var configEvents = global.ConfigEvents;
    var Utils = global.Utils;
    var postRebuild;
    configEvents.on("toolbars", function(e) {
        switch (e.config) {
            case "characterBarChars":
                setChars(e.newValue);
                break;
            default:
                postRebuild = postRebuild || Utils.delay(rebuild);
                postRebuild();
        }
    });
    /*
        interface Tool {({
            icon: string,
            onhold: command,
        }|string)}
        
    */

    var allTools = {
        save: {
            icon: "save",
            onhold: "saveAs",
        },
        undo: {
            icon: "undo",
            onhold: 'repeat'
        },
        redo: {
            icon: "redo",
            onhold: 'repeat'
        },
        openCommandPallete: {
            icon: "more_horiz",
        },
        find: "search",
        gotoline: {
            icon: "call_made",
        },
        startAutocomplete: {
            icon: "fast_forward",
        },
        esc: {
            caption: "esc",
        },
        shift: {
            caption: "shift",
        },
        ctrl: {
            caption: "ctrl",
        },
        "a-left": {
            icon: "arrow_backward",
            onhold: 'repeatKey'
        },
        "a-up": {
            icon: "arrow_upward",
            onhold: 'repeatKey'
        },
        "a-down": {
            icon: "arrow_downward",
            onhold: 'repeatKey'
        },
        "a-right": {
            icon: "arrow_forward",
            onhold: 'repeatKey'
        },
        alt: {
            caption: "alt",
        },
        home: {
            caption: "home",
        },
        end: {
            caption: "end",
        },
        paste: {
            icon: "content_paste",
            onhold: "openClipboard",
        },
        copy: "content_copy",
        cut: "content_cut",
        findprevious: "chevron_left",
        findnext: "chevron_right",
        goToNextError: "warning",
        blockindent: "format_indent_increase",
        blockoutdent: "format_indent_decrease",
        togglerecording: "fiber_manual_record",
        replaymacro: "replay",
        toggleFullscreen: "fullscreen",
    };

    //
    var topEl, topBar, bottomEls, bottomBar, viewToggle;
    var addElement = function(el, above) {
        if (above) {
            if (topEl) throw "Error: multiple top bars";
            topEl = el;
            if (!topBar) {
                topBar = $(createBar("top"));
                topBar.addClass("top-bar");
            }
            topBar[0].appendChild(topEl[0]);
        } else {
            if (!bottomBar) {
                bottomEls = [];
                bottomBar = $(createBar("bottom"));
                bottomBar.addClass("bottom-bar");
            }
            bottomEls.push(el);
            bottomBar[0].appendChild(el[0]);
            if (bottomEls.length > 1 && !viewToggle) {
                viewToggle = createToggle(bottomBar[0]);
                el[0].style.display = "none";
            }
        }
        el.addClass("fill_box");
    };

    var createToggle = function(bar) {
        bar.className += " edge_box-1-0";
        var toggle = document.createElement("button");
        toggle.style.paddingLeft = "10px";
        toggle.className = "tool-swapper side-1";
        toggle.innerHTML = '<i class="material-icons">swap_horiz</i>';
        bar.insertBefore(toggle, bar.firstChild);
        var index = 0;
        toggle.onclick = function(e) {
            var element = bottomEls[index];
            element.hide();
            index = (index + 1) % bottomEls.length;
            element = bottomEls[index];
            element.show();
            e.stopPropagation();
        };
        return toggle;
    };

    var createBar = function(pos) {
        var bar = document.createElement("div");
        bar.style[pos] = "0";
        bar.className = "toolbar sidenav-pushable";

        FocusManager.trap($(bar), true);
        return bar;
    };
    //views used by linearlayout
    var bottomView, topView;
    var createBottomToggle = function() {
        $("#toolbar-toggle").click(function(e) {
            bottomView.toggle();
            if (bottomView.hidden) {
                this.style.bottom = "10px";
                $("#toolbar-toggle").html(
                    '<i class="material-icons">keyboard_arrow_up</i>'
                );
            } else {
                this.style.bottom = bottomBar.css("height");
                $("#toolbar-toggle").html(
                    '<i class="material-icons">keyboard_arrow_down</i>'
                );
            }
            e.stopPropagation();
        });
        FocusManager.trap($("#toolbar-toggle"), true);
        createBottomToggle = function() {
            $("#toolbar-toggle").show();
        };
    };

    function createToolBar(tools, scrollPoints) {
        var toolbar = document.createElement("div");
        var lockScroll = {};
        for (var o in scrollPoints) {
            if (typeof scrollPoints[o] == 'string') {
                lockScroll[scrollPoints[o]] = true;
            } else {
                for (var p in scrollPoints[o]) {
                    if (tools.indexOf(scrollPoints[o][p]) > -1) {
                        lockScroll[scrollPoints[o][p]] = true;
                        break;
                    }
                }
            }
        }
        for (var b = 0; b < tools.length; b++) {
            var command = tools[b];
            var data = allTools[command];
            if (!data) {
                data = {
                    caption: b
                };
            }
            var icon = typeof data == "string" ? data : data.icon;
            var text =
                data.caption || "<i class='material-icons'>" + icon + "</i>";
            var span = document.createElement("button");
            span.innerHTML = text;
            if (data.caption) {
                span.className = 'mod-key';
            }
            if (lockScroll[command]) {
                span.className += ' scroll-point';
            }
            span.setAttribute("id", command);
            toolbar.appendChild(span);
        }
        return toolbar;
    }

    function handleContextMenu(e) {
        var target = $(e.target).closest("button")[0];
        if (!target) return;
        var id = target.getAttribute("id");
        var action = allTools[id] && allTools[id].onhold;
        if (action && action !== 'repeat' && action !== 'repeatKey') {
            editor.execCommand(allTools[id].onhold);
        }
        e.preventDefault();
    }

    var commandClick = function(id) {
        editor.execCommand(id);
    };

    function stopPropagation(e) {
        e.stopPropagation();
    }

    function handleVertSwipe( /*closed*/ ) {
        bottomBar.css("height", "auto");
        bottomView.computeSize("height");
        bottomView.parent.render();
        $("#toolbar-toggle").css("bottom", bottomView.layout_height);
    }

    function handleToolClick(e) {
        var target = $(e.target).closest("button")[0];
        if (!target) return;
        var id = target.getAttribute("id");
        switch (id) {
            case "shift":
            case "ctrl":
            case "alt":
                Mods.press(id, target);
                break;
            case "a-right":
            case "a-left":
            case "a-up":
            case "a-down":
                Mods.dispatch(id.slice(2));
                break;
            case "esc":
            case "home":
            case "end":
                Mods.dispatch(id);
                break;
            case "copy":
            case "cut":
            case "paste":
                Mods.handleClipboard(id);
                break;
            case "find":
            case "gotoline":
            case "openCommandPallete":
                //require focus-
                //may later decide to use settimeout
                FocusManager.hintChangeFocus();
                /*fall through*/
            default:
                editor.execCommand(id);
        }
        e.stopPropagation();
    }

    function createCharBar(chars) {
        var bar = document.createElement("div");
        for (var o in chars) {
            var i = global.Utils.htmlEncode(chars[o])
                .replace(/'/g, "\\'");

            var caption = "";
            var t = null;
            if (i.indexOf("--N--") > -1) {
                t = i.split("--N--");
                caption = t[0];
                i = t[t.length - 1].replace();
            }
            var el = "<button value='";
            if (i.indexOf("--L--") > -1) {
                i = i.replace("--L--", "");
                el += i + "' class='scroll-point'>";
            } else {
                el += i + "'>";
            }

            caption =
                caption ||
                i
                .replace("--C--", "")
                .replace(/--S--/g, "")
                .replace("--W--", "")
                .replace(
                    /\t/g,
                    "<i class='material-icons'>keyboard_tab</i>"
                )
                .replace(/\n/g, "&rdsh;");
            el += caption + "</button>";
            $(bar).append(el);
            if (t) {
                var displayLength = caption.replace(/&\w+;/g, "-").length;
                $(bar)
                    .children()
                    .last()
                    .css("font-size", 60.0 / displayLength);
            }
        }
        return bar;
    }

    function handleCharClick(e) {
        var val = $(this).attr("value");
        if (val == "\t" /*special case*/ ) {
            return Mods.dispatch("tab");
        }
        var target =
            FocusManager.activeElement || editor.textInput.getElement();
        var edit = TextEdit.from(target);
        var sel = edit.selection();
        if (val.indexOf("--W--") > 0) {
            var prec = edit.wordBefore();
            val = val.replace(/--W--/g, prec);
            edit.delete(prec.length);
        }
        val = val.replace(/--S--/g, sel);
        var cursor_pos = val.indexOf("--C--");
        val = val.replace("--C--", "");
        edit.insert(val);
        if (cursor_pos > -1) {
            edit.moveAnchor(cursor_pos - val.length);
            edit.moveCursor(cursor_pos - val.length);
        }
        edit.commit();
        e.stopPropagation();
    }

    function destroy() {
        toolbar = metabar = charbar = null;
        if (topEl) {
            topEl.remove();
            topEl = null;
        }
        if (bottomEls) {
            bottomEls.forEach(function(e) {
                e.remove();
            });
            bottomEls.length = 0;
        }
    }
    //kept across rebuilds
    var toolbar, metabar, charbar, swipe, mainLayout;

    function rebuild() {
        destroy();
        var tools = Object.keys(allTools);
        var modtools;
        var toRemove = ['shift', 'ctrl', 'alt', 'esc', 'home', 'end'];
        var totalMods = toRemove.length + 4;
        if (!appConfig.enableArrowKeys) {
            tools.splice(tools.indexOf('a-left'), 4);
            totalMods -= 4;
        }
        if (
            appConfig.enableModKeys !== true
        ) {
            if (appConfig.enableModKeys) {
                var items = Utils.parseList(appConfig.enableModKeys);
                toRemove = toRemove.filter(Utils.notIn(items));
            }
            var filtered = tools.filter(Utils.notIn(toRemove));
            totalMods -= tools.length - filtered.length;
            tools = filtered;
        }
        if (totalMods > 0 && appConfig.toolbarPosition !== "below") {
            modtools = [
                "startAutocomplete",
                "esc",
                "shift",
                "ctrl",
                "a-left",
                "a-down",
                "a-up",
                "a-right",
                "alt",
                'home',
                'end'
            ];
            tools = tools.filter(Utils.notIn(modtools));
        }

        var lock;
        if (appConfig.enableLockScrolling) {
            lock = ScrollLock();
        }
        var event_mousedown = "ontouchstart" in window ? "touchstart" : "mousedown";
        var event_mouseup = "ontouchend" in window ? "touchend" : "mouseup";
        var event_mousemove = "ontouchmove" in window ? "touchmove" : "mousemove";

        var repeat;
        if (appConfig.toolbarPosition)
            toolbar = $(createToolBar(tools, [
                ['esc', 'shift', 'ctrl',
                    'a-left'
                ], 'paste'
            ]));
        if (modtools) {
            metabar = $(createToolBar(modtools));
        }
        Mods.setToolbar(metabar || toolbar);
        Mods.setClipboard(global.clipboard);

        if (toolbar || metabar) {
            repeat = RepeatDetector(
                Mods,
                allTools,
                appConfig,
                commandClick
            );
        }
        //not mousedown because of focus
        if (toolbar) {
            toolbar.on("click", handleToolClick);
            toolbar.on(event_mousedown, repeat.start);
            lock && toolbar.on(event_mousedown, lock.cancel);
            lock && toolbar.on(event_mouseup, lock.onRelease);
            toolbar.on(event_mouseup, repeat.end);
            toolbar.on("scroll", repeat.cancel);
            toolbar.on("contextmenu", handleContextMenu);
            lock && toolbar.on("scroll", lock.onScroll);
            addElement(toolbar, appConfig.toolbarPosition == "above");
        }
        if (metabar) {
            metabar.on("click", handleToolClick);
            metabar.on(event_mousedown, repeat.start);
            metabar.on(event_mouseup, repeat.end);
            metabar.on("scroll", repeat.cancel);
            addElement(metabar);
        }

        if (appConfig.showCharacterBar) {
            charbar = $(createCharBar(appConfig.characterBarChars));
            charbar.on("mousedown", "button", handleCharClick);
            lock && charbar.on("scroll", lock.onScroll);
            lock && charbar.on(event_mousedown, lock.cancel);
            lock && charbar.on(event_mouseup, lock.onRelease);
            addElement(charbar);
        }
        if (bottomBar && bottomEls.length > 0 &&
            appConfig.showCharacterBarToggle) {
            createBottomToggle();
            $("#status-filename").css("left", "60px");
        } else {
            $("#toolbar-toggle").hide();
            $("#status-filename").css("left", "10px");
        }
        if (bottomBar && bottomEls.length < 1) {
            bottomView.hide();
        } else if (bottomEls && bottomEls.length > 0) {
            if (!swipe) {
                swipe = SwipeDetector(bottomBar, handleVertSwipe);
                bottomBar.on(event_mousedown, swipe.start);
                bottomBar.on(event_mousemove, swipe.move);
                bottomBar.click(stopPropagation);
                $('.content')[0].appendChild(bottomBar[0]);
                bottomView = mainLayout.addChild(bottomBar, 40, 0);
                if (!viewToggle) bottomEls[0].css("padding-left", "20px");
            } else {
                bottomView.show();
                if (bottomEls.length > 1) {
                    $(viewToggle).show();
                    bottomBar.addClass('edge_box-1-0');
                } else {
                    if (viewToggle) {
                        $(viewToggle).hide();
                        bottomBar.removeClass('edge_box-1-0');
                    }
                    bottomEls[0].css("padding-left", "20px");
                }
            }
        }


        //todo remove topBar/bottomBar if unneeded
        if (topBar && !topEl) {
            topView.hide();
        } else if (topEl) {
            if (!topView) {
                $('.content')[0].insertBefore(topBar[0], mainLayout.views[1].$el[0]);
                topView = mainLayout.addChild(topBar, 40, 0, 1);
            } else topView.show();
        }

        mainLayout.render();
    }

    function setChars(char) {
        var bar = createCharBar(char);
        if (charbar) charbar.html(bar.innerHTML);
    }


    global.CharBar = {
        setEditor: function(e) {
            editor = e;
            Mods.setEditor(e);
        },
        addTool: function(command, tool) {
            allTools[command] = tool;
        },
        setToolList: function(tool_list) {
            var bar = createToolBar(tool_list);
            toolbar && toolbar.html(bar.innerHTML);
        },
        init: function(layout) {
            mainLayout = layout;
            rebuild();
            global.FileUtils.on("clear-temp", function() {
                Mods.clear();
            });
        },
        setChars: setChars
    };
}); /*_EndDefine*/