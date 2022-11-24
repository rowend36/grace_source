define(function (require, exports, module) {
    'use strict';
    /**
     * The majority of the ace api we make use of.
     * Missing parts include EditSession, Document,
     * TokenIterator and UndoManager since those are
     * part of Doc.
     **/
    function Editor(ace) {
        this.ace = ace;
        this.renderer = new Renderer(ace.renderer);
        this.textInput = new TextInput(ace.textInput);
        this.commands = new Commands(ace.commands);
        this.getPopupMargins = ace.getPopupMargins;
        this.keyBinding = new KeyBinding(ace.keyBinding);
        ace.getPopupMargins = function () {
            return this.getPopupMargins();
        }.bind(this);
    }
    Editor.prototype = {
        execCommand: function (e, args) {
            this.ace.execCommand(e, args);
        },
        setOption: function (e, args) {
            this.ace.setOption(e, args);
        },
        setOptions: function (e, args) {
            this.ace.setOptions(e, args);
        },
        getOption: function (e) {
            return this.ace.getOption(e);
        },
        getSelection: function () {
            return this.ace.getSelection();
        },
        getMainCompleter: function () {
            return this.ace.getMainCompleter();
        },
        getCopyText: function () {
            return this.ace.getCopyText();
        },
        getSelectionRange: function () {
            return this.ace.getSelectionRange();
        },
        getCursorPosition: function () {
            return this.ace.getCursorPosition();
        },
        gotoLine: function (a, b) {
            return this.ace.gotoLine(a, b);
        },
        find: function (e) {
            return this.ace.find(e);
        },
        once: function (f, g, h) {
            return this.ace.once(f, g, h);
        },
        insert: function (text, pasted) {
            return this.ace.insert(text, pasted);
        },
        jumpToMatching: function (e) {
            return this.ace.jumpToMatching(e);
        },
        centerSelection: function () {
            return this.ace.centerSelection();
        },
        get session() {
            return this.ace.session;
        },
        get container() {
            return this.ace.container;
        },
        /**
         * @returns []
         */
        get completers() {
            return this.ace.completers;
        },
        focus: function () {
            return this.ace.focus();
        },
        resize: function () {
            return this.ace.resize();
        },
        on: function (e, f, g) {
            return this.ace.on(e, f, g);
        },
        off: function (e, f, g) {
            return this.ace.off(e, f, g);
        },
        exitMultiSelectMode: function () {
            this.ace.exitMultiSelectMode();
        },
    };
    function Renderer(r) {
        this.aceRenderer = r;
    }
    Renderer.prototype = {
        freeze: function () {
            this.aceRenderer.freeze();
        },
        unfreeze: function () {
            this.aceRenderer.unfreeze();
        },
        showCursor: function () {
            this.aceRenderer.showCursor();
        },
        getCursorPosition: function () {
            return this.aceRenderer.getCursorPosition();
        },
        visualizeBlur: function () {
            this.aceRenderer.visualizeBlur();
        },
        visualizeFocus: function () {
            this.aceRenderer.visualizeFocus();
        },
        get theme() {
            return this.aceRenderer.theme;
        },
        on: function (e, f) {
            this.aceRenderer.on(e, f);
        },
        off: function (e, f) {
            this.aceRenderer.off(e, f);
        },
        get $theme() {
            return this.aceRenderer.$theme;
        },
        get lineHeight() {
            return this.aceRenderer.lineHeight;
        },
    };

    function TextInput(textInput) {
        this.aceTextInput = textInput;
    }
    TextInput.prototype = {
        focus: function () {
            this.aceTextInput.focus();
        },
        getElement: function () {
            return this.aceTextInput.getElemnent();
        },
    };
    function Commands(commands) {
        this.aceCommands = commands;
    }
    Commands.prototype = {
        addCommand: function (command) {
            this.aceCommands.addCommand(command);
        },
        removeCommand: function (command) {
            this.aceCommands.removeCommand(command);
        },
        get recording() {
            return this.aceCommands.recording;
        },
    };

    function KeyBinding(kb) {
        this.kb = kb;
    }
    KeyBinding.prototype = {
        get $defaultHandler() {
            return this.kb.$defaultHandler;
        },
        get $mainKeyboardHandler() {
            return this.kb.$mainKeyboardHandler;
        },
        get $userKbHandler() {
            return this.kb.$userKbHandler;
        },
        addKeyboardHandler: function(kb, index) {
            this.kb.addKeyboardHandler(kb, index);
        },
        removeKeyboardHandler: function(kb) {
            this.kb.removeKeyboardHandler(kb);
        },
    };
    exports.Editor = Editor;
});