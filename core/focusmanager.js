(function(global) {
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
    var virtualKeyboardVisible = false;

    if (!Env.isDesktop) {
        var KeyboardDetector = (function(window, undefined) {
            //if you want something done well do it yourself
            var focusListener = (function() {
                var recentlyFocused = false;
                var recentlyFocusedTimeout = null;
                var validFocusableElements = ['INPUT', 'TEXTAREA'];
                var recentlyFocusedTimeoutDuration = 3000;
                var resized = false;

                function handler(e) {
                    if (typeof e.target !== 'undefined' && typeof e.target.nodeName !== 'undefined') {
                        if (validFocusableElements.indexOf(e.target.nodeName) != -1)
                            elementFocusHandler(e);
                    }
                }

                function elementFocusHandler() {
                    if (recentlyFocusedTimeout !== null) {
                        window.clearTimeout(recentlyFocusedTimeout);
                        recentlyFocusedTimeout = null;
                    }
                    recentlyFocused = true;
                    resized = false;
                    recentlyFocusedTimeout = window.setTimeout(expireRecentlyFocused, recentlyFocusedTimeoutDuration);

                }

                function expireRecentlyFocused() {
                    //whatever happens recognize a hardware
                    //keyboard when you see one
                    if (!resized)
                        virtualKeyboardVisible = true;
                    recentlyFocused = false;
                    recentlyFocusedTimeout = null;
                }

                return {
                    attach: function() {
                        document.addEventListener('focus', handler, true);
                    },
                    activated: function(current) {
                        resized = true;
                        return recentlyFocused ? 1 : 0;
                    }
                };
            })();
            var sizeListener = (function() {
                var currentWidth, previousWidth;
                var currentHeight, previousHeight, heightWithoutKeyboard;
                var keyboardHeight, heightDiff;
                return {
                    attach: function() {
                        previousHeight = heightWithoutKeyboard = currentHeight = window.innerHeight;
                        previousWidth = currentWidth = window.innerWidth;
                        keyboardHeight = 0;
                    },
                    activated: function(current) {
                        currentHeight = window.innerHeight;
                        currentWidth = window.innerWidth;
                        heightDiff = previousHeight - currentHeight;
                        previousHeight = currentHeight;
                        var margin = keyboardHeight / 4;
                        if (currentWidth != previousWidth) {
                            previousWidth = currentWidth;
                            return 0;
                        }
                        if (current && keyboardHeight > 50 && (-heightDiff < margin && heightDiff < margin)) {
                            /*some keyboards have number rows on top hence keyboardHeight/4 */
                            keyboardHeight += heightDiff;
                            return 1;
                        }
                        if (heightDiff > 0) {
                            //viewheight reduced && keyboard was not visible
                            if (!current && heightDiff >= (keyboardHeight - 50)) {
                                keyboardHeight = heightDiff;
                                return 2;
                            }
                            else {
                                keyboardHeight = (keyboardHeight + heightDiff) / 2;
                                //reduced view height but
                                //not by upto keyboard height
                                //or keyboard was not visible.
                                //perharps user has switched to a smaller keyboard
                                //update keyboard height gradually
                                //numRows code above will handle final update
                                //but assume visible if it wasn't already visible
                                return current ? 0 : 1;
                            }
                        }
                        else if (current) {
                            // view height increased by keyboardheight 
                            // && keyboard was visible
                            // This is the only time to assume keyboard is hidden
                            //But it might bring wrong values
                            //on hardware keyboard very bad
                            if (-heightDiff >= keyboardHeight) {
                                keyboardHeight = -heightDiff;
                                return -2;
                            }
                            else {
                                keyboardHeight = (keyboardHeight - heightDiff) / 2;
                                //unlike above we cannot assume
                                //keyboard has been hidden yet
                                //adjust keyboard height
                                return 0;
                            }
                        }
                        else {
                            //no keyboard and height is increasing
                            //counter to recently focused
                            //assume keyboard height stays the same
                            //but re assert no keyboard
                            return -1;
                        }
                    }
                };
            })();

            /**
             * Public functions
             */

            function init(options) {
                if (typeof options !== 'undefined') {
                    if (typeof options.recentlyFocusedTimeoutDuration !== 'undefined') recentlyFocusedTimeoutDuration = options.recentlyFocusedTimeoutDuration;
                }
                //for (var i in listeners) {
                //    listeners[i].attach();
                //}
                focusListener.attach();
                sizeListener.attach();
                initResizeListener();
            }

            /**
             * Private functions
             */


            function initResizeListener() {
                window.addEventListener('resize', resizeHandler);
            }

            function resizeHandler() {
                var score = 0;
                //for (var i in listeners) {
                //score += listeners[i].activated(virtualKeyboardVisible);
                //}
                score += sizeListener.activated(virtualKeyboardVisible);
                score += focusListener.activated(virtualKeyboardVisible);
                if (score > 0) {
                    virtualKeyboardVisible = true;
                }
                if (score < 0) {
                    virtualKeyboardVisible = false;
                }
                else {
                    //if ('activeElement' in document)
                    //    document.activeElement.focus();
                }
                //TODO by detecting keyboard opened and immediately
                // closed behaviour gradually correct sizeListeners
                //notions of keyboardHeight && numRowHeight
            }
            // Make public functions available
            return {
                init: init
            };

        })(window);
        KeyboardDetector.init();
    }
    //start tracking active element and stop loss of focus;
    var activeElement;

    function doRefocus(e) {
        if (!virtualKeyboardVisible)
            return;
        if (clearRefocusTimer) {
            clearTimeout(clearRefocusTimer);
            clearRefocusTimer = false;
        }
        postClearRefocus(true);

        if (activeElement) {
            if (activeElement != document.activeElement) {
                activeElement.removeEventListener('blur', on_blur);
            }
            else
                return;
        }
        activeElement = document.activeElement;
        if (activeElement && activeElement != document.body) {
            activeElement.addEventListener('blur', on_blur);
        }
        else activeElement = null;
    }

    function doRefocusHook(e) {
        doRefocus(e);
        if (activeElement)
            hook = true;
    }
    //stop tracking active element
    function stopRefocus() {
        activeElement.removeEventListener("blur", on_blur);
        activeElement = null;
        hook = false;
        clearRefocusTimer = null;
    }

    var clearRefocusTimer = null;

    function focusable(el) {
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
        if (immediate === true) stopRefocus();
        else clearRefocusTimer = setTimeout(stopRefocus, 200);
    }
    var event_mousedown = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
    var event_mouseup = 'ontouchend' in window ? 'touchend' : 'mouseup';

    function hasActiveElement() {
        return focusable(document.activeElement) && document.activeElement;
    }
    //guard for blur
    var on_blur = function(e) {
        if (hook) {
            activeElement.focus();
            /*window.setTimeout(function() {
                if (activeElement)
                    activeElement.focus();
            }, 0);*/
        }
        else {
            setTimeout(function() {
                if (activeElement && !hasActiveElement()) {
                    activeElement.focus();
                }
            }, 0);
        }
    };
    var hook = false;

    function focusIfKeyboard(el,allowDesktop) {
        if (activeElement) {
            postClearRefocus(true);
        }
        if (virtualKeyboardVisible) {
            el.focus();
            doRefocus();
            postClearRefocus();
        }
        else if(allowDesktop && Env.isDesktop){
            el.focus();
        }
    }
    global.FocusManager = {
        get activeElement() {
            return activeElement || hasActiveElement();
        },
        trap: function(el, hook) {
            if (!Env.isDesktop) {
                el.on(event_mousedown, hook ? doRefocusHook : doRefocus);
                el.on(event_mouseup, postClearRefocus);
            }
        },
        canTakeInput: focusable,
        visit: function(newfocus) {
            var element = activeElement || hasActiveElement() || (Env.isDesktop && document.activeElement);
            if (element) {
                newfocus.focus();
                return focusIfKeyboard.bind(null, element,true);
            }
            else return function() {};

        },
        release: function(el) {
            postClearRefocus(true);
            el.off(event_mousedown, doRefocus);
            el.off(event_mousedown, doRefocusHook);
            el.off(event_mouseup, postClearRefocus);
        },
        hintChangeFocus: function() {
            //hook = false
            postClearRefocus(true);
        },
        hintNoChangeFocus: function() {
            hook = true;
        },
        focusIfKeyboard: focusIfKeyboard
    };
})(Modules);