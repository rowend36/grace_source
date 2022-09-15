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
        
        startAutocomplete: {
            icon: "fast_forward",
        },
        find: "search",
        gotoline: {
            icon: "call_made",
        },
        openCommandPallete: {
            icon: "more_horiz",
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
        cut: "content_cut",
        copy: "content_copy",
        paste: {
            icon: "content_paste",
            onhold: "softClipboardOpen",
        },
        findprevious: "chevron_left",
        findnext: "chevron_right",
        goToNextError: "warning",
        togglerecording: "fiber_manual_record",
        replaymacro: "replay",
        toggleFullscreen: "fullscreen",
    };
});