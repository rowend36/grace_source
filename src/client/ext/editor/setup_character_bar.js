define(function (require, exports, module) {
    /*globals $*/
    var TextEdit = require('./textedit').TextEdit;
    var Mods = require('./mods').Mods;
    var rootView = require('grace/setup/setup_root').rootView;
    //Could just use Hammer for these
    //swipe to open
    var SwipeDetector = require('./swipe_detector').SwipeDetector;
    var ScrollLock = require('./scroll_lock').ScrollLock;
    var RepeatDetector = require('./repeat_detector').RepeatDetector;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            showCharacterBar: !Env.isHardwareKeyboard,
            toolbarPosition: 'below',
            enableModKeys: Env.isHardwareKeyboard ? '' : 'shift,ctrl,alt',
            enableArrowKeys: !Env.isHardwareKeyboard,
            enableLockScrolling: true,
            showToolbarToggle: true,
            characterBarChars: [
                '\t',
                '<',
                '</',
                '>',
                '/',
                '=',
                '{--S--}',
                '</>--N--<--W----C--></--W-->',
                '--L--@',
                ':',
                '*',
                '+',
                '-',
                '(',
                ')',
                '[',
                ']',
                '{',
                '}',
                '_--L--',
                'func--N----L--function(){\n\t--C--}',
                'class--N--class --W-- {\n--C--}',
                '--S--',
            ],
        },
        'toolbars'
    );

    var configEvents = require('grace/core/config').Config;
    var Utils = require('grace/core/utils').Utils;
    var View = require('grace/ui/view').View;
    var allTools = require('./all_tools').allTools;
    var MOD_KEYS = ['shift', 'ctrl', 'alt', 'esc', 'home', 'end'];
    require('grace/core/config').Config.registerInfo(
        {
            characterBarChars:
                "characters to show on character bar\n\
It's a bit similar to snippets. But with a different syntax\n\
--S-- represents selected text,\n\
--C-- shows where to move cursor to.\
<caption>--N-- denotes the display caption(must come before any other text example: func--N----L--function(){\t--C--}) , \
\n--L-- a point to lock character bar scrolling see .lockScrolling\n\
--W-- represents the word before the cursor - Note: using it will also remove the word\n",
            showCharacterBar: 'Whether to show character bar',
            toolbarPosition: {
                doc: 'How to show toolbar',
                values: ['above', 'below', [false, "Don't show"]],
            },
            enableModKeys: {
                doc: 'Modifier keys to show in toolbar',
                values: MOD_KEYS,
                isList: true,
            },
            enableLockScrolling: 'Allows character bar to jump to clamp scroll',
            enableArrowKeys: 'Whether to show directional keys',
        },
        'toolbars'
    );
    var postRebuild;
    configEvents.on('toolbars', function (e) {
        switch (e.config) {
            case 'characterBarChars':
                setChars(e.value());
                break;
            default:
                postRebuild = postRebuild || Utils.delay(rebuild);
                postRebuild();
        }
    });
    //Remember when stupid previous regex code cost me hours of debugging, tip: if you put enough spaces spaces (like 10000) in a className, it changes something
    function setCls(name, cls, yes) {
        yes = !!yes;
        var i = name.indexOf(cls);
        if (yes === i < 0) {
            if (yes) name.push(cls);
            else name.splice(i, 1);
        }
    }
    Mods.setChangeListener(function update(key, ev) {
        var element = metabar || toolbar;
        if (!element) return;
        if (key) {
            var target = element.find('#' + key)[0];
            var isMod = key == 'ctrl' || key == 'alt' || key == 'shift';
            var name = target.className.split(' ');
            setCls(name, 'mod-key-held', ev.held[key]);
            setCls(
                name,
                'mod-key-active',
                !isMod || (ev.pressed[key] && !ev.held[key])
            );
            setCls(
                name,
                'color-inactive',
                isMod && !(ev.held[key] || ev.pressed[key])
            );
            target.className = name.join(' ').replace('  ', ' '); //:)
        } else {
            var all = element.find('.mod-key');
            for (var i = 0; i < all.length; i++) {
                update(all[i].id, ev);
            }
        }
    });

    var editor;

    var topEl, topBar, bottomEls, bottomBar, pageToggle;

    function createToolbar(pos) {
        var bar = document.createElement('div');
        bar.style[pos] = '0';
        bar.className = 'toolbar sidenav-pushable';

        FocusManager.trap($(bar), true);
        return bar;
    }

    function createPageToggle(bar) {
        bar.className += ' edge_box-1-0';
        var toggle = document.createElement('button');
        toggle.style.paddingLeft = '10px';
        toggle.className = 'tool-swapper side-1';
        toggle.innerHTML = '<i class="material-icons">swap_horiz</i>';
        bar.insertBefore(toggle, bar.firstChild);
        var index = 0;
        toggle.onclick = function (e) {
            var element = bottomEls[index];
            element.hide();
            index = (index + 1) % bottomEls.length;
            element = bottomEls[index];
            element.show();
            e.stopPropagation();
        };
        return toggle;
    }

    function addElement(el, above) {
        if (above) {
            if (topEl) throw 'Error: multiple top bars';
            topEl = el;
            if (!topBar) {
                topBar = $(createToolbar('top'));
                topBar.addClass('top-bar shadow-bottom');
            }
            topBar[0].appendChild(topEl[0]);
        } else {
            if (!bottomBar) {
                bottomEls = [];
                bottomBar = $(createToolbar('bottom'));
                bottomBar.addClass('bottom-bar shadow-top');
            }
            bottomEls.push(el);
            bottomBar[0].appendChild(el[0]);
            if (bottomEls.length > 1 && !pageToggle) {
                pageToggle = createPageToggle(bottomBar[0]);
                el[0].style.display = 'none';
            }
        }
        el.addClass('fill_box');
    }

    var floatingToggle;

    function createFloatingToggle() {
        if (!floatingToggle) {
            floatingToggle = $(
                '<button id="toolbar-toggle" class="shadow-top opaque-on-hover">' +
                    '<i class="material-icons">keyboard_arrow_down</i>' +
                    '</button>'
            );
            floatingToggle.click(function (e) {
                bottomView.toggle();
                if (bottomView.hidden) {
                    this.style.bottom = '10px';
                    floatingToggle.html(
                        '<i class="material-icons">keyboard_arrow_up</i>'
                    );
                } else {
                    this.style.bottom = bottomBar.css('height');
                    floatingToggle.html(
                        '<i class="material-icons">keyboard_arrow_down</i>'
                    );
                }
                e.stopPropagation();
            });
            FocusManager.trap(floatingToggle, true);
            rootView.$el.append(floatingToggle);
        }
    }

    //views used by linearlayout
    var bottomView, topView;

    function createToolsView(tools, scrollPoints) {
        var toolbar = document.createElement('div');
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
            if (!data) continue;
            var icon = typeof data == 'string' ? data : data.icon;
            var text =
                data.caption || "<i class='material-icons'>" + icon + '</i>';
            var span = document.createElement('button');
            span.innerHTML = text;
            if (data.caption) {
                span.className = 'mod-key';
            }
            if (lockScroll[command]) {
                span.className += ' scroll-point';
            }
            span.setAttribute('id', command);
            toolbar.appendChild(span);
        }
        return toolbar;
    }

    function handleToolClick(e) {
        var target = $(e.target).closest('button')[0];
        if (!target) return;
        var id = target.getAttribute('id');
        switch (id) {
            case 'shift':
            case 'ctrl':
            case 'alt':
                Mods.press(id, target);
                break;
            case 'a-right':
            case 'a-left':
            case 'a-up':
            case 'a-down':
                Mods.dispatch(id.slice(2));
                break;
            case 'esc':
            case 'home':
            case 'end':
                Mods.dispatch(id);
                break;
            case 'copy':
            case 'cut':
            case 'paste':
                Mods.handleClipboard(id);
                break;
            case 'find':
            case 'gotoline':
            case 'openCommandPallete':
                //require focus-
                //may later decide to use settimeout
                FocusManager.hintChangeFocus();
            /*fall through*/
            default:
                editor.execCommand(id);
        }
        e.stopPropagation();
    }

    function handleContextMenu(e) {
        var target = $(e.target).closest('button')[0];
        if (!target) return;
        var id = target.getAttribute('id');
        var action = allTools[id] && allTools[id].onhold;
        if (action && action !== 'repeat' && action !== 'repeatKey') {
            editor.execCommand(allTools[id].onhold);
        }
        e.preventDefault();
    }

    function stopPropagation(e) {
        e.stopPropagation();
    }

    function createCharactersView(chars) {
        var bar = document.createElement('div');
        for (var o in chars) {
            var i = require('grace/core/utils')
                .Utils.htmlEncode(chars[o])
                .replace(/'/g, "\\'");

            var caption = '';
            var t = null;
            if (i.indexOf('--N--') > -1) {
                t = i.split('--N--');
                caption = t[0];
                i = t[t.length - 1].replace();
            }
            var el = "<button value='";
            if (i.indexOf('--L--') > -1) {
                i = i.replace('--L--', '');
                el += i + "' class='scroll-point'>";
            } else {
                el += i + "'>";
            }

            caption =
                caption ||
                i
                    .replace('--C--', '')
                    .replace(/--S--/g, '')
                    .replace('--W--', '')
                    .replace(
                        /\t/g,
                        "<i class='material-icons'>keyboard_tab</i>"
                    )
                    .replace(/\n/g, '&rdsh;');
            el += caption + '</button>';
            $(bar).append(el);
            if (t) {
                var displayLength = caption.replace(/&\w+;/g, '-').length;
                $(bar)
                    .children()
                    .last()
                    .css('font-size', 60.0 / displayLength);
            }
        }
        return bar;
    }

    function handleCharClick(e) {
        var val = $(this).attr('value');
        if (val == '\t' /*special case*/) {
            return Mods.dispatch('tab');
        }
        var target =
            FocusManager.activeElement || editor.textInput.getElement();
        var edit = TextEdit.from(target);
        var sel = edit.selection();
        if (val.indexOf('--W--') > 0) {
            var prec = edit.wordBefore();
            val = val.replace(/--W--/g, prec);
            edit.delete(prec.length);
        }
        val = val.replace(/--S--/g, sel);
        var cursor_pos = val.indexOf('--C--');
        val = val.replace('--C--', '');
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
            bottomEls.forEach(function (e) {
                e.remove();
            });
            bottomEls.length = 0;
        }
    }
    //kept across rebuilds
    var toolbar, metabar, charbar, swipe;

    function rebuild() {
        destroy();
        var tools = Object.keys(allTools);
        var modtools;
        var toRemove = MOD_KEYS;
        var totalMods = MOD_KEYS.length + 4;
        if (!appConfig.enableArrowKeys) {
            tools.splice(tools.indexOf('a-left'), 4);
            totalMods -= 4;
        }
        if (appConfig.enableModKeys) {
            var items = Utils.parseList(appConfig.enableModKeys);
            toRemove = toRemove.filter(Utils.notIn(items));
        }
        var filtered = tools.filter(Utils.notIn(toRemove));
        totalMods -= tools.length - filtered.length;
        tools = filtered;

        if (totalMods > 0 && appConfig.toolbarPosition !== 'below') {
            modtools = [
                'startAutocomplete',
                'esc',
                'shift',
                'ctrl',
                'a-left',
                'a-down',
                'a-up',
                'a-right',
                'alt',
                'home',
                'end',
            ];
            tools = tools.filter(Utils.notIn(modtools));
        }

        var lock;
        if (appConfig.enableLockScrolling) {
            lock = ScrollLock();
        }
        var event_mousedown =
            'ontouchstart' in window ? 'touchstart' : 'mousedown';
        var event_mouseup = 'ontouchend' in window ? 'touchend' : 'mouseup';
        var event_mousemove =
            'ontouchmove' in window ? 'touchmove' : 'mousemove';

        var repeat;
        if (appConfig.toolbarPosition)
            toolbar = $(
                createToolsView(tools, [
                    ['esc', 'shift', 'ctrl', 'a-left'],
                    'paste',
                ])
            );
        if (modtools) {
            metabar = $(createToolsView(modtools));
        }
        Mods.setClipboard(
            require('grace/ext/editor/enhanced_clipboard').clipboard
        );

        if (toolbar || metabar) {
            repeat = RepeatDetector(function (command) {
                editor.execCommand(command);
            });
        }
        //not mousedown because of focus
        if (toolbar) {
            toolbar.on('click', handleToolClick);
            toolbar.on(event_mousedown, repeat.start);
            lock && toolbar.on(event_mousedown, lock.cancel);
            lock && toolbar.on(event_mouseup, lock.onRelease);
            toolbar.on(event_mouseup, repeat.end);
            toolbar.on('scroll', repeat.cancel);
            toolbar.on('contextmenu', handleContextMenu);
            lock && toolbar.on('scroll', lock.onScroll);
            addElement(toolbar, appConfig.toolbarPosition == 'above');
        }
        if (metabar) {
            metabar.on('click', handleToolClick);
            metabar.on(event_mousedown, repeat.start);
            metabar.on(event_mouseup, repeat.end);
            metabar.on('scroll', repeat.cancel);
            addElement(metabar);
        }

        if (appConfig.showCharacterBar) {
            charbar = $(createCharactersView(appConfig.characterBarChars));
            charbar.on('mousedown', 'button', handleCharClick);
            lock && charbar.on('scroll', lock.onScroll);
            lock && charbar.on(event_mousedown, lock.cancel);
            lock && charbar.on(event_mouseup, lock.onRelease);
            addElement(charbar);
        }
        if (bottomBar && bottomEls.length > 0 && appConfig.showToolbarToggle) {
            if (floatingToggle) floatingToggle.show();
            else createFloatingToggle();
            $('#status-filename').css('left', '60px');
        } else {
            floatingToggle.hide();
            $('#status-filename').css('left', '10px');
        }
        if (bottomBar && bottomEls.length < 1) {
            bottomView.hide();
        } else if (bottomEls && bottomEls.length > 0) {
            if (!swipe) {
                swipe = SwipeDetector(bottomBar, function () {
                    bottomBar.css('height', 'auto');
                    bottomView.layout_height = bottomBar.height();
                    bottomView.parent.render();
                    if (floatingToggle)
                        floatingToggle.css('bottom', bottomView.layout_height);
                });
                bottomBar.on(event_mousedown, swipe.start);
                bottomBar.on(event_mousemove, swipe.move);
                bottomBar.click(stopPropagation);
                bottomView = new View(bottomBar);
                rootView.addView(bottomView, 100, 40, 0);
                if (!pageToggle) bottomEls[0].css('padding-left', '20px');
            } else {
                bottomView.show();
                if (bottomEls.length > 1) {
                    $(pageToggle).show();
                    bottomBar.addClass('edge_box-1-0');
                } else {
                    if (pageToggle) {
                        $(pageToggle).hide();
                        bottomBar.removeClass('edge_box-1-0');
                    }
                    bottomEls[0].css('padding-left', '20px');
                }
            }
        }

        //todo remove topBar/bottomBar if unneeded
        if (topBar && !topEl) {
            topView.hide();
        } else if (topEl) {
            if (!topView) {
                topView = new View(topBar);
                rootView.addView(topView, 1.5, 40, 0, 1);
            } else topView.show();
        }
    }

    function setChars(char) {
        var bar = createCharactersView(char);
        if (charbar) charbar.html(bar.innerHTML);
    }

    var updateRecordingIcon = Utils.delay(function () {
        var editor = getEditor();
        if (toolbar && editor && editor.commands.recording) {
            $('#togglerecording', toolbar).addClass('blink');
        } else $('#togglerecording', toolbar).removeClass('blink');
    }, 100);
    var trackStatus = function (e) {
        (e.editor || e).on('changeStatus', updateRecordingIcon);
    };

    exports.CharBar = {
        setEditor: function (e) {
            editor = e;
            Mods.setEditor(e);
        },
        addCommand: function (command, data) {
            allTools[command] = data;
        },
        setTools: function (tool_list) {
            var bar = createToolsView(tool_list);
            toolbar && toolbar.html(bar.innerHTML);
        },
        setChars: setChars,
    };
    var appEvents = require('grace/core/app_events').AppEvents;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var forEachEditor = require('grace/editor/editors').Editors.forEach;

    appEvents.on('changeEditor', updateRecordingIcon);
    appEvents.on('createEditor', trackStatus);
    forEachEditor(trackStatus);
    exports.CharBar.setEditor(getEditor());
    appEvents.on('changeEditor', function (e) {
        exports.CharBar.setEditor(e.editor);
    });
    rebuild();
}); /*_EndDefine*/