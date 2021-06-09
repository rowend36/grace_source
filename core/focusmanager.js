_Define(function(global) {
    //FocusManager is a class to manager transfer of
    //focus in mobile, the defining methods are
    //FocusManager.trap and FocusManager.focusIfKeyboard
    //The first method ensures clicks to a particular element
    //never blur an active input
    //The other allows softKeyboard to behave like a hardware
    //keyboard if visible, allowing window shortcuts etc
    //There is a third form exposed only to overflows and quicklists
    //In this method if an activeElement exists it is cached
    //On close the activeElement is focused
    //FocusManager.visit
    //Usually the target is a keylistener
    "use strict";
    /**
     *  The Virtual Keyboard Detector
     */
     //The amount of time after a focus during which we can assume any
     //resize is caused by soft keboard visibility
    var FOCUS_RESIZE_WINDOW = global.FOCUS_RESIZE_WINDOW = 800;
    var events = global.AppEvents;
    var setImmediate = global.Utils.setImmediate;
    var noop = global.Utils.noop;
    var virtualKeyboardVisible = false;
    var KeyboardDetector;
    if (!Env.isDesktop) {
        KeyboardDetector = (function(window, undefined) {
            //if you want something done well do it yourself
            var focusListener = (function() {
                var recentlyFocused = false;
                var recentlyFocusedTimeout = null;
                var recentlyFocusedTimeoutDuration = FOCUS_RESIZE_WINDOW*2;
                var resized = false;

                function handler(e) {
                    if (
                        typeof e.target !== "undefined" &&
                        typeof e.target.nodeName !== "undefined"
                    ) {
                        if (isFocusable(e.target)) elementFocusHandler(e);
                    }
                }

                function elementFocusHandler() {
                    if (recentlyFocusedTimeout !== null) {
                        window.clearTimeout(recentlyFocusedTimeout);
                        recentlyFocusedTimeout = null;
                    }
                    recentlyFocused = true;
                    resized = false;
                    recentlyFocusedTimeout = window.setTimeout(
                        expireRecentlyFocused,
                        recentlyFocusedTimeoutDuration
                    );
                }

                function expireRecentlyFocused() {
                    //whatever happens recognize a hardware
                    //keyboard when you see one
                    if (!virtualKeyboardVisible) {
                        virtualKeyboardVisible = true;
                        events.trigger("keyboard-change", {
                            visible: true,
                            isTrusted: false
                        });
                    }
                    recentlyFocused = false;
                    recentlyFocusedTimeout = null;
                }

                return {
                    attach: function() {
                        document.addEventListener("focus", handler, true);
                    },
                    activated: function(current) {
                        if (recentlyFocused) {
                            clearTimeout(recentlyFocusedTimeout);
                            recentlyFocused = false;
                            return 1;
                        }
                        return 0;
                    },
                };
            })();
            var heightDiff;
            var sizeListener = (function() {
                //could have just used screen.height - window.innerHeight
                //I guess this is more adaptive
                var currentWidth, previousWidth;
                var currentHeight, previousHeight, heightWithoutKeyboard;
                var keyboardHeight;
                return {
                    attach: function() {
                        previousHeight = heightWithoutKeyboard = currentHeight =
                            window.innerHeight;
                        previousWidth = currentWidth = window.innerWidth;
                        keyboardHeight = 0;
                    },
                    activated: function(wasVisible) {
                        currentHeight = window.innerHeight;
                        currentWidth = window.innerWidth;
                        heightDiff = previousHeight - currentHeight;
                        previousHeight = currentHeight;
                        var margin = keyboardHeight / 4;
                        if (currentWidth != previousWidth) {
                            previousWidth = currentWidth;
                            return 0;
                        }
                        if (
                            wasVisible &&
                            keyboardHeight > 50 &&
                            -heightDiff < margin &&
                            heightDiff < margin
                        ) {
                            /*some keyboards have number rows on top hence keyboardHeight/4 */
                            keyboardHeight += heightDiff;
                            return 1;
                        }
                        if (heightDiff > 0) {
                            //viewheight reduced && keyboard was not visible
                            if (
                                !wasVisible &&
                                heightDiff >= keyboardHeight - 50
                            ) {
                                keyboardHeight = heightDiff;
                                return 2;
                            } else {
                                keyboardHeight =
                                    (keyboardHeight + heightDiff) / 2;
                                //reduced view height but
                                //not by upto keyboard height
                                //or keyboard was not visible.
                                //perharps user has switched to a smaller keyboard layout
                                //update keyboard height gradually
                                //numRows code above will handle final update
                                //but assume visible if it wasn't already visible
                                return wasVisible ? 0 : 1;
                            }
                        } else if (wasVisible) {
                            // view height increased by keyboardheight
                            // && keyboard was visible
                            // This is the only time to assume keyboard is hidden
                            //But it will bring wrong values
                            //on hardware keyboard
                            if (-heightDiff >= keyboardHeight) {
                                keyboardHeight = -heightDiff;
                                return -2;
                            } else {
                                keyboardHeight =
                                    (keyboardHeight - heightDiff) / 2;
                                //unlike above we cannot assume
                                //keyboard has been hidden yet
                                //adjust keyboard height
                                return 0;
                            }
                        } else {
                            //no keyboard and height increased
                            //assume keyboard height stays the same
                            //For keyboard status to stay the same,
                            //recentlyFocus must be activated
                            //else reassert no keyboard
                            return -1;
                        }
                    },
                };
            })();

            /**
             * Public functions
             */

            function init() {
                focusListener.attach();
                sizeListener.attach();
                initResizeListener();
            }

            /**
             * Private functions
             */

            var waitCount = 0,
                waitTimeout;

            var wait = window.innerHeight < 1700 ? function() {
                waitCount++;
                if (!isFocusable(document.activeElement) && virtualKeyboardVisible) {
                    if (trust * la > 0) {
                        last = la;
                        updateScore(true);
                    }
                } else {
                    if (!waitTimeout) {
                        waitTimeout = setTimeout(updateScore, FOCUS_RESIZE_WINDOW);
                        last = la;
                    }
                }

            } : noop;
            //trust keyboard resizeHandler
            var trust = 0.6;
            var la = 0,
                last = 0,
                lr = 0;
            var lastFail = new Date().getTime() + 10000;
            //Mistake Learning when everything fails
            //>0 keyboard visible <0 keyboard hidden
            //heightdiff>0 keyboard visible heightdiff<0 keyboard hidden
            function updateScore(failed) {
                var delta;
                var timeT = new Date().getTime();
                var agreed = ((trust * last > 0) == virtualKeyboardVisible);
                if ((last > 0 || last < 0)) {
                    if (failed) {
                        //agreed on keyboard visibility status and keyboard visibility changed, jarring to user
                        delta = Math.sign(trust) * (Math.pow(Math.tanh(trust), 2) - 1);
                        if (agreed) delta = -delta;
                        if (Math.abs(trust) < 0.1) trust = -Math.sign(trust) * 0.1;
                        else if (timeT - lastFail < 2000) {
                            //twice in 2s means reset
                        } else if (timeT - lastFail < 5000) {
                            delta -= 0.7 * delta;
                        } else if (timeT - lastFail < 30000) {
                            delta = 0.1 * delta;
                        }
                        trust -= delta;
                        lastFail = timeT;
                    } else {
                        //increase/decrease trust if it did not change
                        if (trust < 1.5 && trust > -1.5) {
                            delta = Math.sign(trust + 0.01) * (1 - Math.pow(Math.tanh(trust), 2)) * Math.min(1, waitCount / 5);
                            if (agreed) delta = -delta;
                            trust -= delta;
                        }
                    }
                }
                waitCount = 0;
                timeT = 0;
                waitTimeout = null;
            }

            function getScore(a, b) {
                if (waitTimeout) {
                    clearTimeout(waitTimeout);
                    updateScore(true);
                }
                // else wait  = noop;
                la = a;
                return (trust * a) + b;
            }

            function initResizeListener() {
                window.addEventListener("resize", resizeHandler);
            }

            function resizeHandler() {
                var score = getScore(sizeListener.activated(virtualKeyboardVisible),
                    focusListener.activated(virtualKeyboardVisible));
                
                if (score > 0 && !virtualKeyboardVisible) {
                    virtualKeyboardVisible = true;
                    events.trigger("keyboard-change", {
                        visible: true,
                        isTrusted: score > 1,
                    });
                } else if (score < 0 && virtualKeyboardVisible) {
                    virtualKeyboardVisible = false;
                    events.trigger("keyboard-change", {
                        visible: false,
                        isTrusted: score < -1,
                    });
                }
            }
            // Make public functions available
            return {
                init: init,
                wait: wait,
            };
        })(window);
        KeyboardDetector.init();
    }
    events._eventRegistry["keyboard-change"] = null;
    //start tracking active element and stop loss of focus;
    var activeElement;

    function focus(el) {
        //Modals trap focus horribly
        if (M.Modal._modalsOpen > 0) {
            var a = $(el).closest(".modal");
            //if the element is not in a modal, ignore
            if (a.length < 1) return postClearRefocus(true);
            var instance = M.Modal.getInstance(a[a.length - 1]);
            //if the modal is not the topmost modal ignore
            if (!instance || instance._nthModalOpened !== M.Modal._modalsOpen) {
                return postClearRefocus(true);
            }
        }
        if (!el.parentElement) return;
        //ace has special focus handling
        //for old browsers
        if (el.parentElement.env) {
            el.parentElement.env.editor.textInput.focus();
        } else {
            el.focus();
        }
        setImmediate(function() {
            if (activeElement == el && !hasFocusedInput()) {
                focus(activeElement);
            }
        });
    }

    function autoRefocus(e) {
        if (e && KeyboardDetector) KeyboardDetector.wait();
        if (!virtualKeyboardVisible) return ;
        var currentElement = document.activeElement;
        if (!isFocusable(currentElement)) return;
        if (activeElement) {
            if (activeElement == currentElement) {
                if (clearRefocusTimer){
                    clearTimeout(clearRefocusTimer);
                    clearRefocusTimer = null;
                }
                return;
            }
            postClearRefocus(true);
            // } else return;
        }
        activeElement = currentElement;
        activeElement.addEventListener("blur", on_blur);
        document.addEventListener("focusin", on_blur);
        focus(activeElement);
        return;
    }

    function autoRefocusEagerly(e) {
        autoRefocus(e);
        if (activeElement) {
            hook = true;
        }
    }

    function stopAutoRefocus() {
        activeElement.removeEventListener("blur", on_blur);
        document.removeEventListener("focusin", on_blur);
        activeElement = null;
        hook = false;
        clearRefocusTimer = null;
    }

    var clearRefocusTimer = null;

    function isFocusable(el) {
        if (el.tagName == "TEXTAREA") return !el.readOnly;
        if (el.tagName == "INPUT") {
            var type = el.type;
            switch (type) {
                case "radio":
                case "checkbox":
                case "file":
                case "reset":
                case "button":
                case "submit":
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
        if (immediate === true) stopAutoRefocus();
        else clearRefocusTimer = setTimeout(stopAutoRefocus, 600);
    }
    var event_mousedown = "ontouchstart" in window ? "touchstart" : "mousedown";
    var event_mouseup = "ontouchend" in window ? "touchend" : "mouseup";

    function hasFocusedInput() {
        return document.activeElement && isFocusable(document.activeElement);
    }
    //guard for blur
    var on_blur = function(e) {
        if (hook) {
            focus(activeElement);
        } else {
            if (e.realtedTarget && isFocusable(e.relatedTarget)) focus(e.relatedTarget);
            else setImmediate(function() {
                if (activeElement && !hasFocusedInput()) {
                    focus(activeElement);
                }
            });
        }
    };
    var hook = false;

    function focusIfKeyboard(el, allowDesktop, force) {
        if (activeElement) {
            postClearRefocus(true);
        }
        if (
            virtualKeyboardVisible ||
            force ||
            (allowDesktop && Env.isDesktop)
        ) {
            focus(el);
            autoRefocus();
            postClearRefocus();
        }
    }
    global.FocusManager = {
        get activeElement() {
            return (
                activeElement ||
                ((hasFocusedInput() || Env.isDesktop) && document.activeElement)
            );
        },
        //allows clicks to buttons to return focus to editor
        trap: function(el, eagerly) {
            if (!Env.isDesktop) {
                el.on(
                    event_mousedown,
                    eagerly ? autoRefocusEagerly : autoRefocus
                );
                el.on(event_mouseup, postClearRefocus);
            }
        },
        canTakeInput: isFocusable,
        //Focus on an element and return a callback
        //which smartly returns focus to original position
        //Useful for dialogs
        visit: function(newfocus, forceFocus) {
            var element =
                activeElement ||
                ((virtualKeyboardVisible || Env.isDesktop) &&
                    hasFocusedInput() &&
                    document.activeElement);
            if (newfocus) focusIfKeyboard(newfocus, true, forceFocus);
            else element && element.blur();
            if (element) {
                //return a function to return focus
                return function() {
                    if (hasFocusedInput() && document.activeElement != newfocus)
                        return;
                    focusIfKeyboard(element, true);
                };
            } else {
                return noop;
            }
        },
        release: function(el) {
            postClearRefocus(true);
            el.off(event_mousedown, autoRefocus);
            el.off(event_mousedown, autoRefocusEagerly);
            el.off(event_mouseup, postClearRefocus);
        },
        hintChangeFocus: function() {
            //hook = false
            postClearRefocus(true);
        },
        hintNoChangeFocus: function() {
            hook = true;
        },
        get keyboardVisible() {
            return virtualKeyboardVisible;
        },
        focusIfKeyboard: focusIfKeyboard,
    };
}); /*_EndDefine*/