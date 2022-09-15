define(function (require, exports, module) {
    /*globals $*/
    var nav = require('grace/ui/navigation').Navigation;
    var tabbable = require('./libs/tabbable').tabbable;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var keys = require('ace!lib/keys');
    var KeyListener = require('grace/ui/key_listener').KeyListener;
    var Utils = require('grace/core/utils').Utils;
    var uiConfig = require('grace/core/config').Config.registerAll(null, 'ui');
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

    var inputToSkip;

    function doSkip(inputEl /*, dir*/) {
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
    var skip = function (e) {
        var key = parseInt(e.keyCode);
        if (keys.MODIFIER_KEYS[key]) return;
        clearSkip();
        if (
            !(e.shiftKey || e.ctrlKey || e.altKey) &&
            (key == keys.esc || /*direction keys 40-37*/ (key < 41 && key > 36))
        ) {
            //(key == direction + 1 || key == direction - 1)) {
            e.target.blur();
            KeyListener.dispatchEvent(nav, event);

            FocusManager.focusIfKeyboard(nav.$receiver, true);
        } else if (key == keys.enter || key == keys.space) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    function trackType(el) {
        var group = new Utils.groupEvents(el);

        function remove() {
            el.setAttribute('type', 'number');
        }

        function validate(ev) {
            if (!(ev.shiftKey || ev.ctrlKey || ev.altKey)) {
                var key = parseInt(ev.keyCode);
                if (
                    key == 229 ||
                    (keys.PRINTABLE_KEYS[key] &&
                        key !== 190 &&
                        (key < 48 || key > 57))
                ) {
                    ev.preventDefault();
                }
            }
        }
        el.setAttribute('type', 'text');
        group.on('blur', remove);
        group.on('keydown', validate);
        group.on('blur', group.off);
    }
    Object.assign(nav, {
        moveTo: function (a, e, source) {
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
            if (FocusManager.isFocusable(a)) {
                if (a.type === 'number' && !Env.isHardwareKeyboard) {
                    trackType(a);
                }
                FocusManager.focusIfKeyboard(a, true);
                if (!source && a.className.indexOf('ace_text-input') > -1) {
                    doSkip(a);
                }
            } else {
                if (
                    !source ||
                    Env.isHardwareKeyboard ||
                    (source != 'mouse' && FocusManager.keyboardVisible)
                ) {
                    if (tabbable.isTabbable(a)) {
                        console.log(a.className);
                        $(a).addClass('nav-focused');
                        if (source == 'root') {
                            nav.scrollIntoView(a);
                        }
                    }
                    FocusManager.focusIfKeyboard(nav.$receiver, true);
                }
            }
        },
        blur: function (el) {
            if (el.className.indexOf('ace_text-input') > -1) {
                doSkip(el);
            } else if (FocusManager.isFocusable(el) && el != this.$receiver) {
                FocusManager.focusIfKeyboard(this.$receiver, true);
                el.blur();
            } else {
                FocusManager.focusIfKeyboard(this.$receiver, true);
                nav.pop();
            }
        },
        onenter: function (el, e) {
            if (FocusManager.isFocusable(el)) {
            } else if (el.tagName == 'SELECT') {
                require('grace/ui/dropdown').Dropdown.openSelect(e, el);
                return true;
            } else if (FocusManager.activeElement == nav.$receiver) {
                $(el).addClass('nav-focused');
                FocusManager.focusIfKeyboard(nav.$receiver, true);
                $(el).trigger('click');
                return true;
            }
        },
        onRightClick: function (el, e) {
            if (FocusManager.isFocusable(el)) {
            } else if (el.tagName == 'SELECT') {
                require('grace/ui/dropdown').Dropdown.openSelect(e, el);
                return true;
            } else if (FocusManager.activeElement == nav.$receiver) {
                $(el).addClass('nav-focused');
                FocusManager.focusIfKeyboard(nav.$receiver, true);
                $(el).trigger('contextmenu');
                return true;
            }
        },
        attach: function () {
            window.addEventListener('mousedown', function (e) {
                nav.setFocused(FocusManager.activeElement || e.target, 'mouse');
            });
            window.addEventListener('focusin', function (e) {
                nav.setFocused(e.target, 'focus');
            });
            this.stack = [
                {
                    root: document.body,
                },
            ];
            KeyListener.attach(null, nav);
        },
        setFocused: function (a, source) {
            if (inputToSkip) clearSkip();
            if (a == nav.lastEl) return;
            if (a == nav.$receiver) return;
            do {
                if (tabbable.isTabbable(a)) {
                    nav.moveTo(a, nav.getCurrentElement(document.body), source);
                    break;
                }
                a = a.parentElement;
            } while (a);
        },
        addBehaviour: function (name, behaviour) {
            behaviours[name] = behaviour;
        },
        stack: null,

        addRoot: function (el, close, trap) {
            if (this.stack) {
                var stackObj = {
                    close: close,
                    root: el,
                    base: nav.getCurrentElement(document.body),
                };
                this.stack.push(stackObj);
                var firstElement = nav.getElements()[0];
                if (!trap) {
                    stackObj.escapes = [firstElement];
                }
                if (firstElement) this.setFocused(firstElement, 'root');
                else nav.setFocused(el);
                return stackObj;
            }
        },
        getRoot: function () {
            return this.stack[this.stack.length - 1].root;
        },
        canEscape: function (el) {
            var a;
            return (
                (a = this.stack[this.stack.length - 1]) &&
                (a = a.escapes) &&
                a.indexOf(el) > -1
            );
        },
        hasStack: function () {
            return this.stack.length > 1;
        },
        removeRoot: function (el) {
            if (this.stack)
                for (var i = this.stack.length - 1; i > 0; i--) {
                    if (this.stack[i].root == el) {
                        var last = this.stack[i].base;
                        this.stack.splice(i);
                        if (this.checkAttached(last))
                            this.setFocused(last, 'root');
                        break;
                    }
                }
        },
        outsideRoot: function (from) {
            var root = nav.getRoot();
            do {
                if (from.parentElement == root) {
                    return false;
                }
                from = from.parentElement;
            } while (from);
            return true;
        },
        checkAttached: function (el) {
            var a = el;
            while (a.parentNode) {
                a = a.parentNode;
            }
            return a == document;
        },
        pop: function () {
            if (this.stack.length > 1) {
                var last = this.stack.pop();
                last.close();
                if (nav.checkAttached(last.base)) {
                    this.setFocused(last.base, 'root');
                }
                return last;
            }
        },

        getElements: function (/*root*/) {
            return nav.getRoot().querySelectorAll(candidateSelector);
        },
        getNext: function (current, root, dir) {
            var result;
            if (this.delegate && this.delegate[dir]) {
                result = this.delegate.getNext(
                    current,
                    root,
                    dir,
                    this.getNext.bind(this)
                );
                if (result) return result;
            }
            var a = this.getElements(root);
            var i = indexOf(a, current);
            do {
                result = a[++i];
            } while (result && !tabbable.isVisible(result));
            if (!result) {
                if (!current) return null;
                if (!KeyListener.repeating && nav.canEscape(current)) {
                    nav.pop();
                    return;
                } else
                    return tabbable.isVisible(current)
                        ? current
                        : this.getNext(null, root);
            }
            return result;
        },
        getPrev: function (current, root, dir) {
            var result;
            if (this.delegate && this.delegate[dir]) {
                result = this.delegate.getPrev(
                    current,
                    root,
                    dir,
                    this.getPrev.bind(this)
                );
                if (result) return result;
            }
            var a = this.getElements(root);
            var i = indexOf(a, current);
            do {
                result = a[--i];
            } while (result && !tabbable.isVisible(result));
            if (!result) {
                if (!current) return null;
                if (!KeyListener.repeating && nav.canEscape(current)) {
                    nav.pop();
                    return;
                } else
                    return tabbable.isVisible(current)
                        ? current
                        : this.getNext(null, root);
            }
            return result;
        },
        getCurrentElement: function (root) {
            return this.lastEl || root;
        },
        shiftTo: Utils.noop,
    });
    var behaviours = (nav.defaults = {
        tabs: {
            vertical: true,
            horizontal: true,
            root: null,
            getPrev: function (current, root, dir, $default) {
                return $default(current, root);
            },
            getNext: function (current, root, dir, $default) {
                var isHorizontal =
                    this.root.clientWidth > this.root.clientHeight;
                if (
                    (dir == 'horizontal' && isHorizontal) ||
                    (dir == 'vertical' && !isHorizontal)
                ) {
                    return $default(current, root);
                }
                var a = this.root.getElementsByTagName('a');
                var i = a.length;
                while (--i > 0) {
                    if (tabbable.isVisible(a[i])) {
                        return $default(a[i], root);
                    }
                }
            },
            detect: function (node) {
                var tabs = node.parentElement.parentElement;
                if (tabs && (' ' + tabs.className + ' ').indexOf(' tabs ') > -1)
                    return tabs;
            },
        },
        fileview: {
            horizontal: true,
            root: null,
            getPrev: function (current, root, dir, $default) {
                var a = this.root.children;
                var i = -1;
                while (++i < a.length) {
                    if (tabbable.isTabbable(a[i])) {
                        return $default(a[i], root);
                    }
                }
            },
            getNext: function (current, root, dir, $default) {
                var a = this.root.children;
                var i = a.length;
                while (--i > 0) {
                    if (tabbable.isTabbable(a[i])) {
                        var result = $default(a[i], root);
                        if (
                            result &&
                            result.className.indexOf('file-item') > -1
                        ) {
                            return result;
                        }
                        return a[i];
                    }
                }
            },
            detect: function (node) {
                return (
                    (' ' + node.parentElement.className + ' ').indexOf(
                        ' fileview '
                    ) > -1 && node.parentElement
                );
            },
        },
    });
    if (uiConfig.enableKeyboardNavigation) {
        nav.attach();
    }
});