_Define(function(global) {
    var tabbable = global.tabbable;
    var FocusManager = global.FocusManager;
    var Utils = global.Utils;
    var event = global.event;
    var keys = global.keys;
    var mods = keys.KEY_MODS;
    var EventsEmitter = global.EventsEmitter;

    function leaveFocusable(ev) {
        var target = ev.target;
        var data = target._track;
        clearData.apply(target);
        data.onKey(data.lastEv, true);
    }

    function clearData() {
        if (this._track) {
            this.removeEventListener('blur', leaveFocusable);
            this._track = null;
        }
    }
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
    //make this accessible to modkeyinput and enhanced clipboard
    var InvisibleTextArea = function(el) {
        var receiver = document.createElement('textarea');
        receiver.className = 'keyboard-listener';
        receiver.value = "-";
        receiver.setAttribute('tabIndex', -1);
        receiver.style.opacity = 0.1;
        receiver.style.position = 'fixed';
        receiver.style.width = '2px';
        receiver.style.height = '2px';
        receiver.style.overflow = 'hidden';
        receiver.setAttribute("autocomplete","off");
        receiver.setAttribute("name",Utils.genID("qt"));
        el.appendChild(receiver);
        return receiver;
    };
    var repeating = true;
    var clearRepeating = Utils.debounce(function() {
        repeating = false;
    }, 100);
    var KeyListener = {
        attach: function(el, keyHandler) {
            keyHandler.el = el || document.body;
            if (el && FocusManager.canTakeInput(el)) {
                keyHandler.$receiver = el;
            } else {
                keyHandler.$receiver = new InvisibleTextArea(keyHandler.el);
            }
            el = el || document;
            keyHandler.$toDestroy = [];
            event.addCommandKeyListener(el, function(e, hash, key) {
                if (key < 0 || hash < 0) return;
                var keyString = mods[hash] + keys.keyCodeToString(key);
                keyHandler.$onKey({
                    event: e,
                    value: keyString,
                    repeating: repeating
                });
                repeating = true;
                clearRepeating();
            }, keyHandler);
            event.addListener(keyHandler.$receiver, 'input', function(e) {
                var key = this.value.charCodeAt(this.value.length - 1);
                keyHandler.$onKey({
                    event: e,
                    value: keys.keyCodeToString(key)
                });
            }, keyHandler);
            if (!keyHandler.$onKey) {
                keyHandler.$onKey = handleKey.bind(keyHandler);
            }
            if (!keyHandler.scrollIntoView)
                keyHandler.scrollIntoView = scrollIntoView;
        },
        detach: function(keyHandler) {
            keyHandler.$toDestroy.forEach(function(e) {
                e.destroy();
            });
        },
    };
    var scrollIntoView = function(el, /*an offset into the element*/ offsetX, offsetY, itemWidth, itemHeight) {
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
    var handleKey = function(ev, force) {
        var e = ev.event;
        if (e.defaultPrevented) return;
        var hash = ev.value;
        var el = this.el;
        var self = this;
        var ignore = !(force || e.target == this.$receiver || e.target == el || hash == 'esc');
        if (ignore) {
            trackBlur(e.target, ev, nav.$onKey);
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
                /*fallthrough*/
                case 'f10':
                case 'contextmenu':
                    self.onRightClick && self.onRightClick(index, e);
        }
        if (next) {
            if (next == index || !isOnScreen(next, true, self.getRoot())) {
                if (hash.indexOf("tab") < 0 && scrollView(next, hash)) {
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
        if (!Env.isDesktop) e.preventDefault();
    };

    function scrollView(view, hash) {
        view = getScrollParent(view)
        do {
            switch (hash) {
                case "up":
                    if (view.scrollTop != 0) {
                        view.scrollTop = Math.max(0, view.scrollTop - 20);
                        return true;
                    }
                    break;
                case "down":
                    if (view.scrollTop + view.clientHeight < view.scrollHeight) {
                        view.scrollTop = Math.min(view.scrollTop + 20, view.scrollHeight - view.clientHeight);
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
            bottom: (window.innerHeight || document.documentElement.clientHeight)
            // ,left: 0,
            // right: (window.innerWidth || document.documentElement.clientWidth)
        }
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
        var overflowRegex = includeHidden ? /(auto|scroll|hidden)/ : /(auto|scroll)/;

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
    var inputToSkip;
    var inputType;

    function doSkip(inputEl, dir) {
        if (inputToSkip) clearSkip();
        inputToSkip = inputEl;
        $(inputEl.parentElement).addClass('nav-skipcontainer');
        inputEl.addEventListener('keydown', skip, true);
    }

    function clearSkip() {
        $(inputToSkip.parentElement).removeClass('nav-skipcontainer');
        inputToSkip.removeEventListener('keydown', skip, true);
        inputToSkip = null;
    }
    var skip = function(e) {
        var key = parseInt(e.keyCode);
        if (keys.MODIFIER_KEYS[key]) return;
        clearSkip();
        if (!(e.shiftKey || e.ctrlKey || e.altKey) && (key == keys.esc || (key < 41 && key > 36))) { //(key == direction + 1 || key == direction - 1)) {
            var hash = keys.keyCodeToString(key);
            e.target.blur();
            nav.$onKey({
                event: e,
                value: hash
            }, true);
            FocusManager.focusIfKeyboard(nav.$receiver, true);
        } else if (key == keys.enter || key == keys.space) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    var nav = {
        moveTo: function(a, e, source) {
            $(nav.lastEl).removeClass('nav-focused');
            nav.lastEl = a;
            var behaviour = a.parentElement.navBehaviour;
            if (behaviour === false) {
                nav.delegate = false;
            } else {
                var root;
                if (!behaviour) {
                    for (var i in behaviours) {
                        if ((root = behaviours[i].detect(a))) {
                            behaviour = behaviours[i];
                            a.parentElement.navBehaviour = behaviour;
                            break;
                        }
                    }
                } else {
                    root = behaviour.detect(a);
                }
                if (behaviour) {
                    nav.delegate = behaviour;
                    nav.delegate.root = root;
                } else {
                    nav.delegate = false;
                    a.parentElement.navBehaviour = false;
                }
            }
            if (FocusManager.canTakeInput(a)) {
                FocusManager.focusIfKeyboard(a, true);
                if (!source) {
                    doSkip(a);
                }
            } else {
                if (!source || Env.isDesktop || (source != 'mouse' && FocusManager.keyboardVisible)) {
                    if (tabbable.isTabbable(a)) {
                        $(a).addClass('nav-focused');
                    }
                    if ($(a).hasClass('modal') || $(a).closest('.modal').length) {
                        //todo
                        return FocusManager.hintChangeFocus();
                    } else FocusManager.focusIfKeyboard(nav.$receiver, true);
                }
            }
        },
        blur: function(el) {
            if (el.className.indexOf('ace_text-input') > -1) {
                doSkip(el);
            } else if (FocusManager.canTakeInput(el) && el != this.$receiver) {
                FocusManager.focusIfKeyboard(this.$receiver, true);
                el.blur();
            } else {
                FocusManager.focusIfKeyboard(this.$receiver, true);
                nav.pop();
            }
        },
        onenter: function(el, e) {
            if (FocusManager.canTakeInput(el)) {} else if (el.tagName == 'SELECT') {
                global.Overflow.openSelect(e, el);
                return true;
            } else if (FocusManager.activeElement == nav.$receiver) {
                $(el).addClass('nav-focused');
                FocusManager.focusIfKeyboard(nav.$receiver, true);
                $(el).trigger({
                    type: 'click',
                    which: 1
                });
                return true;
            }
        },
        onRightClick: function(el, e) {
            if (FocusManager.canTakeInput(el)) {} else if (el.tagName == 'SELECT') {
                global.Overflow.openSelect(e, el);
                return true;
            } else if (FocusManager.activeElement == nav.$receiver) {
                $(el).addClass('nav-focused');
                FocusManager.focusIfKeyboard(nav.$receiver, true);
                $(el).trigger({
                    type: 'contextmenu'
                });
                return true;
            }
        },
        scrollIntoView: scrollIntoView,
        attach: function() {
            window.addEventListener('mousedown', function(e) {
                nav.setFocused(FocusManager.activeElement || e.target, 'mouse');
            });
            window.addEventListener('focusin', function(e) {
                nav.setFocused(e.target, 'focus');
            });
            this.stack = [{
                root: document.body
            }];
            KeyListener.attach(null, nav);
        },
        setFocused: function(a, force) {
            if (inputToSkip) clearSkip();
            if (a == nav.lastEl) return;
            if (a == nav.$receiver) return;
            do {
                if (tabbable.isTabbable(a)) {
                    nav.moveTo(a, nav.getCurrentElement(document.body), force);
                    break;
                }
                a = a.parentElement;
            }
            while (a);
        },
        addBehaviour: function(name, behaviour) {
            behaviours[name] = behaviour;
        },
        stack: null,

        addRoot: function(el, close, trap) {
            if (this.stack) {
                var stackObj = {
                    close: close,
                    root: el,
                    base: nav.getCurrentElement(),
                }
                this.stack.push(stackObj);
                var entrance = nav.getElements()[0];
                if (!trap) {
                    stackObj.escapes = [entrance];
                }
                this.setFocused(entrance, "root");
                return stackObj;
            }
        },
        getRoot: function() {
            return this.stack[this.stack.length - 1].root;
        },
        canEscape: function(el) {
            var a;
            return (a = this.stack[this.stack.length - 1]) &&
                (a = a.escapes) &&
                (a.indexOf(el) > -1);
        },
        hasStack: function() {
            return this.stack.length > 1;
        },
        removeRoot: function(el) {
            if (this.stack)
                for (var i = this.stack.length - 1; i > 0; i--) {
                    if (this.stack[i].root == el) {
                        var last = this.stack[i].base;
                        this.stack.splice(i);
                        if (this.checkAttached(last))
                            this.setFocused(last, "root");
                        break;
                    }
                }
        },
        outsideRoot: function(from) {
            var root = nav.getRoot();
            do {
                if (from.parentElement == root) {
                    return false;
                }
                from = from.parentElement;
            }
            while (from);
            return true;
        },
        checkAttached: function(el) {
            var a = el;
            while (a) {
                a = a.parentNode;
            }
            return a == document;
        },
        pop: function() {
            if (this.stack.length > 1) {
                var last = this.stack.pop();
                last.close();
                if (nav.checkAttached(last.base)) {
                    this.setFocused(last.base, "root");
                }
                return last;
            }
        },

        getElements: function(root) {
            return nav.getRoot().querySelectorAll(candidateSelector);
        },
        getNext: function(current, root, dir) {
            var result;
            if (this.delegate && this.delegate[dir]) {
                result = this.delegate.getNext(current, root, dir, this.getNext.bind(this));
                if (result) return result;
            }
            var a = this.getElements(root);
            var i = indexOf(a, current);
            do {
                result = a[++i];
            }
            while (result && !tabbable.isVisible(result));
            if (!result) {
                if (!repeating && nav.canEscape(current)) {
                    nav.pop();
                    return;
                } else return (tabbable.isVisible(current) ? current : this.getNext(null, root));
            }
            return result;
        },
        getPrev: function(current, root, dir) {
            var result;
            if (this.delegate && this.delegate[dir]) {
                result = this.delegate.getPrev(current, root, dir, this.getPrev.bind(this));
                if (result) return result;
            }
            var a = this.getElements(root);
            var i = indexOf(a, current);
            do {
                result = a[--i];
            }
            while (result && !tabbable.isVisible(result));
            if (!result) {
                if (!repeating && nav.canEscape(current)) {
                    nav.pop();
                    return;
                } else return (tabbable.isVisible(current) ? current : this.getNext(null, root));
            }
            return result;
        },
        getCurrentElement: function(root) {
            return this.lastEl || root;
        },
        shiftTo: Utils.noop
    };
    var behaviours = nav.defaults = {
        "tabs": {
            vertical: true,
            root: null,
            getPrev: function(current, root, dir, $default) {
                return $default(current, root);
            },
            getNext: function(current, root, dir, $default) {
                var a = this.root.getElementsByTagName('a');
                var i = a.length;
                while (--i > 0) {
                    if (tabbable.isVisible(a[i])) {
                        return $default(a[i], root);
                    }
                }
            },
            detect: function(node) {
                var tabs = node.parentElement.parentElement;
                if (tabs && (' ' + tabs.className + ' ').indexOf(" tabs ") > -1) return tabs;
            }
        },
        "fileview": {
            horizontal: true,
            root: null,
            getPrev: function(current, root, dir, $default) {
                var a = this.root.children;
                var i = -1;
                while (++i < a.length) {
                    if (tabbable.isTabbable(a[i])) {
                        return $default(a[i], root);
                    }
                }
            },
            getNext: function(current, root, dir, $default) {
                var a = this.root.children;
                var i = a.length;
                while (--i > 0) {
                    if (tabbable.isTabbable(a[i])) {
                        var result = $default(a[i], root);
                        if (result && (result.className.indexOf('file-item') > -1)) {
                            return result;
                        }
                        return a[i];
                    }
                }
            },
            detect: function(node) {
                return (" " + node.parentElement.className + " ").indexOf(" fileview ") > -1 && node.parentElement;
            }
        }
    };
    var candidateSelectors = [
        'input',
        'select',
        'textarea',
        'a[href]',
        'button',
        '[tabindex]',
        /*'audio[controls]',
        'video[controls]',
        '[contenteditable]:not([contenteditable="false"])',
        'details>summary:first-of-type',
        'details',*/
    ];
    var candidateSelector = /* #__PURE__ */ candidateSelectors.join(',');
    var indexOf = Array.prototype.indexOf.call.bind(Array.prototype.indexOf);


    global.Navigation = nav;
    global.KeyListener = KeyListener;
}); /*_EndDefine*/