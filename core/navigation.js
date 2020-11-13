(function(global) {
    var tabbable = global.tabbable;
    var FocusManager = global.FocusManager;
    var Utils = global.Utils;

    function leaveFocusable(ev) {
        var target = ev.target;
        var data = target._track;
        clearData.apply(target);
        data.handler(data.lastEv, true);
    }

    function clearData() {
        if (this._track) {
            this.removeEventListener('blur', leaveFocusable);
            this._track = null;
        }
    }

    function trackBlur(el, ev, handler) {
        if (el._track) {
            el._track.lastEv = ev;
            el._track.clear();
        }
        else {
            var data = {
                lastEv: ev,
                handler: handler,
                clear: Utils.debounce(clearData.bind(el), 500)
            };
            data.clear();
            el._track = data;
            el.addEventListener('blur', leaveFocusable);
        }

    }
    var KeyListener = {
        attach: function(el, handler, provider) {
            var receiver;
            if (!Env.isDesktop) {
                var icon = document.createElement('span');
                icon.onclick = function(e) {
                    receiver.focus();
                    e.stopPropagation();
                };
                icon.className = 'keyboard-listener material-icons';
                receiver = document.createElement('textarea');
                receiver.value = "-";
                receiver.setAttribute('tabIndex', -1);
                receiver.style.opacity = 0;
                receiver.style.width = '2px';
                receiver.style.height = '2px';
                receiver.style.overflow = 'hidden';
                icon.appendChild(receiver);
                icon.appendChild(document.createTextNode('keyboard_shown'));
                el.appendChild(icon);
            }
            else receiver = el;
            if (provider) provider.handler = handler;
            else provider = {
                handler: handler,
                getCurrentElement: this.getCurrentElement,
                getNext: this.getNext,
                getPrev: this.getPrev,
                getElements: this.getElements,
            };
            handler.$listener = this.keyBoardHandler(el, receiver, handler, provider);
            el.addEventListener('keydown', handler.$listener);
            handler.$receiver = receiver;
            return provider;
        },
        detach: function(handler) {
            window.removeEventListener('keydown', handler.$listener);
            if (handler.$receiver.parentElement.className.indexOf('keyboard-listener')) {
                handler.$receiver.parentElement.remove();
            }
            handler.$listener = handler.$receiver = null;
        },
        getNext: function(current, root, direction) {
            var elements = this.getElements(root);
            return elements[this.lastEl < elements.length - 1 ? ++this.lastEl : this.lastEl];
        },
        getElements: function(root) {
            return this.handler.elementCache || (this.handler.elementCache = root.getElementsByClassName('tabbable'));
        },
        getCurrentElement: function(root) {
            if (this.handler.elementCache) {
                return this.handler.elementCache[this.lastEl];
            }
            this.lastEl = -1;
            return root;
        },
        getPrev: function(current, root, direction) {
            var elements = this.getElements(root);
            return elements[this.lastEl > 0 ? --this.lastEl : this.lastEl];
        },
        keyBoardHandler: function(el, receiver, handler, provider) {
            var self = provider;
            return function(e, force) {
                e = e || window.event;
                var isSelf = force || e.target == handler.$receiver || e.target == el ||
                    !(FocusManager.canTakeInput(e.target) && e.keyCode != 27);
                if (!isSelf) {
                    return trackBlur(e.target, e, handler.$listener);
                }
                var index = self.getCurrentElement(el);
                if (!index) return;
                var top = true;
                var next;
                var key = Number(e.keyCode);
                if (key >= 16 && key <= 18) return;
                switch (key) {
                    case 38:
                        //up
                        next = self.getPrev(index, el, "vertical");
                        break;
                    case 39:
                        top = false;
                        // right arrow
                        next = self.getNext(index, el, "horizontal");
                        break;
                    case 40:
                        top = false;
                        //down
                        next = self.getNext(index, el, "vertical");
                        break;
                    case 37:
                        //left arrow
                        next = self.getPrev(index, el, "horizontal");
                        break;
                    case 9:
                        // tab
                        if (e.shiftKey)
                            next = self.getPrev(index, true, "tab");
                        else {
                            top = false;
                            next = self.getNext(index, true, "tab");
                        }
                        break;
                    case 27:
                        //esc
                        if (!handler.blur(index))
                            return;
                        break;
                    default:
                        if (key === 229 && e.target == handler.$receiver) {
                            var char = handler.$receiver.value[1];
                            handler.$receiver.value = "-";
                            if (char) key = char.charCodeAt(0);
                            else return;
                        }
                        if (key /*space*/ == 32 || key /*enter*/ == 13) {
                            if (handler.onenter && handler.onenter(index, e))
                                break;
                            else {
                                $(index).click();
                            }
                        }
                        else {
                            if ((key >= 65 && key <= 90) || (key >= 97 && key < 122)) {
                                if (handler.on && handler.on(toString(String.fromCharCode(key), e), index))
                                    break;
                            }
                            return;
                        }
                }
                e.stopPropagation();
                e.preventDefault();
                if (next && next != index) {
                    next.scrollIntoView(top);
                    if (self.shifted)
                        handler.shiftTo(next, index);
                    else handler.moveTo(next, index);
                }

            };
        }
    };
    var direction = null;

    function doSkip(editor_textInput, dir) {
        $(editor_textInput.parentElement).addClass('nav-skipcontainer');
        editor_textInput.addEventListener('keydown', skip, true);
        direction = dir || 39;
    }
    var skip = function(e) {
        var key = parseInt(e.keyCode);
        if (key >= 16 && key <= 18) return;
        $(this.parentElement).removeClass('nav-skipcontainer');
        this.removeEventListener('keydown', skip, true);
        if (key == 9 || (key == direction + 1 || key == direction - 1)) {
            e.target.blur()
            nav.handler.$listener(e, true);
            FocusManager.focusIfKeyboard(nav.handler.$receiver,false);
        }
        else if (key == 13 || key == 32) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    window.addEventListener('mousedown', function(e) {
        nav.moveTo(e.target, 'mouse');
    }, true);
    window.addEventListener('focusin', function(e) {
        nav.moveTo(e.target, 'focus');
    }, true);

    var nav = {
        moveTo: function(a, force) {
            if (a == nav.lastEl) return;
            if (a == nav.handler.$receiver) return;
            do {
                if (tabbable.isTabbable(a)) {
                    nav.handler.moveTo(a, nav.getCurrentElement(document.body), force);
                    break;
                }
                a = a.parentElement;
            }
            while (a);
        },
        addBehaviour: function(name, behaviour) {
            behaviours[name] = behaviour;
        },
        stack: [{
            root: document.body
        }],
        addRoot: function(el, close) {
            this.stack.push({
                close: close,
                root: el,
                base: nav.getCurrentElement(),
            });
            this.moveTo(nav.getElements()[0], "root");
        },
        getRoot: function() {
            return this.stack[this.stack.length - 1].root;
        },
        hasStack: function() {
            return this.stack.length > 1;
        },
        removeRoot: function(el) {
            for (var i = this.stack.length - 1; i > 0; i--) {
                if (this.stack[i].root == el) {
                    var last = this.stack[i].base;
                    this.stack.splice(i);
                    if (this.checkAttached(last))
                        this.moveTo(last, "root");
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
            while (a.parentNode) {
                a = a.parentNode;
            }
            return a == document;
        },
        pop: function() {
            if (this.stack.length > 1) {
                var last = this.stack.pop();
                last.close();
                if (nav.checkAttached(last.base))
                    this.moveTo(last.base, "root");
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
            return result || (current && (tabbable.isVisible(current) ? current : this.getNext(null, root)));
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
            if (!result && nav.hasStack()) {
                nav.pop();
                return;
            }
            return result || (tabbable.isVisible(current) ? current : this.getNext(null, root));
        },
        getCurrentElement: function(root) {
            return this.lastEl || root;
        }
    };
    var behaviours = nav.defaults = {
        "tabs": {
            vertical: true,
            root: null,
            getPrev: function(current, root, dir, $default) {
                return $default(current, root);
                /*var a = this.root.getElementsByTagName('a');
                var i = -1;
                while (++i < a.length) {
                    if (tabbable.isVisible(a[i])) {
                        return $default(a[i], root);
                    }
                }*/
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
                return node.parentElement.parentElement && (' ' + node.parentElement.parentElement.className + ' ').indexOf(" tabs ") > -1 && node.parentElement.parentElement;
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
    var indexOf = Array.prototype.indexOf.call.bind(Array.prototype.indexOf)
    /*function(arr, i) {
            var j = -1;
            var k = arr.length - 1;
            for (; j < k;)
                if (arr[++j] == i) return j;
            return -1;
        };*/
    KeyListener.attach(document.body, {
        moveTo: function(a, e, source) {
            $(nav.lastEl).removeClass('nav-focused');
            nav.lastEl = a;
            var behaviour = a.parentElement.navBehaviour;
            if (behaviour === false) {
                nav.delegate = false;
            }
            else {
                var root;
                if (!behaviour) {
                    for (var i in behaviours) {
                        if ((root = behaviours[i].detect(a))) {
                            behaviour = behaviours[i];
                            a.parentElement.navBehaviour = behaviour;
                            break;
                        }
                    }
                }
                else {
                    root = behaviour.detect(a);
                }
                if (behaviour) {
                    nav.delegate = behaviour;
                    nav.delegate.root = root;
                }
                else {
                    nav.delegate = false;
                    a.parentElement.navBehaviour = false;
                }
            }
            if (FocusManager.canTakeInput(a)) {
                a.focus();
                if (!source && a.className.indexOf('ace_text-input') > -1) {
                    doSkip(a);
                }
            }
            else {
                if (source == "focus" || !source || (source == "root" && FocusManager.activeElement == nav.handler.$receiver)) {
                    $(a).addClass('nav-focused');
                    if (source == "focus") { // || !FocusManager.activeElement || FocusManager.activeElement == nav.handler.$receiver)) {
                        FocusManager.focusIfKeyboard(nav.handler.$receiver,false);
                    }
                }
            }
        },
        blur: function(el) {
            if (el.className.indexOf('ace_text-input') > -1) {
                nav.handler.moveTo(el);
            }
            else if (FocusManager.canTakeInput(el)) {
                el.blur();
            }
            else if (nav.hasStack()) {
                FocusManager.focusIfKeyboard(this.$receiver);
                nav.pop();
                return true;
            }
        },
        onenter: function(el, e) {
            if (FocusManager.canTakeInput(el)) {}
            else if (el.tagName == 'SELECT') {
                global.Overflow.openSelect(e, el);
                return true;
            }
            else if (FocusManager.activeElement == nav.handler.$receiver) {
                $(el).addClass('nav-focused');
                FocusManager.focusIfKeyboard(nav.handler.$receiver);
                $(el).click()
                return true;
            }
        },
        on: function(key, element) {
            //nothing yet
        }
    }, nav);
    global.Navigation = nav;
    global.KeyListener = KeyListener;
})(Modules)