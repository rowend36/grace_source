define(function(require, exports, module) {
    var FocusManager = require("../core/focus_manager").FocusManager;
    var InvisibleTextArea = require("./textarea").InvisibleTextArea;
    var event = ace.require("ace/lib/event");
    var keys = ace.require("ace/lib/keys");
    var mods = keys.KEY_MODS;
    var Utils = require("../core/utils").Utils;

    var KeyListener = {
        attach: function(el, keyHandler) {
            keyHandler.el = el || document.body;
            if (el && FocusManager.isFocusable(el)) {
                keyHandler.$receiver = el;
            } else {
                keyHandler.$receiver = new InvisibleTextArea(
                    keyHandler.el);
            }
            el = el || document;
            keyHandler.$toDestroy = [];
            event.addCommandKeyListener(el, function(e, hash,
                key) {
                if (key < 0 || hash < 0) return;
                var keyString = mods[hash] + keys
                    .keyCodeToString(key);
                keyHandler.$onKey({
                    event: e,
                    value: keyString,
                    repeating: KeyListener
                        .repeating
                });
                KeyListener.repeating = true;
                clearRepeating();
            }, keyHandler);
            event.addListener(keyHandler.$receiver, 'input',
                function(e) {
                    var key = this.value.charCodeAt(this
                        .value.length - 1);
                    keyHandler.$onKey({
                        event: e,
                        value: keys.keyCodeToString(
                            key)
                    });
                }, keyHandler);
            if (!keyHandler.$onKey) {
                keyHandler.$onKey = defaultKeyHandler.bind(
                    keyHandler);
            }
            if (!keyHandler.scrollIntoView)
                keyHandler.scrollIntoView = scrollIntoView;
        },
        detach: function(keyHandler) {
            keyHandler.$toDestroy.forEach(function(e) {
                e.destroy();
            });
        },
        repeating: false
    };
    var clearRepeating = Utils.debounce(function() {
        KeyListener.repeating = false;
    }, 100);


    //when on an element that can take input
    //we want to be able focus the next element
    //the moment the input is blurred but only if the 
    //blurring is as a result of key input
    function trackBlur(el, ev, onKey) {
        el.addEventListener('blur', leaveFocusable);
        if (el._track) {
            el._track.lastEv = ev;
            el._track.clear();
        } else {
            var data = {
                lastEv: ev,
                onKey: onKey,
                clear: Utils.debounce(clearData.bind(el), 100)
            };
            el._track = data;
            data.clear();
        }

    }

    function clearData() {
        if (this._track) {
            this.removeEventListener('blur', leaveFocusable);
            this._track = null;
        }
    }

    function leaveFocusable(ev) {
        var target = ev.target;
        var data = target._track;
        clearData.apply(target);
        if (!FocusManager.isFocusable(ev.relatedTarget))
            data.onKey(data.lastEv, true);
    }

    var defaultKeyHandler = function(ev, force) {
        var e = ev.event;
        var hash = ev.value;
        var el = this.el;
        var self = this;
        if (!force &&
            (e.defaultPrevented ||
                !(e.target == this.$receiver || e.target == el ||
                    hash == 'esc')
            )
        ) {
            trackBlur(e.target, ev, this.$onKey);
            return;
        }
        var index = self.getCurrentElement(el);
        if (!index) return;
        self.shifted = hash.startsWith('shift-');
        if (self.shifted) {
            hash = hash.replace('shift-', '');
        }
        var next;
        switch (hash) {
            case 'up':
                next = self.getPrev(index, el, "vertical");
                break;
            case 'down':
                next = self.getNext(index, el, 'vertical');
                break;
            case 'right':
                next = self.getNext(index, el, 'horizontal');
                break;
            case 'left':
                next = self.getPrev(index, el, 'horizontal');
                break;
            case 'tab':
                next = self.getPrev(index, el, "tab");
                break;
            case 'shift-tab':
                next = self.getNext(index, el, 'tab');
                break;
            case 'esc':
                self.blur(e.target);
                break;
            case 'space':
            case 'return':
                if (!self.shifted) {
                    self.onenter(index, e);
                    break;
                }
                /*fall through*/
                case 'f10':
                case 'contextmenu':
                    self.onRightClick && self.onRightClick(index,
                    e);
        }
        if (next) {
            if (next == index || !isOnScreen(next, true, self
                    .getRoot())) {
                if (hash.indexOf("tab") < 0 && scrollView(next,
                        hash)) {
                    return e.preventDefault();
                }
            }
            if (next != index) {
                self.scrollIntoView(next);
                if (self.shifted)
                    self.shiftTo(next, index);
                else self.moveTo(next, index);
                return e.preventDefault();
            }
        }
        if (!Env.isHardwareKeyboard) e.preventDefault();
    };

    var scrollIntoView = function(el, /*an offset into the element*/
        offsetX, offsetY, itemWidth, itemHeight) {
        offsetX = offsetX || 0;
        offsetY = offsetY || 0;
        itemWidth = itemWidth || el.offsetWidth;
        itemHeight = itemHeight || el.offsetHeight;
        var a = el;
        while ((a = a.parentElement)) {
            var baseTop = a == el.offsetParent ? 0 : a.offsetTop;
            var top = el.offsetTop + offsetY - baseTop;
            var bottom = top + itemHeight;
            if (top < a.scrollTop) {
                a.scrollTop = top;
            } else if (bottom - a.offsetHeight > a.scrollTop) {
                a.scrollTop = bottom - a.offsetHeight;
            }
            offsetY = top - a.scrollTop;

            var baseLeft = a == el.offsetParent ? 0 : a.offsetLeft;
            var left = el.offsetLeft + offsetX - baseLeft;
            var right = left + itemWidth;
            if (left < a.scrollLeft) {
                a.scrollLeft = left;
            } else if (right - a.offsetWidth > a.scrollLeft) {
                a.scrollLeft = right - a.offsetWidth;
            }
            offsetX = left - a.scrollLeft;
            el = a;
        }
    };

    function scrollView(view, hash) {
        view = getScrollParent(view);
        do {
            switch (hash) {
                case "up":
                    if (view.scrollTop != 0) {
                        view.scrollTop = Math.max(0, view.scrollTop -
                            20);
                        return true;
                    }
                    break;
                case "down":
                    if (view.scrollTop + view.clientHeight < view
                        .scrollHeight) {
                        view.scrollTop = Math.min(view.scrollTop + 20,
                            view.scrollHeight - view.clientHeight);
                        return true;
                    }
                    break;
                case "left":
                case "right":
                    break;
                default:
                    break;
            }

        } while (view != document.body && (
                view = getScrollParent(view)));
        return false;
    }

    function isOnScreen(element, checkEdge, root) {
        var rect = element.getBoundingClientRect();
        var clipRect = root ? root.getBoundingClientRect() : {
            top: 0,
            bottom: (window.innerHeight || document.documentElement
                .clientHeight)
            // ,left: 0,
            // right: (window.innerWidth || document.documentElement.clientWidth)
        };
        var offset = checkEdge ? rect.height : 0;
        return (
            rect.top - clipRect.top >= -offset &&
            // rect.left >= -offset &&
            rect.bottom - offset <= clipRect.bottom
            //&& rect.right <= clipRect.right
        );

    }

    function getScrollParent(element, includeHidden) {
        var style = getComputedStyle(element);
        var excludeStaticParent = style.position === "absolute";
        var overflowRegex = includeHidden ? /(auto|scroll|hidden)/ :
            /(auto|scroll)/;

        if (style.position === "fixed") return document.body;
        for (var parent = element;
            (parent = parent.parentElement);) {
            style = getComputedStyle(parent);
            if (excludeStaticParent && style.position === "static") {
                continue;
            }
            if (overflowRegex.test(style.overflowY)) return parent;
        }

        return document.body;
    }

    exports.KeyListener = KeyListener;
});
