define(function (require, exports, module) {
    'use strict';
    /*globals M*/
    //runtime class
    //FocusManager - a class to manager transfer of
    //focus in mobile
    //FocusManager.trap
    //The first method ensures clicks to a particular element
    //never blur an active input aka Android focusableInTouchMode
    //FocusManager.focusIfKeyboard
    //Allows intuitve movement of softKeyboard focus
    //as well as editor shortcuts used by InvisibleTextArea
    //FocusManager.visit
    //Moves focus an element and returns a function that when called resets focus to
    //the previously focused element if any
    /**
     *  The Virtual Keyboard Detector
     */
    //The amount of time after a focus during which we can assume any
    //resize is caused by soft keboard visibility
    var FOCUS_RESIZE_WINDOW = (exports.FOCUS_RESIZE_WINDOW = 800);
    var events = require('../core/app_events').AppEvents;
    var setImmediate = require('../core/utils').Utils.setImmediate;
    var noop = require('../core/utils').Utils.noop;
    var cyclicRequire = require;
    var virtualKeyboardVisible = false;
    var KeyboardDetector;
    var debugKey = false;
    var debug = console;
    //One of the reasons why he default value of Env.isHardwareKeyboard is false
    if (!Env.isHardwareKeyboard) {
        //>250 lines instead of an Android interface just so you can work on the web
        KeyboardDetector = (function (window, undefined) {
            //if you want something done well do it yourself

            /**
             * Public functions
             */

            function init() {
                initResizeListener();
            }

            /**
             * Private functions
             */

            
            function initResizeListener() {
                window.addEventListener('resize', resizeHandler);
            }

            function resizeHandler() {
                var score = window.innerHeight < screen.availHeight - 250 ? 1 : -1;
                if (debugKey) {
                    debug.log({
                        trust: 5,
                        visible: score>0 === virtualKeyboardVisible?'unchanged':score===0?'unsure':score>0?'visibke':'hidden',
                        // heightDiff: heightDiff,
                        score: score,
                    });
                    cyclicRequire('./notify').Notify.info(score>0 === virtualKeyboardVisible?'unchanged':score===0?'unsure':score>0?'visibke':'hidden')
                }
                if (score > 0 && !virtualKeyboardVisible) {
                    virtualKeyboardVisible = true;
                    events.trigger('keyboardChanged', {
                        visible: true,
                        isTrusted: score > 1,
                    });
                } else if (score < 0 && virtualKeyboardVisible) {
                    virtualKeyboardVisible = false;
                    events.trigger('keyboardChanged', {
                        visible: false,
                        isTrusted: score < -1,
                    });
                } else if (score <= 1 && score >= -1) {
                    //keep on firing events until we are sure of what we are sure of virtualKeyboard value
                    events.trigger('keyboardChanged', {
                        visible: virtualKeyboardVisible,
                        isTrusted: false,
                    });
                }
            }
            // Make public functions available
            return {
                init: init,
                learn: noop,
                cancelWait: noop,
            };
        })(window);
        KeyboardDetector.init();
    }
    //start tracking active element and stop loss of focus;
    var activeElement;

    function focus(el) {
        if (!el.parentElement) return;
        //Modals trap focus horribly
        M.Modal._ignoreOutsideFocus = true;
        //ace has special focus handling
        //for old browsers
        if (el.parentElement.env) {
            el.parentElement.env.editor.textInput.focus();
        } else {
            el.focus();
        }
        M.Modal._ignoreOutsideFocus = false;
        setImmediate(function () {
            if (activeElement === el && !hasFocusedInput()) {
                focus(activeElement);
            }
        });
    }

    function autoRefocus(e) {
        if (e && KeyboardDetector) KeyboardDetector.learn();
        if (!(Env.isHardwareKeyboard || virtualKeyboardVisible)) return;
        var currentElement = document.activeElement;
        if (!isFocusable(currentElement)) return;
        if (activeElement) {
            if (activeElement == currentElement) {
                if (clearRefocusTimer) {
                    clearTimeout(clearRefocusTimer);
                    clearRefocusTimer = null;
                }
                return;
            }
            postClearRefocus(true);
            // } else return;
        }
        activeElement = currentElement;
        activeElement.addEventListener('blur', on_blur);
        document.addEventListener('focusin', on_blur);
        focus(activeElement);
    }

    function autoRefocusEagerly(e) {
        autoRefocus(e);
        if (activeElement) {
            hook = true;
        }
    }

    function stopAutoRefocus() {
        activeElement.removeEventListener('blur', on_blur);
        document.removeEventListener('focusin', on_blur);
        activeElement = null;
        hook = false;
        clearRefocusTimer = null;
    }

    var clearRefocusTimer = null;

    function isFocusable(el) {
        if (el.tagName == 'TEXTAREA') return !el.readOnly;
        if (el.tagName == 'INPUT') {
            var type = el.type;
            switch (type) {
                case 'radio':
                case 'checkbox':
                case 'file':
                case 'reset':
                case 'button':
                case 'submit':
                    return false;
                default:
                    return !(el.readOnly || el.disabled);
            }
        }
        return el.contentEditable === true;
    }

    function postClearRefocus(immediate) {
        if (!activeElement) return;
        if (clearRefocusTimer) {
            clearTimeout(clearRefocusTimer);
        }
        if (immediate === true) {
            stopAutoRefocus();
            KeyboardDetector && KeyboardDetector.cancelWait();
        } else
            clearRefocusTimer = setTimeout(
                stopAutoRefocus,
                FOCUS_RESIZE_WINDOW
            );
    }
    var event_mousedown = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
    var event_mouseup = 'ontouchend' in window ? 'touchend' : 'mouseup';

    function hasFocusedInput() {
        return document.activeElement && isFocusable(document.activeElement);
    }
    //guard for blur
    var hook = false;
    var on_blur = function (e) {
        if (hook) {
            focus(activeElement);
        } else {
            if (e.relatedTarget && isFocusable(e.relatedTarget)) {
                focus(e.relatedTarget);
                postClearRefocus(true);
            } else
                setImmediate(function () {
                    if (activeElement && !hasFocusedInput()) {
                        focus(activeElement);
                    }
                });
        }
    };
    // function preventDefault(e) {
    //     e.preventDefault();
    // }

    function focusIfKeyboard(el, allowHardwareKbd, force) {
        if (activeElement) {
            postClearRefocus(true);
        }
        if (
            virtualKeyboardVisible ||
            force ||
            (allowHardwareKbd && Env.isHardwareKeyboard)
        ) {
            focus(el);
            autoRefocus();
            postClearRefocus();
        }
    }
    //Focus on an element and return a callback
    //which smartly returns focus to original position
    //Useful for dialogs
    function visit(newfocus, forceFocus) {
        var element =
            activeElement ||
            ((virtualKeyboardVisible || Env.isHardwareKeyboard) &&
                hasFocusedInput() &&
                document.activeElement);
        if (newfocus) focusIfKeyboard(newfocus, true, forceFocus);
        else element && element.blur();
        if (element) {
            //return a function to return focus
            return function () {
                if (hasFocusedInput() && document.activeElement != newfocus)
                    return;
                focusIfKeyboard(element, true);
            };
        } else {
            return noop;
        }
    }
    exports.FocusManager = {
        get activeElement() {
            return (
                activeElement ||
                ((hasFocusedInput() || Env.isHardwareKeyboard) &&
                    document.activeElement)
            );
        },
        //allows clicks to buttons to return focus to editor
        trap: function (el, eagerly) {
            //TODO debug why this broke Keyboard detector
            // if (el.type !== 'submit' && el.tagName !== 'SELECT')
            //     el.on('mousedown', preventDefault);
            el.on(event_mousedown, eagerly ? autoRefocusEagerly : autoRefocus);
            el.on(event_mouseup, postClearRefocus);
        },
        isFocusable: isFocusable,
        FOCUS_RESIZE_WINDOW: FOCUS_RESIZE_WINDOW,
        visit: visit,
        release: function (el) {
            postClearRefocus(true);
            // el.off('mousedown', preventDefault);
            el.off(event_mousedown, autoRefocus);
            el.off(event_mousedown, autoRefocusEagerly);
            el.off(event_mouseup, postClearRefocus);
        },
        hintChangeFocus: function () {
            hook = false;
            postClearRefocus(true);
        },
        hintNoChangeFocus: function () {
            hook = true;
        },
        onModalOpen: function () {
            var el = this.$el;
            var inputs = el.find('input,textarea');
            var firstFocus = el[0];
            for (var i in inputs) {
                if (isFocusable(inputs[i])) {
                    firstFocus = inputs[i];
                    break;
                }
            }
            this.$returnFocus = visit(firstFocus, true);
        },
        debug: function () {
            debugKey = true;
        },
        get keyboardVisible() {
            return virtualKeyboardVisible;
        },
        focusIfKeyboard: focusIfKeyboard,
    };
}); /*_EndDefine*/