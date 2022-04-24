define(function (require, exports, module) {
    /**
     * @typedef {string} EditorCommand
     * @typedef {string} IconName
     * @typedef {{icon?:IconName,onhold?:EditorCommand,caption?:string}} ToolConfig
     * @type {{editorCommand:(IconName|ToolConfig)}} allTools
     **/
    exports.allTools = {
        save: {
            icon: "save",
            onhold: "saveAs",
        },
        undo: {
            icon: "undo",
            onhold: "repeat",
        },
        redo: {
            icon: "redo",
            onhold: "repeat",
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
            onhold: "repeatKey",
        },
        "a-up": {
            icon: "arrow_upward",
            onhold: "repeatKey",
        },
        "a-down": {
            icon: "arrow_downward",
            onhold: "repeatKey",
        },
        "a-right": {
            icon: "arrow_forward",
            onhold: "repeatKey",
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
});