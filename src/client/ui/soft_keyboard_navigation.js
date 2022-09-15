define(function (require, exports, module) {
    /*globals $*/
    var FocusManager = require('./focus_manager').FocusManager;
    var InvisibleTextArea = require('./textarea').InvisibleTextArea;
    var Utils = require('../core/utils').Utils;
    var addListener = require('../setup/setup_key_listener').addListener;
    var getEvent = require('../setup/setup_key_listener').getEvent;
    var keys = require('ace!lib/keys');
    var Actions = require('grace/core/actions');

    var handleNavigate = function (editor, args) {
        var parent =
            document.activeElement &&
            $(document.activeElement).closest('.soft-navigation');
        var self = keyHandlers[parent.data('keyhandler')];
        if (!self) return false;
        var ev = args.event || (args.event = getEvent());
        var el = self.el;
        if (
            ev.defaultPrevented ||
            !(
                ev.target == self.$receiver ||
                ev.target == el ||
                this.bindKey == 'Esc'
            )
        ) {
            waitForBlur(ev.target, ev);
        } else {
            KeyListener.dispatchEvent(self, ev, this.bindKey);
        }
    };
    var _isAvailable = function () {
        //does not work when the event originated from an editor
        var e = getEvent();
        if (!e) return false;
        var parent = $(e.target).closest('.soft-navigation')[0];
        if (parent) return true;
    };
    [
        'Up',
        'Down',
        'Left',
        'Right',
        'Tab',
        'Shift-Tab',
        'Esc',
        'Space',
        'Enter',
        'F10',
        'ContextMenu',
    ].forEach(function (e) {
        //Find a way to localize this so it is not checked everytime
        Actions.addAction({
            name: 'softKeyboard' + e,
            bindKey: e,
            priority: -1,
            isAvailable: _isAvailable,
            exec: handleNavigate,
            passEvent: true
        });
    });

    var keyHandlers = {};
    var KeyListener = exports;
    KeyListener.attach = function (el, keyHandler) {
        keyHandler.id = keyHandler.id || Utils.genID('kb');
        keyHandlers[keyHandler.id] = keyHandler;
        keyHandler.el = el || document.body;
        $(keyHandler.el)
            .data('keyhandler', keyHandler.id)
            .addClass('soft-navigation');
        if (el && FocusManager.isFocusable(el)) {
            keyHandler.$receiver = el;
        } else {
            keyHandler.$receiver = new InvisibleTextArea(keyHandler.el);
        }
        addListener(keyHandler.$receiver, true);
        if (!keyHandler.scrollIntoView)
            keyHandler.scrollIntoView = scrollIntoView;
    };
    KeyListener.detach = function (keyHandler) {
        keyHandlers[keyHandler.id] = null;
        $(keyHandler.el)
            .data('keyhandler', null)
            .removeClass('soft-navigation');
        //TODO remove listeners
    };
    KeyListener.dispatchEvent = function (self, ev, hash) {
        KeyListener.repeating = ev.repeat;
        var el = self.el;
        hash = (hash || keys.keyCodeToString(ev.keyCode)).toLowerCase();
        var index = self.getCurrentElement(el);
        if (!index) return;
        self.shifted = hash.startsWith('shift-');
        if (self.shifted) {
            hash = hash.replace('shift-', '');
        }
        var next;
        switch (hash) {
            case 'up':
                next = self.getPrev(index, el, 'vertical');
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
                next = self.getPrev(index, el, 'tab');
                break;
            case 'shift-tab':
                next = self.getNext(index, el, 'tab');
                break;
            case 'esc':
                self.blur(ev.target);
                break;
            case 'space':
            // @ts-ignore
            case 'return':
                if (!self.shifted) {
                    self.onenter(index, ev);
                    break;
                }
            /*fall through*/
            case 'f10':
            case 'contextmenu':
                self.onRightClick && self.onRightClick(index, ev);
        }
        if (next) {
            if (next == index || !isOnScreen(next, true, self.getRoot())) {
                if (hash.indexOf('tab') < 0 && scrollView(next, hash)) {
                    return ev.preventDefault();
                }
            }
            if (next != index) {
                self.scrollIntoView(next);
                if (self.shifted) self.shiftTo(next, index);
                else self.moveTo(next, index);
                return ev.preventDefault();
            }
        }
        if (!Env.isHardwareKeyboard) ev.preventDefault();
    };
    exports.KeyListener = KeyListener;
    
    //Implementation
    
    //when on an element that can take input
    //we want to be able focus the next element
    //the moment the input is blurred but only if the
    //blurring is as a result of key input
    function waitForBlur(el, ev) {
        el.addEventListener('blur', leaveFocusable);
        if (el._track) {
            el._track.lastEv = ev;
            el._track.clear();
        } else {
            var data = {
                lastEv: ev,
                clear: Utils.debounce(clearData.bind(el), 100),
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
            KeyListener.dispatchEvent(data.handler, data.lastEv);
    }

    var scrollIntoView = function (
        el /*an offset into the element*/,
        offsetX,
        offsetY,
        itemWidth,
        itemHeight
    ) {
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
                case 'up':
                    if (view.scrollTop != 0) {
                        view.scrollTop = Math.max(0, view.scrollTop - 20);
                        return true;
                    }
                    break;
                case 'down':
                    if (
                        view.scrollTop + view.clientHeight <
                        view.scrollHeight
                    ) {
                        view.scrollTop = Math.min(
                            view.scrollTop + 20,
                            view.scrollHeight - view.clientHeight
                        );
                        return true;
                    }
                    break;
                case 'left':
                case 'right':
                    break;
                default:
                    break;
            }
        } while (view != document.body && (view = getScrollParent(view)));
        return false;
    }

    function isOnScreen(element, checkEdge, root) {
        var rect = element.getBoundingClientRect();
        var clipRect = root
            ? root.getBoundingClientRect()
            : {
                  top: 0,
                  bottom:
                      window.innerHeight ||
                      document.documentElement.clientHeight,
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
        var excludeStaticParent = style.position === 'absolute';
        var overflowRegex = includeHidden
            ? /(auto|scroll|hidden)/
            : /(auto|scroll)/;

        if (style.position === 'fixed') return document.body;
        for (var parent = element; (parent = parent.parentElement); ) {
            style = getComputedStyle(parent);
            if (excludeStaticParent && style.position === 'static') {
                continue;
            }
            if (overflowRegex.test(style.overflowY)) return parent;
        }

        return document.body;
    }

});
