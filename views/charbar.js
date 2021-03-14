_Define(function(global) {
    //swipe to open
    var setImmediate = setTimeout;
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
                    if (Math.abs(dx) > Math.abs(dy) * 3)
                        swipeFailed = true;
                    //
                } else if (dragT > swipeConfig.distanceThreshold) {
                    var vt = Math.abs(dy / (t - startTimeT));
                    if (vt > swipeConfig.swipeThreshold || dragT > swipeConfig.dragThreshold) {
                        swipeDetected = true;
                        if (dy < 0 && !bottomBar.hasClass('closed')) {
                            bottomBar.addClass('closed');
                            updateBar(true);
                        } else if (dy > 0 && bottomBar.hasClass('closed')) {
                            bottomBar.removeClass('closed');
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
            move: detectSwipe
        };
    };
    var RepeatDetector = function(mods, appConfig, shortcut_click, tools, handleToolClick) {
        "use strict";
        var repeatTimeout;

        function getIdentifier(e) {
            if (e && e.originalEvent && e.originalEvent.changedTouches) {
                return "touch-" + e.originalEvent.changedTouches[0].identifier;
            }
            return "repeat";
        }
        var repeating = [];

        function startLongPress(e) {
            //toolbar does not close modkeyinput
            var target = $(e.target).closest("button");
            if (!target.length) return;
            target.addClass('pressed');
            repeating.push(target);
            var key = target.attr('id');
            var targetSpeed, func;
            if (/a\-/.test(key)) {
                key = key.slice(2);
                func = mods.go;
                targetSpeed = appConfig.characterBarRepeatingKeyIntervalMs;
            } else if (/undo|redo/.test(key)) {
                func = shortcut_click;
                targetSpeed = appConfig.characterBarRepeatingActionIntervalMs;
            } else if (/shift|alt|ctrl/.test(key)) {
                return mods.startHold(key, getIdentifier(e), target);
            } else return;
            if (getIdentifier(e) == "touch-1") {
                pendingClick = {
                    id: "touch-1",
                    key: key,
                    time: new Date().getTime()
                };
            }
            if (repeatTimeout)
                return; //should not happen
            var a = function() {
                func(key);
                speed = speed * 0.7 + targetSpeed * 0.3;
                repeatTimeout = setTimeout(a, speed);
            };
            var speed = appConfig.characterBarRepeatingKeyStartDelayMs;
            repeatTimeout = setTimeout(a, speed);
        }
        var pendingClick;

        function clearRepeat() {
            mods.remove();
            clearTimeouts();
        }

        function clearTimeouts() {
            if (repeatTimeout) {
                for (var i in repeating) {
                    repeating[i].removeClass('pressed');
                }
                clearTimeout(repeatTimeout);
                repeatTimeout = null;
            }
        }

        function stopLongPress(e) {
            var identity = getIdentifier(e);
            mods.remove(identity);
            if (pendingClick && new Date().getTime() - pendingClick.time < appConfig.characterBarRepeatingKeyStartDelayMs) {
                handleToolClick(e);
                pendingClick = null;
            }
            setTimeout(mods.update);
            clearTimeouts();
        }

        return {
            end: stopLongPress,
            start: startLongPress,
            cancel: clearRepeat
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
                    detected: false,
                    dir: 0
                };
                if (lockTimeout)
                    clearTimeout(lockTimeout);
                return;
            } else if (scrollData.cancelled)
                return;
            var detected = scrollData.detected;
            var x = e.target.scrollLeft;
            var dir = x - scrollData.x;
            if (dir * scrollData.dir < 0) {
                if (detected)
                    clearTimeout(lockTimeout);
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
                dir: dir,
                orig: scrollData.orig,
                detected: scrollData.detected
            };
            if (vel > 0.2) {
                if (lockTimeout) {
                    clearTimeout(lockTimeout);
                    lockTimeout = setTimeout(lockScroll, diffT * 2);
                } else {
                    //hysterisis 0.2
                    scrollData.detected = e.target;
                    lockTimeout = setTimeout(lockScroll, diffT * 2);
                }
            }
        }
        //replace with swipelibrary
        function lockScroll() {
            lockTimeout = null;
            var elements = scrollData.detected.getElementsByClassName("scroll-point");
            var scrollLeft = scrollData.detected.scrollLeft;
            var width = scrollData.detected.clientWidth;
            var right = scrollLeft + width;
            var scrollPointToLeft = scrollData.dir * 2,
                scrollPointToRight = scrollLeft + scrollPointToLeft;
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
            if (scrollData.dir > 0 && scrollPointToLeft < scrollData.orig) {
                finalScrollPoint = scrollPointToRight;
            } else if (scrollData.dir < 0 && scrollPointToRight > scrollData.orig) {
                finalScrollPoint = scrollPointToLeft;
            } else {
                if ((scrollLeft - scrollPointToLeft) < (scrollPointToRight - scrollLeft)) {
                    finalScrollPoint = scrollPointToLeft;
                } else {
                    finalScrollPoint = scrollPointToRight;
                }
            }
            if (finalScrollPoint < right && finalScrollPoint > scrollLeft - 100)
                scrollData.detected.scrollLeft = finalScrollPoint - scrollData.dir * 2 - 20;
            scrollData.cancelled = true;
        }
        return {
            onScroll: scrollLock,
            cancel: function() {
                if (lockTimeout) clearTimeout(lockTimeout);
                scrollData = null;
            }
        };
    };
    //arrow and modkeys
    var ModKeyInput = function(toolbar, clipboardKeys, DOUBLE_CLICK_INTERVAL,global) {
        "use strict";
        var keys = global.keys;
        var FocusManager = global.FocusManager;
        var event = global.event;
        var times = {};
        var pressed = {};
        var held = {};
        var editor;
        var mod_key_click = function(key, target) {
            var clickT = new Date().getTime();
            if (clickT - (times[key] || 0) < DOUBLE_CLICK_INTERVAL) {
                held[key] = "double_tap";
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
            if (pressed[key] || held[key])
                openModKey();
            if (!(getHash() || closed)) {
                closeModKey();
            }
            updateModColors(target, key);

        };

        function getHash(clear) {
            var key = 0;
            if (pressed.shift || held.shift)
                key |= keys.KEY_MODS.shift;
            if (pressed.ctrl || held.ctrl)
                key |= keys.KEY_MODS.ctrl;
            if (pressed.alt || held.alt)
                key |= keys.KEY_MODS.alt;
            if (clear) {
                pressed = {};
                updateModColors();
            }
            return key;
        }

        var closed = true;

        function closeModKey(forced) {
            closed = true;
            if (forced) {
                pressed = {};
                held = {};
                updateModColors();
            }
            if (FocusManager.activeElement == modKeyInput) {
                FocusManager.hintChangeFocus();
                editor.focus();
                setTimeout(function() {
                    if (closed)
                        editor.focus();
                }, 1);
            }
            if (FocusManager.activeElement != editor.textInput.getElement()) {
                editor.renderer.visualizeBlur();
            }
            modKeyInput.blur();

        }

        var blurCount;

        var lastBlurTime = 0;

        function createModKeyInput() {
            modKeyInput = document.createElement("textarea");
            modKeyInput.style.opacity = 0.1;
            modKeyInput.style.width = "50px";
            modKeyInput.style.height = '50px';
            modKeyInput.style.top = '0px';
            modKeyInput.style.right = '0px';
            modKeyInput.style.position = "absolute";
            event.addListener(modKeyInput, "input", function(e) {
                var char = modKeyInput.value[1];
                if (char) {
                    doHandle(keys[char.toLowerCase()], /[A-Z]/.test(char) ? keys.KEY_MODS.shift : 0, char);
                }
                modKeyInput.value = ".";
                e.stopPropagation();
            });
            document.body.appendChild(modKeyInput);
            event.addListener(modKeyInput, "blur", handleBlur);
            event.addCommandKeyListener(modKeyInput, function(e, hashId, keyCode) {
                doHandle(keyCode, hashId);
                modKeyInput.value = ".";
                e.stopPropagation();
            });

        }
        var modKeyInput;
        var inExec = false;

        function handleBlur(ev) {
            if (closed) return;
            var time = new Date().getTime();
            if (!ev || time - lastBlurTime < DOUBLE_CLICK_INTERVAL) {
                //two clicks force clears hash
                blurCount++;
            } else if (time - lastBlurTime > DOUBLE_CLICK_INTERVAL * 2) blurCount = 0;

            if (inExec || blurCount > 1) {
                closeModKey(true);
            } else {
                modKeyInput.focus();
                editor.renderer.showCursor();
                editor.renderer.visualizeFocus();
                lastBlurTime = time;
            }
        }

        function updateModColors(target, key) {
            if (target) {
                target.className = target.className.replace(/mod\-key\-(?:held|active|inactive)/g, "") + " " + (held[key] ? "mod-key-held" : pressed[key] || key == 'esc' ? "mod-key-active" : "mod-key-inactive");
            } else toolbar && toolbar.find(".mod-key").each(function() {
                updateModColors(this, this.getAttribute('id'));
            });
        }

        function fireKey(el, keyCode, modifier) {
            if (document.createEventObject) {
                var eventObj = document.createEventObject();
                eventObj.keyCode = keyCode;
                modifier && modifier.split("-").map(function(m) {
                    if (m) eventObj[m + "Key"] = true;
                });
                el.fireEvent("onkeydown", eventObj);
                eventObj.keyCode = keyCode;
            } else if (document.createEvent) {
                var eventObj = document.createEvent("Events");
                eventObj.initEvent("keydown", true, true);
                eventObj.which = keyCode;
                eventObj.keyCode = keyCode;
                modifier && modifier.split("-").map(function(m) {
                    if (m) eventObj[m + "Key"] = true;
                });
                el.dispatchEvent(eventObj);
            }
        }
        var cursorSwapped = false;

        function openModKey() {
            if (closed && FocusManager.activeElement && FocusManager.activeElement != editor.textInput.getElement()) {
                //cant handle anything other than shift
                pressed = {
                    shift: pressed.shift
                };
                held = {
                    shift: held.shift
                };
                return;
            }
            closed = false;
            if (!modKeyInput) {
                createModKeyInput();
            }
            FocusManager.hintChangeFocus();
            blurCount = 0;
            modKeyInput.value = ".";
            modKeyInput.focus();
            editor.renderer.showCursor();
            editor.renderer.visualizeFocus();
            setTimeout(
                function() {
                    if (!closed) {
                        blurCount = 0;
                        modKeyInput.focus();
                        editor.renderer.showCursor();
                        editor.renderer.visualizeFocus();

                    }
                }, 100);
        }
        var clipboardHandler = new global.HashHandler();

        function doHandle(keyCode, hashId, keyString) {
            hashId |= getHash(true);

            if (!getHash()) {
                if (/A-Za-z/.test(keyString))
                    closeModKey();
                else {
                    //keyup events are sent to next focus
                    //if we close immediately
                    setImmediate(closeModKey);
                    $(modKeyInput).one('keyup', closeModKey);
                }
            }
            if (hashId) {
                var command = clipboardHandler.findKeyCommand(hashId, keys[keyCode]);
                inExec = true;
                if (command && command.exec) {
                    command.exec(editor);
                } else command = editor.keyBinding.onCommandKey(null, hashId, keyCode);
                inExec = false;
                if (command) {
                    lastBlurTime = 0;
                    blurCount = 0;
                } else if (held.shift == 'double_tap' || held.ctrl == 'double_tap' || held.alt == 'double_tap') {
                    handleBlur();
                }
            } else if (keyString) {
                //editor.keyBinding.onTextInput(keyString);
            }

        }
        var dir_key_click = function(key) {
            var target = FocusManager.activeElement || editor.textInput.getElement();
            target.blur();
            var keyCode = keys[key];
            var modifier = keys.KEY_MODS[getHash(true)];
            if (key == "left" || key == "right") {
                var selection = [target.selectionStart, target.selectionEnd];
                var direction = key == "left" ? 1 : -1;
                if (modifier != "shift-") {
                    if (selection[0] == selection[1]) {
                        if (selection[0] >= direction)
                            selection[0] -= direction;
                    } else if (direction > -1) {
                        selection[0] = selection[1];
                    }
                    selection[1] = selection[0];
                } else {
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
            }
            fireKey(target, keyCode, modifier);
        };
        clipboardHandler.bindKeys(clipboardKeys);
        updateModColors();
        return {
            open: openModKey,
            close: function() {
                if (!closed) closeModKey(true);
            },
            click: mod_key_click,
            esc: function() {
                var target = FocusManager.activeElement || editor.textInput.getElement();
                fireKey(target, 27, keys.KEY_MODS[getHash(true)]);
            },
            go: dir_key_click,
            setEditor: function(e) {
                editor = e;
            },
            setClipboard: function(e) {
                clipboard = e;
            },
            remove: function(j) {
                if (j) {
                    for (var i in held) {
                        if (held[i] == j) {
                            held[i] = false;
                        }
                    }
                } else {
                    for (var i in held) {
                        if (held[i] != "double_tap") held[i] = false;
                    }
                }
                if (!(getHash(false) || closed)) closeModKey();
                updateModColors();
            },
            startHold: function(key, identifier, target) {
                if (!held[key]) {
                    held[key] = identifier;
                    setTimeout(function() {
                        if (held[key] && closed) {
                            openModKey();
                            updateModColors(target[0], key);
                        }
                    }, 250);
                }
            }
        };
    };

    var editor;
    var FocusManager = global.FocusManager;

    //global.SplitManager;
    var appConfig = global.registerAll({
        "showCharacterBar": !Env.isDesktop && "toggle",
        "toolbarPosition": 'below',
        "enableModKeys": !Env.isDesktop && 'shift,ctrl,alt',
        "enableArrowKeys": !Env.isDesktop,
        "enableLockScrolling": true,
        "characterBarRepeatingKeyIntervalMs": 20,
        "characterBarRepeatingActionIntervalMs": 100,
        "characterBarRepeatingKeyStartDelayMs": 700,
        "characterBarDoubleClickIntervalMs": 500,
        "characterBarChars": "\t,>,</,--S--" +
            ";,.,comma,|,{,},[,],||,&&," +
            "--S--{--C----Y--},[--C----Y--],(--C----Y--)"
    }, "toolbars");
    global.registerValues({
        "toolbars": "All the positioning options need restart",
        "characterBarChars": "characters to show on character bar\n\
--Y-- represents selected text,\n\
--C-- shows where to insert cursor,\n\
<caption>--N-- denotes the display caption(must come before any other text eg func--N----S--function(){\t--C--}) , \
\n--S-- a point to lock character bar scrolling\n\
',' is a special value, use 'comma' instead",
        "showCharacterBar": "true,false,toggle",
        "toolbarPosition": 'above,below,toggle(implies below)',
        "enableModKeys": 'true,false,toggle, or list of keys[shift,ctrl,alt,esc[,toggle]] (show modifier buttons)',
        "enableLockScrolling": 'allows character bar to jump to specific positions set by --S-- when scrolling',
        "enableArrowKeys": 'true,false,toggle(show directional keys)'
    });
    var clipboard;
    var topEl, topBar, bottomEls, bottomBar, viewToggle;
    var addElement = function(el, above) {
        if (above) {
            if (topEl)
                throw 'Error: multiple top bars';
            topEl = el;
            topBar = $(createBar('top'));
            topBar.addClass('top-bar');
            topBar[0].appendChild(topEl[0]);
        } else {
            if (!bottomBar) {
                bottomEls = [];
                bottomBar = $(createBar('bottom'));
                bottomBar.addClass('bottom-bar');
            }
            bottomEls.push(el);
            bottomBar[0].appendChild(el[0]);
            if (bottomEls.length > 1 && !viewToggle) {
                viewToggle = createToggle(bottomBar[0]);
                el[0].style.display = 'none';
            }
        }
        el.addClass('fill_box');
    };

    var createToggle = function(bar) {
        bar.className += " edge_box-1-0";
        var toggle = document.createElement('button');
        toggle.style.paddingLeft = '10px';
        toggle.className = "tool-swapper side-1";
        toggle.innerHTML = '<i class="material-icons">swap_horiz</i>';
        bar.insertBefore(toggle, bar.firstChild);
        var index = 0;
        var element = bottomEls[0];
        toggle.onclick = function(e) {
            element.hide();
            index = (index + 1) % bottomEls.length;
            element = bottomEls[index];
            element.show();
            e.stopPropagation();
        };
        return toggle;
    };

    var createBar = function(pos) {
        var bar = document.createElement('div');
        bar.style[pos] = '0';
        bar.className = 'toolbar sidenav-pushable';

        FocusManager.trap($(bar), true);
        return bar;
    };
    var bottomView, topView;
    var createBottomToggle = function() {
        $("#toolbar-toggle").click(function(e) {
            bottomView.toggle();
            if (bottomView.hidden) {
                $("#toolbar-toggle").html("<i class=\"material-icons\">keyboard_arrow_up</i>");
            } else {
                $("#toolbar-toggle").html("<i class=\"material-icons\">keyboard_arrow_down</i>");
            }
            e.stopPropagation();
        });
        FocusManager.trap($("#toolbar-toggle"), true);

    };


    function createToolBar(tools) {
        var toolbar = document.createElement('div');
        for (var b in tools) {
            var el = tools[b];
            var icon = typeof(el) == "string" ? el : el.icon;
            var text = el.caption || "<i class='material-icons'>" + icon + "</i>";
            var span = document.createElement('button');
            span.innerHTML = text;
            if (el.className) {
                span.className = el.className;
            }
            span.setAttribute("id", b);
            toolbar.appendChild(span);
        }
        return toolbar;
    }

    function doCopy() {
        editor.once("copy", function(e) {
            clipboard.set(e.text);
        });
        editor.getCopyText();
    }

    function doCut() {
        doCopy();
        editor.execCommand("cut");
    }

    function doPaste() {
        clipboard.get(0, function(text) {
            editor.execCommand("paste", text);
        });
    }

    function handleContextMenu(e){
        var target = $(e.target).closest("button")[0];
        if (!target) return;
        var id = target.getAttribute('id');
        if(tools[id] && tools[id].onhold){
            editor.execCommand(tools[id].onhold);
        }
        e.preventDefault();
    }
    function handleToolClick(e) {
        var target = $(e.target).closest("button")[0];
        if (!target) return;
        var id = target.getAttribute('id');
        switch (id) {
            case "a-right":
            case "a-left":
            case "a-up":
            case "a-down":
                mods.go(id.slice(2));
                break;
            case "find":
            case "gotoline":
            case "openCommandPallete":
                //require focus-
                //may later decide to use settimeout
                FocusManager.hintChangeFocus()
            case "save":
            case "undo":
            case "redo":
            case "indent":
            case "outdent":
            case "toggleFullscreen":
                editor.execCommand(id);
                break;
            case "shift":
            case "ctrl":
            case "alt":
                mods.click(id, target);
                break;
            case "esc":
                mods.esc();
                break;
            case "copy":
                doCopy();
                break;
            case "cut":
                doCut();
                break;
            case "paste":
                doPaste();
                break;
            default:
                FocusManager.hintChangeFocus()
                editor.execCommand(id);
        }
        e.stopPropagation()
    }

    function createCharBar(char) {
        var bar = document.createElement('div');
        var SPLITTER = 'A4848hdjdiej3';
        var chars = char.
        replace(/,/g, SPLITTER).
        replace(/comma/g, ",").
        replace(/</g, "&lt;").
        replace(/>/g, "&gt;").
        replace(/'/g, "\\'").
        split(SPLITTER);
        for (var o in chars) {
            var i = chars[o];
            var caption = "";
            var t = null;
            if (i.indexOf("--N--") > -1) {
                t = i.split("--N--");
                caption = t[0];
                i = t[t.length - 1];
            }
            var el = "<button value='"
            if (i.indexOf("--S--") > -1) {
                i = i.replace("--S--", "");
                el += i + "' class='scroll-point'>"
            } else {
                el += i + "'>";
            }

            caption = caption || i.replace("--C--", "")
                .replace(/--Y--/g, "")
                .replace(/\t/g, "<i class='material-icons'>keyboard_tab</i>")
                .replace(/\n/g, "&rdsh;");
            el += caption + "</button>";
            $(bar).append(el);
            if (t) {
                $(bar).children().last().css("font-size", 60.0 / caption.length)
            }
        }
        return bar;
    }

    function handleCharClick(e) {
        var val = $(this).attr("value");
        if (val == "\t" /*special case*/ ) {
            return mods.go('tab');
        }
        var target = FocusManager.activeElement || editor.textInput.getElement();
        //necessary to clear Composition
        target.blur()

        var allText = target.value;
        /*this should never happen*/
        if (allText === undefined)
            return

        // obtain the index of the first selected character
        var start = target.selectionStart;
        // obtain the index of the last selected character
        var finish = target.selectionEnd;
        var sel = allText.substring(start, finish);
        val = val.replace(/--Y--/g, sel)
        var cursor_pos = val.indexOf("--C--")
        val = val.replace("--C--", "")
        //append te text;
        var newText = allText.substring(0, start) + val + allText.substring(finish, allText.length);
        target.value = newText;
        if (cursor_pos < 0) cursor_pos = val.length
        target.selectionStart = target.selectionEnd = start + cursor_pos;
        target.dispatchEvent(new InputEvent("input", {
            data: val /*unneeded*/
        }))
        e.stopPropagation()
    };

    var tools = {
        save: {
            icon: "save",
            onhold: "saveAs",
        },
        undo: {
            icon: "undo",
        },
        redo: "redo",
        find: "search",
        openCommandPallete: {
            icon: "more_horiz"
        },
        gotoline: {
            icon: "call_made",
            className: ""
        },
        startAutocomplete: {
            icon: "fast_forward"
        },
        esc: {
            caption: "esc",
            className: "mod-key"
        },
        shift: {
            caption: "shift",
            className: "mod-key"
        },
        ctrl: {
            caption: "ctrl",
            className: "mod-key"
        },
        'a-left': {
            icon: "arrow_backward",
            className: ""
        },
        'a-up': "arrow_upward",
        'a-down': "arrow_downward",
        'a-right': "arrow_forward",
        alt: {
            caption: "alt",
            className: "mod-key"
        },
        paste: {
            icon: "content_paste",
            onhold: "openClipboard",
            className: "scroll-point"
        },
        copy: "content_copy",
        cut: "content_cut",
        blockindent: "format_indent_increase",
        blockoutdent: "format_indent_decrease",
        toggleFullscreen: "fullscreen"
    }
    var modtools;
    if (appConfig.enableArrowKeys || appConfig.enableModKeys) {
        if (!appConfig.enableModKeys) {
            delete tools.shift;
            delete tools.ctrl;
            delete tools.alt;
            delete tools.esc;
        } else if (appConfig.enableModKeys !== true && appConfig.enableModKeys !== 'toggle') {
            var items = appConfig.enableModKeys.replace(/^\s*|\s*$/, "").split(/\s*,\s*/);
            if (items.indexOf("shift") < 0)
                delete tools.shift;
            if (items.indexOf("ctrl") < 0)
                delete tools.ctrl;
            if (items.indexOf("alt") < 0)
                delete tools.alt;
            if (items.indexOf("esc") < 0)
                delete tools.esc;
        }
        if (!appConfig.enableArrowKeys) {
            delete tools["a-left"];
            delete tools["a-right"];
            delete tools["a-down"];
            delete tools["a-up"];
        }
        if (appConfig.toolbarPosition == "above") {
            modtools = {}
            var metaKeys = ['startAutocomplete', 'esc', 'shift', 'ctrl', 'a-left', 'a-down', 'a-up', 'a-right', 'alt'];
            for (var i in metaKeys) {
                if (tools[metaKeys[i]]) {
                    modtools[metaKeys[i]] = tools[metaKeys[i]];
                    delete tools[metaKeys[i]];
                }
            }
            metaKeys = null;
        } else if (tools.esc) {
            tools.esc.className += " scroll-point";
        } else if (tools.shift) {
            tools.shift.className += " scroll-point";
        } else if (tools.ctrl) {
            tools.ctrl.className += " scroll-point";
        } else if (tools["a-left"]) {
            tools["a-left"].className += " scroll-point";
        }
    }


    /*region clickhandlers*/
    var shortcut_click = function(id) {
        editor.execCommand(id)
    }


    /*endregion*/
    var lock;
    if (appConfig.enableLockScrolling) {
        lock = ScrollLock();
    }
    var event_mousedown = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
    var event_mouseup = 'ontouchend' in window ? 'touchend' : 'mouseup';
    var event_mousemove = 'ontouchmove' in window ? 'touchmove' : 'mousemove';

    var toolbar, mods, repeat;
    if (appConfig.toolbarPosition)
        toolbar = $(createToolBar(tools));
    var metabar;
    if (modtools) {
        metabar = $(createToolBar(modtools))
    }
    mods = ModKeyInput(metabar || toolbar, {
        "Ctrl-V": doPaste,
        "Ctrl-C": doCopy,
        "Ctrl-X": doCut
    }, parseInt(appConfig.characterBarDoubleClickIntervalMs),global);

    if (toolbar || metabar) {
        repeat = RepeatDetector(mods, appConfig, shortcut_click, tools, handleToolClick);
    }
    //not mousedown because of focus
    if (toolbar) {
        toolbar.on("click", handleToolClick);
        toolbar.on(event_mousedown, repeat.start);
        lock && toolbar.on(event_mousedown, lock.cancel);
        toolbar.on(event_mouseup, repeat.end);
        toolbar.on("scroll", repeat.cancel);
        toolbar.on('contextmenu', handleContextMenu);
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

    var charbar;
    if (appConfig.showCharacterBar) {
        charbar = $(createCharBar(appConfig.characterBarChars));
        charbar.on("mousedown", "button", handleCharClick);
        lock && charbar.on("scroll", lock.onScroll);
        lock && charbar.on(event_mousedown, lock.cancel);
        addElement(charbar);
    }
    if (appConfig.showCharacterBar == "toggle" ||
        appConfig.toolbarPosition == "toggle" ||
        appConfig.enableModKeys == true || (appConfig.enableModKeys && appConfig.enableModKeys.indexOf("toggle") > -1) ||
        appConfig.enableArrowKeys == "toggle") {
        createBottomToggle();
    } else $("#toolbar-toggle").detach();
    if (bottomBar) {
        var swipe = SwipeDetector(bottomBar, function(closed) {
            bottomBar.css('height', 'auto');
            bottomView.computeSize('height');
            bottomView.parent.render();
        });
        if (!viewToggle) {
            bottomEls[0][0].style.paddingLeft = '30px';
        }
        bottomBar.on(event_mousedown, swipe.start);
        bottomBar.on(event_mousemove, swipe.move);
        bottomBar.click(function(e) {
            e.stopPropagation();
        });
    }
    global.FileUtils.on("clear-temp", function(e) {
        mods.close(true);
    });


    addElement = createToggle = createBar =
        createBottomToggle = topEl = null;

    global.CharBar = {
        setEditor: function(e) {
            editor = e;
            mods.setEditor(e)
        },
        setClipboard: function(c) {
            clipboard = c;
            mods.setClipboard(c);
        },
        setTools: function(tool_map) {
            var bar = createToolBar(tool_map);
            toolbar && toolbar.html(bar.innerHTML);
        },
        init: function(layout) {
            if (topBar) {
                document.body.insertBefore(topBar[0], layout.views[1].$el[0]);
                topView = layout.addChild(topBar, 40, 0, 1);
            }
            if (bottomBar) {
                document.body.appendChild(bottomBar[0]);
                bottomView = layout.addChild(bottomBar, 40, 0);
            }
            layout.render();
        },
        setChars: function(char) {
            var bar = createCharBar(char);
            if (charbar)
                charbar.html(bar.innerHTML);
        }
    }
}); /*_EndDefine*/