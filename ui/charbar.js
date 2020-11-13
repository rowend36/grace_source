(function(global) {
    var editor;
    var clipboard = {};
    registerAll({
        "characterBarRepeatingKeyInterval": 20,
        "characterBarRepeatingActionInterval": 100,
        "characterBarRepeatingKeyStartDelay": 700,
        "characterBarChars": "tab,<,>,</,--S--" +
            ";,.,comma,|,{,},[,],||,&&," +
            "--S--{--C----Y--},[--C----Y--],(--C----Y--)"
    });
    var Element;

    function renderCharBar(toggled) {
        if (toggled) {
            Element.toggle();
            if (Element.hidden) {
                $("#toolbar-toggle").html("<i class=\"material-icons\">keyboard_arrow_up</i>");
            }
            else {
                $("#toolbar-toggle").html("<i class=\"material-icons\">keyboard_arrow_down</i>");
            }
        }
        else {
            Element.computeSize('height');
            Element.parent.render();
        }
        //editor.resize();
        SplitManager.notifyResize(Element.parent.$el);
        editor.renderer.scrollCursorIntoView();
    }

    function genToolBar(items) {
        var toolbar = $("#toolbar")[0];
        toolbar.innerHTML = ""
        items = items || Object.keys(tools);
        for (var i in items) {
            var b = items[i];
            var el = tools[b];
            var icon = typeof(el) == "string" ? el : el.icon;
            var text = el.caption || "<i class='material-icons'>" + icon + "</i>";
            var span = document.createElement('span');
            span.innerHTML = text;
            if (el.className) {
                span.className = el.className;
            }
            span.setAttribute("id", b);
            toolbar.appendChild(span)
        }
    }
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
        shift: {
            caption: "shift",
            className: "scroll-point mod-key"
        },
        ctrl: {
            caption: "ctrl",
            className: "mod-key"
        },
        'a-left': "arrow_backward",
        'a-up': "arrow_upward",
        'a-down': "arrow_downward",
        'a-right': "arrow_forward",
        alt: {
            caption: "alt",
            className: "mod-key"
        },
        gotoline: {
            icon: "call_made",
            className: "scroll-point"
        },
        paste: {
            icon: "content_paste",
            onhold: "openClipboard"
        },
        copy: "content_copy",
        cut: "content_cut",
        indent: "format_indent_increase",
        outdent: "format_indent_decrease",
        toggleFullscreen: "fullscreen"
    }

    var captions = {
        "tab": "<i class='material-icons'>keyboard_tab</i>",
    }

    function genCharBar(char) {
        $("#char-bar").empty()
        var chars = char.
        replace(/,/g, "\t").
        replace(/comma/g, ",").
        replace(/</g, "&lt;").
        replace(/>/g, "&gt;").
        replace(/'/g, "\\'").
        split("\t");
        for (var i of chars) {
            var el = "<span value='"
            if (i.startsWith("--S--")) {
                i = i.replace("--S--", "");
                el += i + "' class='scroll-point'>"
            }
            else {
                el += i + "'>"
            }
            var caption = i.replace("--C--", "")
            caption = caption.replace(/--Y--/g, "")
            if (captions[caption]) {
                caption = captions[caption]
            }
            el += caption + "</span>";
            $("#char-bar").append(el)
        }
    }


    var event_mousedown = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
    var event_mouseup = 'ontouchend' in window ? 'touchend' : 'mouseup';
    var event_mousemove = 'ontouchmove' in window ? 'touchmove' : 'mousemove';

    var leftToggle = "#meta-bar"
    var rightToggle = "#char-bar"
    var activePane = "#toolbar"

    $("#toggleRight").click(function(e) {
        $(activePane).hide()
        $(rightToggle).show()
        var t = activePane
        activePane = rightToggle
        rightToggle = t
        e.stopPropagation()
    })
    $(leftToggle).hide()
    $(rightToggle).hide()

    $("#toolbar-toggle").click(function(e) {
        renderCharBar(true)
        e.stopPropagation();
    });


    var startTimeT = 0;
    var startX = 0,
        startY = 0,
        originalStartY = 0;
    var actions = $("#actions");
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
            return
        }
        var t = e.timeStamp;
        if (e.originalEvent.touches) {
            e = e.originalEvent.touches[0];
        }
        var l = e.clientY;
        var m = e.clientX;
        if (t - startTimeT < 500) {
            var dy = l - startY
            var dx = m - startX
            var dragT = Math.abs(l - originalStartY);
            if (Math.abs(dx) > Math.abs(dy)) {
                if (Math.abs(dx) > Math.abs(dy) * 3)
                    swipeFailed = true;
                //
            }
            else if (dragT > swipeConfig.distanceThreshold) {
                var vt = Math.abs(dy / (t - startTimeT))
                if (vt > swipeConfig.swipeThreshold || dragT > swipeConfig.dragThreshold) {
                    swipeDetected = true;
                    if (dy < 0 && !actions.hasClass('closed')) {
                        actions.addClass('closed')
                        renderCharBar(false)
                    }
                    else if (dy > 0 && actions.hasClass('closed')) {
                        actions.removeClass('closed')
                        renderCharBar(false)
                    }
                }
            }
        }
        startX = m;
        startY = l;
        startTimeT = t;
    }


    //charbar
    function handleCharClick(e) {
        var val = $(this).attr("value");
        if (val == "tab" /*special case*/ ) {
            return dir_key_click(val)
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
        target.dispatchEvent(new InputEvent("input", { data: val /*unneeded*/ }))
        e.stopPropagation()
    };

    var repeatTimeout, holdTimeout;

    function getIdentifier(e) {
        if (e && e.originalEvent && e.originalEvent.changedTouches) {
            return "touch-" + e.originalEvent.changedTouches[0].identifier;
        }
        return "repeat";
    }

    function startLongpress(e) {
        //toolbar does not close modkeyinput
        scrollData = null;
        var target = $(e.target).closest("span");
        if (!target) return
        target.addClass('pressed');
        var key = target.attr('id');
        var targetSpeed = appConfig.characterBarRepeatingKeyInterval;
        var func;
        if (/a\-/.test(key)) {
            key = key.slice(2);
            func = dir_key_click;
        }
        else if (/undo|redo/.test(key)) {
            func = shortcut_click;
            targetSpeed = appConfig.characterBarRepeatingActionInterval;
        }
        else if (/shift|alt|ctrl/.test(key)) {
            held[key] = held[key] || getIdentifier(e);
            setTimeout(function(){
                if(held[key] && closed){
                    openModKey()
                    updateModColors(target[0], key);
                }},400);
            return;
        }
        else if (tools[key] && tools[key].onhold && !holdTimeout) {
            holdTimeout = setTimeout(function() {
                FocusManager.hintChangeFocus();
                holdTimeout = null;
                editor.execCommand(tools[key].onhold);
            }, 700);
            return;
        }
        else return;
        if (getIdentifier(e) == "touch-1") {
            pendingClick = { id: "touch-1", key: key, time: new Date().getTime() }
        }
        if (repeatTimeout)
            return; //should not happen
        var a = function() {
            func(key)
            speed = speed * 0.7 + targetSpeed * 0.3;
            repeatTimeout = setTimeout(a, speed);
        }
        var speed = appConfig.characterBarRepeatingKeyStartDelay;
        repeatTimeout = setTimeout(a, speed);
    }
    var pendingClick;

    function clearRepeat() {
        for (var i in held) {
            if (held[i] != "double_tap") {
                held[i] = false;
            }
        }
        if (!(getHash() || closed))
            closeModKey()
        updateModColors()
        clearTimeouts();
    }

    function clearTimeouts() {
        if (repeatTimeout) {
            $("#toolbar .pressed").removeClass('pressed');
            clearTimeout(repeatTimeout);
            repeatTimeout = null;
        }
        if (holdTimeout) {
            clearTimeout(holdTimeout);
            holdTimeout = null
        }
    }

    function stopLongPress(e) {
        var identity = getIdentifier(e);
        for (var i in held) {
            if (held[i] == identity) {
                held[i] = false;
                updateModColors(e.target, i);
                break;
            }
        }
        if (pendingClick && new Date().getTime() - pendingClick.time < appConfig.characterBarRepeatingKeyStartDelay) {
            handleToolClick(e);
            pendingClick = null;
        }
        setTimeout(function() {
            if (!(getHash() || closed)) {
                closeModKey()
            }
        })
        clearTimeouts();
    }


    var scrollData = null;
    var lockTimeout = null;

    function scrollLock(e) {
        if (!scrollData) {
            scrollData = {
                x: e.target.scrollLeft,
                vel: 0,
                orig: e.target.scrollLeft,
                t: new Date().getTime(),
                detected: false,
                dir: 0
            }
            if (lockTimeout)
                clearTimeout(lockTimeout);
            return;
        }
        else if (scrollData.cancelled)
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
        }
        if (vel > 0.2) {
            if (lockTimeout && vel > 0.2) {
                clearTimeout(lockTimeout);
                lockTimeout = setTimeout(lockScroll, diffT * 2);
            }
            else {
                //hysterisis 0.2
                scrollData.detected = e.target;
                lockTimeout = setTimeout(lockScroll, diffT * 2);
            }
        }
    }
    //replace with swipelibrary
    function lockScroll() {
        lockTimeout = null;
        var elements = scrollData.detected.getElementsByClassName("scroll-point")
        var left = scrollData.detected.scrollLeft;
        var width = scrollData.detected.clientWidth;
        var right = left + width;
        var orig = scrollData.orig;
        var elLeft = scrollData.dir * 2,
            elRight = left + elLeft;
        for (var i = 0; i < elements.length; i++) {
            var x = elements[i].offsetLeft;
            if (x < left) {
                elLeft = x;
            }
            else {
                elRight = x;
                break;
            }
        }
        var el;
        if (scrollData.dir > 0 && elLeft < scrollData.orig) {
            el = elRight;
        }
        else if (scrollData.dir < 0 && elRight > scrollData.orig) {
            el = elLeft;
        }
        else {
            if ((left - elLeft) < (elRight - left)) {
                el = elLeft;
            }
            else {
                el = elRight;
            }
        }
        if (el < right)
            scrollData.detected.scrollLeft = el - scrollData.dir * 2;
        scrollData.cancelled = true;
    }

    var times = {}
    var pressed = {}
    var held = {}
    var keys = ace.require("ace/lib/keys");
    var HashHandler = ace.require("ace/keyboard/hash_handler").HashHandler;

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
        if (FocusManager.activeElement == modKeyInput) {
            FocusManager.hintChangeFocus();
            editor.focus();
            setTimeout(function() {
                if (closed)
                    editor.focus();
            }, 1)
        }
        //do we tell editor to visualize blur
        modKeyInput.blur()

        //document.body.removeChild(modKeyInput);

    }

    var blurCount;

    var lastBlurTime = 0;
    function createModKeyInput() {
        var event = require("ace/lib/event");
        modKeyInput = document.createElement("textarea");
        modKeyInput.style.opacity = 0.1;
        modKeyInput.style.width = "50px";
        modKeyInput.style.height = '50px';
        modKeyInput.style.top = '0px';
        modKeyInput.style.right = '0px';
        modKeyInput.value = "X"
        modKeyInput.style.position = "absolute";
        event.addListener(modKeyInput, "input", function(e) {
            var char = modKeyInput.value[1];
            if(char){
           
                 doHandle(keys[char.toLowerCase()], /[A-Z]/.test(char)?keys.KEY_MODS.shift:0, char);
            }
modKeyInput.value = "X"
            e.stopPropagation();
        });
        document.body.appendChild(modKeyInput);
        event.addListener(modKeyInput, "blur", function(e) {
            if (closed) return;
            var time = new Date().getTime();
            if (time - lastBlurTime < 700) {
                //two clicks force clears hash
                blurCount++;
            }
            else blurCount = 0;
            if (blurCount > 1) {
                pressed = {}
                held = {}
                updateModColors();
                closeModKey(true);
            }
            else {
                modKeyInput.focus()
                editor.renderer.showCursor()
                editor.renderer.visualizeFocus()
                lastBlurTime = time;
            }
        });
        event.addCommandKeyListener(modKeyInput, function(e, hashId, keyCode) {
            doHandle(keyCode, hashId);
            e.stopPropagation();
        });

    }
    var modKeyInput;

    function openModKey() {
        if (closed && FocusManager.activeElement && FocusManager.activeElement != editor.textInput.getElement()) {
            //cant handle anything other than shift
            pressed = {
                shift: pressed.shift
            }
            held = {
                shift: held.shift
            }
            return;
        }
        closed = false;
        if (!modKeyInput) {
            createModKeyInput();
        }
        FocusManager.hintChangeFocus();
        blurCount = 0
        modKeyInput.focus()
        editor.renderer.showCursor()
        editor.renderer.visualizeFocus()
        setTimeout(
            function() {
                if (!closed) {
                    blurCount = 0;
                    modKeyInput.focus()
                    editor.renderer.showCursor()
                    editor.renderer.visualizeFocus()

                }
            }, 100);
    }
    var clipboardHandler = new(require("ace/keyboard/hash_handler").HashHandler)();

    function doHandle(keyCode, hashId, keyString) {
        hashId |= getHash(true);

        lastBlurTime= 0;
        if (!getHash()) {
            closeModKey()
        }
        if (hashId) {
            var command = clipboardHandler.findKeyCommand(hashId, keys[keyCode]);
    
            if (command && command.exec) {
                command.exec(editor);
            }
            else command = editor.keyBinding.onCommandKey(null, hashId, keyCode);
        }
        else if(keyString){
            editor.keyBinding.onTextInput(keyString);
        }

    }
    clipboardHandler.bindKeys({
        "Ctrl-V": function() {
            editor.insert(clipboard.text || "");
        },
        "Ctrl-C": function() {
            clipboard.text = editor.getSelectedText()
        },
        "Ctrl-X": function() {
            clipboard.text = editor.getSelectedText()
            editor.insert("")
        }
    });

    var shortcut_click = function(id) {
        editor.execCommand(id)
    }

    function updateModColors(target, key) {
        if (target)
            target.style.color = held[key] ? "red" : pressed[key] ? "inherit" : "gray";
        else $("#actions .mod-key").each(function() {
            updateModColors(this, this.getAttribute('id'));
        })
    }
    var mod_key_click = function(key, target) {
        var clickT = new Date().getTime()
        if (clickT - (times[key] || 0) < 700) {
            held[key] = "double_tap";
        }
        else {
            if (held[key] == "double_tap" || pressed[key])
                pressed[key] = held[key] = false;
            else {
                pressed[key] = true;
            }
        }
        times[key] = clickT;
        if (pressed[key] || held[key])
            openModKey()
        if (!(getHash() || closed)) {
            closeModKey()
        }
        updateModColors(target, key);

    }

    function fireKey(el, keyCode, modifier) {
        if (document.createEventObject) {
            var eventObj = document.createEventObject();
            eventObj.keyCode = keyCode
            modifier && modifier.split("-").map(function(m) {
                if (m) eventObj[m + "Key"] = true;
            });
            el.fireEvent("onkeydown", eventObj);
            eventObj.keyCode = keyCode;
        }
        else if (document.createEvent) {
            var eventObj = document.createEvent("Events");
            eventObj.initEvent("keydown", true, true);
            eventObj.which = keyCode;
            eventObj.keyCode = keyCode
            modifier && modifier.split("-").map(function(m) {
                if (m) eventObj[m + "Key"] = true;
            });
            el.dispatchEvent(eventObj);
        }
    }
    var cursorSwapped = false;
    var dir_key_click = function(key) {
        var target = FocusManager.activeElement || editor.textInput.getElement();
        target.blur();
        var keyCode = keys[key];
        var modifier = keys.KEY_MODS[getHash(true)]
        if (key == "left" || key == "right") {
            var selection = [target.selectionStart, target.selectionEnd]
            var direction = key == "left" ? 1 : -1;
            if (modifier != "shift-") {
                if (selection[0] == selection[1]) {
                    if (selection[0] >= direction)
                        selection[0] -= direction;
                }
                else if (direction > -1) {
                    selection[0] = selection[1]
                }
                selection[1] = selection[0]
            }
            else {
                var start = cursorSwapped ? 1 : 0;
                if (selection[start] >= direction)
                    selection[start] -= direction;
                if (selection[0] > selection[1]) {
                    var b = selection[0];
                    cursorSwapped = true;
                    selection[0] = selection[1];
                    selection[1] = b;
                }
                else if (cursorSwapped && selection[0] == selection[1]) {
                    cursorSwapped = false;
                }
            }
            target.selectionStart = selection[0]
            target.selectionEnd = selection[1];
        }
        fireKey(target, keyCode, modifier);
    }

    function handleToolClick(e) {
        var target = $(e.target).closest("span")[0]
        if (!target) return
        var id = target.getAttribute('id');
        switch (id) {
            case "a-right":
            case "a-left":
            case "a-up":
            case "a-down":
                dir_key_click(id.slice(2));
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
                shortcut_click(id);
                break;
            case "shift":
            case "ctrl":
            case "alt":
            case "mod":
                mod_key_click(id, target);
                break;
            case "copy":
                clipboard.text = editor.getSelectedText();
                break;
            case "cut":
                clipboard.text = editor.getSelectedText();
                editor.insert("");
                break;
            case "paste":
                editor.insert(clipboard.text || "");
        }
        e.stopPropagation()
    }
    genToolBar();
    genCharBar(appConfig.characterBarChars);

    $("#toolbar").on("click", handleToolClick);
    $("#char-bar").on("mousedown", "span", handleCharClick);

    $("#actions").on(event_mousedown, startSwipe);
    $("#actions").on(event_mousemove, detectSwipe);

    $("#toolbar").on(event_mousedown, startLongpress);
    $("#toolbar").on(event_mouseup, stopLongPress);
    $("#toolbar").on("scroll", clearRepeat);

    $("#actions .fill_box").on("scroll", scrollLock);
    actions.click(function(e) {
        e.stopPropagation();
        //Overflow
    });

    $(".sidenav-trigger")[0].addEventListener("touchstart", function(e) {
        //prevent soft keyboard block
        FocusManager.hintChangeFocus();
    });
    
    var AutoComplete = require("ace/autocomplete").Autocomplete;
    var doBlur = AutoComplete.prototype.blurListener;
    AutoComplete.prototype.blurListener = function() {
        if (FocusManager.activeElement == this.editor.textInput.getElement())
            return;
        doBlur.apply(this, arguments);
    };
    
    FocusManager.trap(
        $("#actions,#toolbar-toggle"), true)

    global.CharBar = {
        setEditor: function(e) {
            editor = e;
        },
        setElement: function(el) {
            Element = el;
        },
        setClipboard: function(c) {
            clipboard = c
        },
        setTools: function(tools) {
            $('#toolbar').empty();
            genToolBar(tools);
        },
        setChars: function(char) {
            $("#char-bar").empty();
            chars = char
            genCharBar(chars);
        }
    }
})(Modules);