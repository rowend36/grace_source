(function(global) {
    var KeyListener = {
        attach: function(el) {
            var receiver;
            if (!Env.isDesktop) {
                var icon = document.createElement('span');
                icon.onclick = function() {
                    receiver.focus();
                };
                icon.className = 'keyboard-listener material-icons';
                receiver = document.createElement('textarea');
                receiver.style.opacity = 0;
                receiver.style.width = '2px';
                receiver.style.height = '2px';
                receiver.style.overflow = 'hidden';
                icon.appendChild(receiver);
                icon.appendChild(document.createTextNode('keyboard_shown'));
                el.appendChild(icon);
            }
            else receiver = el;
            receiver.addEventListener('keydown', this.keyBoardHandler(el, receiver));
            return receiver;
        },
        items: [],
        getNext: function(current, descend, root, bubble) {
            if (descend) {
                var elements = [];
                elements.push.apply(elements, root.getElementsByClassName('tabbable'));
                var index = elements.indexOf(current);
                return elements[index + 1];
            }
            else {
                var next;
                while ((next = current.nextElementSibling)) {
                    if (next.className.indexOf('tabbable'))
                        return next;
                }
            }
            /*var next;
            if (descend) {
                next = current.firstElementChild || current.nextElementSibling;
            }
            else next = current.nextElementSibling;
            if (!next && (descend ||bubble) && current.parentElement != root) {
                //recurse outwards
                return this.getNext(current.parentElement,false,root,true);
            }
            if(!next || next.className.indexOf('tabbable')>-1)
                return next;
            else return this.getNext(next,descend||bubble,root)*/
        },
        getPrev: function(current, bubble, root) {
            if (bubble) {
                var elements = [];
                elements.push.apply(elements, root.getElementsByClassName('tabbable'));
                var index = elements.indexOf(current);
                return elements[index - 1];
            }
            else {
                var next;
                while ((next = current.previousElementSibling)) {
                    if (next.className.indexOf('tabbable'))
                        return next;
                }
            }
            /*var next;
            next = current.previousElementSibling;
            if (bubble){
                if (next) {
                    //recurse inwards
                    while(next.lastElementChild)
                        next = next.lastElementChild;
                }
                else if (current.parentElement != root) {
                    next = current.parentElement;
                }
            }
            if(!next || next.className.indexOf('tabbable')>-1)
                return next;
            else return this.getPrev(next,bubble,root);*/
        },
        keyBoardHandler: function(el, receiver) {
            var self = this;
            return function(e) {
                var index = el.getElementsByClassName('selected')[0] || el.firstChild;
                if (!index) return;
                e = e || window.event;
                var next;
                switch ("" + e.keyCode) {
                    case '38':
                        //up
                        next = self.getPrev(index, true, el);
                        break;
                    case '39':
                        // right arrow
                        next = self.getNext(index,true,el);
                        break;
                    case '40':
                        //down
                        next = self.getNext(index, true, el);
                        break;
                    case '37':
                        //left arrow
                        next = self.getPrev(index,true,el);
                        break;
                    case '9':
                        // tab
                        if (e.shiftKey)
                            next = self.getPrev(index, true, el);
                        else next = self.getNext(index, true, el);
                        break;
                    case '13':
                        $(index).click();
                        break;
                    case '27':
                        $(index).removeClass('selected');
                        this.blur();
                        break;
                    default:
                        return;
                }
                e.preventDefault();
                if (next && next != receiver) {
                    next.scrollIntoView(false);
                    if (Env.isDesktop) {
                        next.focus();
                    }
                    $(next).addClass('selected');
                    $(index).removeClass('selected');
                }
            };
        }
    };


    function QuickList(id, items, container) {
        this._eventRegistry = [];
        this.items = items || [];
        this.container = container || document.body;
        this.id = id;
        this.$clear = (function() {
            this.items.length = 0;
            this.trigger('clear');
            this.hide();
        }).bind(this);
        this.$hide = this.hide.bind(this);
    }
    var keys = require('ace/lib/keys').keys;

    Object.assign(QuickList.prototype, EventsEmitter.prototype);
    QuickList.prototype.createElement = function() {
        var root = this.el = document.createElement('div');
        root.setAttribute('id', this.id);
        this.container.appendChild(root);
        root.className = 'modal bottom-sheet quick-list-container';
        root.innerHTML = "<div class='modal-content'>" +
            "<h6 id='quick-list-header'></h6>" +
            "<ul id='quick-list-items'>" +
            "</ul>" +
            "</div>" +
            "<div class='modal-footer'>" +
            '<a id="quick-list-close" href="#!" class="align-left tabbable modal-close waves-effect btn-flat">' +
            'Close</a>' +
            '<a id="quick-list-clear" href="#!" class="tabbable modal-close waves-effect btn-flat">' +
            'Clear</a>' +
            '</div>';
        this.$el = $(this.el);
        var self = this;
        this.$el.on('click', '.quick-list-item', function() {
                var index = $(this).attr('index');
                self.trigger('select', self.items[index], index);
            }).on('click', '#quick-list-clear', this.$clear).on('click', '#quick-list-close', this.$hide)
            .on('click', function(e) {
                e.stopPropagation();
            });
        this.receiver = KeyListener.attach(this.el);
    };
    QuickList.prototype.hide = function() {
        if (!this.shown) return;
        this.shown = false;
        this.$el.fadeOut();
        FocusManager.focusIfKeyboard(this.lastFocus);
        document.body.removeEventListener('click', this.$hide);
    };
    QuickList.prototype.headerText = "";
    QuickList.prototype.emptyText = "No items";
    QuickList.prototype.show = function(forElement) {
        if (this.shown) return;
        this.shown = true;
        this.lastFocus = forElement || document.activeElement || document.body;
        this.render();
        this.$el.fadeIn();
        FocusManager.focusIfKeyboard(this.receiver);
        document.body.addEventListener('click', this.$hide);
    };
    QuickList.prototype.render = function() {
        if (!this.el) {
            this.createElement();
        }
        var header = this.$el.find('#quick-list-header')[0];
        header.innerHTML = this.headerText;
        var content = this.$el.find('#quick-list-items')[0];
        content.innerHTML = "";
        var item;
        this.items.forEach(function(e, i) {
            item = document.createElement('li');
            item.setAttribute('index', i);
            item.className = 'tabbable quick-list-item';
            item.appendChild(document.createTextNode(e));
            content.appendChild(item);
        });
        if (!item) {
            item = document.createElement('li');
            item.setAttribute("class", 'quick-list-empty');
            item.innerHTML = this.emptyText;
            content.appendChild(item);
        }
    }
    global.QuickList = QuickList;
})(Modules);