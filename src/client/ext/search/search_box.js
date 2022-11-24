define(function(require, exports, module) {
    'use strict';
    /*globals $*/
    //TODO add searchbox context
    var getEditor = require('grace/setup/setup_editors')
        .getEditor;
    var FocusManager = require('grace/ui/focus_manager')
        .FocusManager;
    var appEvents = require('grace/core/app_events')
        .AppEvents;
    var editorView = require('grace/setup/setup_editors')
        .editorView;
    var Searchbox = require('ace!ext/searchbox')
        .SearchBox;
    var History = require('grace/ui/history')
        .History;
    var Config = require('grace/core/config')
        .Config;
    var userAgent = require('ace!lib/useragent');
    var keys = Config.registerAll({
        toggleReplace: 'Ctrl-f|Command-f',
        focusReplace: 'Ctrl-H|Command-Option-F',
        findNext: 'Ctrl-G|Command-G',
        findPrev: 'Ctrl-Shift-G|Command-Shift-G',
        closeSearchBox: 'esc',
        acceptAndFindNext: 'Return',
        acceptAndFindPrev: 'Shift-Return',
        findAll: 'Alt-Return',
        switchInput: 'Tab',
        toggleRegexpMode: userAgent.isMac ? 'Ctrl-Alt-R|Ctrl-Alt-/' : 'Alt-R|Alt-/',
        toggleCaseSensitive: userAgent.isMac ? 'Ctrl-Alt-R|Ctrl-Alt-I' : 'Alt-C|Alt-I',
        toggleWholeWords: userAgent.isMac ? 'Ctrl-Alt-B|Ctrl-Alt-W' : 'Alt-B|Alt-W',
    }, 'keyBindings.searchbox');

    function updateCommands() {
        for (var o in keys) {
            sb.$searchBarKb.removeCommand(o, true);
        }
        for (var i in keys) {
            sb.$searchBarKb.bindKey(keys[i], sb.$searchBarKb.commands[i]);
        }
    }

    function handleChangeEditor(ev) {
        var e = ev.editor;
        $(e.container)
            .addClass('active_editor');
        if (ev.oldEditor) {
            $(ev.oldEditor.container)
                .removeClass('active_editor');
            ev.oldEditor.renderer.off('resize', position);
        }
        sb.setEditor(e);
        e.renderer.on('resize', position);
        position();
    }
    var lastPosition = 256;

    function position(isResize) {
        var editDiv = sb.editor.container;
        var editRect = editDiv.getBoundingClientRect();
        var el = sb.element;
        var inEditor = el.parentElement === editDiv;
        //Infer position
        var IN_TOP = 1;
        var IN_BOTTOM = 2;
        var IN = IN_TOP | IN_BOTTOM;
        var OUT_TOP = 4;
        var OUT_BOTTOM = 8;
        var OUT_LEFT = 16;
        var OUT_RIGHT = 32;
        var OVERLAP_TOP = 64;
        var OVERLAP_BOTTOM = 128;
        var SB_HEIGHT = 100;
        var SB_WIDTH = 300;
        var possible = 0;
        if (editRect.height > SB_HEIGHT * 3 && editRect.width > SB_WIDTH) {
            possible |= IN;
            if (inEditor && lastPosition === IN_TOP) return;
        }
        var contentRect = editorView.$el[0].getBoundingClientRect();
        if (contentRect.top - editRect.bottom > SB_HEIGHT * 2) possible |= OVERLAP_TOP;
        if (editRect.top - contentRect.bottom > SB_HEIGHT * 2) possible |= OVERLAP_BOTTOM;
        if (editRect.top - contentRect.top > SB_HEIGHT) {
            possible |= OUT_TOP;
        }
        if (editRect.left - contentRect.left > SB_WIDTH) {
            possible |= OUT_LEFT;
        }
        if (contentRect.bottom - editRect.bottom > SB_HEIGHT) {
            possible |= OUT_BOTTOM;
        }
        if (contentRect.right - editRect.right > SB_WIDTH) {
            possible |= OUT_RIGHT;
        }
        if (!possible) possible = OVERLAP_TOP;
        if (isResize && (lastPosition | possible) === possible) return;
        var position = 0;
        var preference = [
            IN_TOP,
            OUT_TOP,
            OUT_BOTTOM,
            OUT_LEFT,
            OUT_RIGHT,
            OVERLAP_TOP,
            OVERLAP_BOTTOM,
        ];
        for (var i in preference) {
            if (possible & preference[i]) {
                position = preference[i];
                break;
            }
        }
        var inContent = el.parentElement == editorView.$el[0];
        var trapFocus = FocusManager.activeElement;
        if (position & IN && !inEditor) {
            editDiv.appendChild(el);
            if (trapFocus) trapFocus.focus();
        } else if (!(position & IN) && !inContent) {
            editorView.$el[0].appendChild(el);
            if (trapFocus) trapFocus.focus();
        } else if (position === lastPosition) return;
        switch (position) {
            case OUT_LEFT:
                el.style.right = SB_WIDTH + 'px';
                el.style.left = 0;
                break;
            case OUT_RIGHT:
                el.style.left = SB_WIDTH + 'px';
                el.style.right = 0;
                break;
            default:
                el.style.left = '';
                el.style.right = '';
        }
        switch (position) {
            case IN_BOTTOM:
            case OVERLAP_BOTTOM:
            case OUT_BOTTOM:
                el.style.bottom = '10px';
                el.style.top = 'auto';
                break;
            default:
                el.style.top = 0;
                el.style.bottom = 'auto';
        }
        switch (position) {
            case IN_BOTTOM:
            case OVERLAP_BOTTOM:
                sb.alignContainer(sb.ALIGN_BELOW);
                break;
            case IN_TOP:
            case OVERLAP_TOP:
                sb.alignContainer(sb.ALIGN_ABOVE);
                break;
            default:
                sb.alignContainer(sb.ALIGN_NONE);
        }
    }
    var sb = getEditor()
        .searchBox || new Searchbox(getEditor());
    sb.searchHistory = new History();
    sb.searchHistory.create = function() {
        return {
            search: sb.searchInput.value,
            replace: sb.replaceOption.checked && sb.replaceInput.value,
        };
    };
    sb.searchHistory.equals = function(val, val2) {
        //My apologies: Push if search queries differ or replace queries both exist and are different
        return !val2.search || (val && (val.search === val2.search) && (!val2.replace || (val.replace ? val
            .replace === val2.replace : ((val.replace = val2.replace), true))));
    };
    if (sb.editor != getEditor()) {
        sb.setEditor(getEditor());
    }
    getEditor()
        .renderer.on('resize', position);
    position();
    updateCommands();
    Config.on('keyBindings.searchbox', updateCommands);
    appEvents.on('changeEditor', handleChangeEditor);
});