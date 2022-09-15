define(function (require, exports, module) {
    /*globals $*/
    //TODO add searchbox context
    var Dropdown = require('grace/ui/dropdown').Dropdown;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var lastPosition = 0;
    var SB_HEIGHT = 100;
    var SB_WIDTH = 300;
    var lastAlign = null;
    var refocus;
    var appEvents = require('grace/core/app_events').AppEvents;
    var editorView = require('grace/setup/setup_editors').editorView;
    var Searchbox = require('ace!ext/searchbox').SearchBox;
    var Config = require('grace/core/config').Config;
    var userAgent = ace.require('ace/lib/useragent');
    var keys = Config.registerAll(
        {
            toggleReplace: 'Ctrl-f|Command-f',
            focusReplace: 'Ctrl-H|Command-Option-F',
            findNext: 'Ctrl-G|Command-G',
            historyPrev: 'Up',
            historyNext: 'Down',
            findPrev: 'Ctrl-Shift-G|Command-Shift-G',
            closeSearchBox: 'esc',
            acceptAndFindNext: 'Return',
            acceptAndFindPrev: 'Shift-Return',
            findAll: 'Alt-Return',
            switchInput: 'Tab',
            toggleRegexpMode: userAgent.isMac
                ? 'Ctrl-Alt-R|Ctrl-Alt-/'
                : 'Alt-R|Alt-/',

            toggleCaseSensitive: userAgent.isMac
                ? 'Ctrl-Alt-R|Ctrl-Alt-I'
                : 'Alt-C|Alt-I',
            toggleWholeWords: userAgent.isMac
                ? 'Ctrl-Alt-B|Ctrl-Alt-W'
                : 'Alt-B|Alt-W',
        },
        'keyBindings.searchbox'
    );
    var SearchBox = getEditor().searchBox || new Searchbox(getEditor());
    Config.on('keyBindings.searchbox', updateCommands);
    function updateCommands() {
        SearchBox.$searchBarKb.commandKeyBinding = {};
        for (var i in keys) {
            SearchBox.$searchBarKb.bindKey(keys[i], i);
        }
    }
    updateCommands();
    if (SearchBox.editor != getEditor()) {
        SearchBox.setEditor(getEditor());
    }
    position();
    getEditor().renderer.on('resize', position);
    appEvents.on('changeEditor', handleChangeEditor);

    function handleChangeEditor(ev) {
        var e = ev.editor;
        $(e.container).addClass('active_editor');
        if (ev.oldEditor) {
            $(ev.oldEditor.container).removeClass('active_editor');
            ev.oldEditor.renderer.off('resize', position);
        }
        SearchBox.setEditor(e);
        e.renderer.on('resize', position);
        position();
    }

    function position() {
        var el = SearchBox.element;
        var editDiv = SearchBox.editor.container;
        var editRect = editDiv.getBoundingClientRect();
        var inContent = el.parentElement != editDiv;
        if (editRect.height > SB_HEIGHT * 3) {
            //portrait editor
            var W = $('.content').width();
            var l = 0,
                r = 0;
            if (lastAlign != SearchBox.ALIGN_ABOVE) {
                SearchBox.alignContainer(SearchBox.ALIGN_ABOVE);
                lastAlign = SearchBox.ALIGN_ABOVE;
            }
            if (lastPosition < 5) {
                el.style.top = 0;
                el.style.bottom = 'auto';
                lastPosition = 5;
            }
            if (
                editRect.width < SB_WIDTH ||
                //avoid jolting changes due to keyboard focus
                (inContent && SearchBox.active)
            ) {
                if (!inContent) {
                    refocus = require('grace/ui/focus_manager').FocusManager.visit(
                        FocusManager.activeElement
                    );
                    $('.content')[0].appendChild(SearchBox.element);
                    refocus();
                    inContent = true;
                }
                //in content overlapping and overflowing
                el.style.top = editRect.top + 'px';
            } else {
                //in editDiv, overlapping no overflow
                if (inContent) {
                    refocus = require('grace/ui/focus_manager').FocusManager.visit(
                        FocusManager.activeElement
                    );
                    editDiv.appendChild(el);
                    refocus();
                    inContent = false;
                }
                l = editRect.left;
                r = W - editRect.right;
                el.style.top = 0;
            }
            var p = Dropdown.clipWindow(editRect, SB_WIDTH, W, false);
            if (p[0] === undefined) {
                el.style.right = p[1] - r + 'px';
                el.style.left = 'auto';
            } else {
                el.style.right = 'auto';
                el.style.left = p[0] - l + 'px';
            }
        } else {
            //small editor height
            if (!inContent) {
                refocus = require('grace/ui/focus_manager').FocusManager.visit(
                    require('grace/ui/focus_manager').FocusManager.activeElement
                );
                $('.content')[0].appendChild(SearchBox.element);
                refocus();
                inContent = true;
            }
            var u = editorView.$el[0].getBoundingClientRect();
            var cleared = true;
            if (editRect.left - u.left > SB_WIDTH) {
                el.style.right = 'auto';
                el.style.left = 0;
            } else {
                if (u.right - editRect.right < SB_WIDTH) cleared = false;
                el.style.right = 0;
                el.style.left = 'auto';
            }
            if (cleared || u.bottom - editRect.bottom < SB_HEIGHT) {
                if (editRect.top - u.top < SB_HEIGHT) {
                    //not cleared
                }
                //outside editor above
                el.style.top = u.top + 'px';
                el.style.bottom = 'auto';
            } else {
                //outside editor below
                el.style.top = 'auto';
                el.style.bottom = window.innerHeight - u.bottom + 'px';
            }
            lastPosition = 1;
            if (lastAlign != SearchBox.ALIGN_NONE) {
                SearchBox.alignContainer(SearchBox.ALIGN_NONE);
                lastAlign = SearchBox.ALIGN_NONE;
            }
        }
    }
});