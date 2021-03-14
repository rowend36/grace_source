_Define(
    function(global) {
        var FocusManager = global.FocusManager;
        var KeyListener = global.KeyListener;

        var EventsEmitter = global.EventsEmitter;
        var Utils = global.Utils;

        function ItemList(id, items, container) {
            ItemList.super(this);
            this.container = container || document.body;
            this.id = id;
            if (items) {
                this.items = items;
            }
        }
        Utils.inherits(ItemList, EventsEmitter);
        ItemList.prototype.blur = function(el) {
            this.selected = null;
            $(el).removeClass('selected');
        };
        ItemList.prototype.moveTo = function(newEl, oldEl) {
            $(oldEl).removeClass('selected');
            this.selected = newEl;
            $(newEl).addClass('selected');
            var index = newEl.getAttribute('index');
            if (index || index === 0) {
                this.trigger('moveSelect', this.getItem(index), true);
            }
        };
        ItemList.prototype.selectAll = function(newEl, oldEl) {

        };
        ItemList.prototype.shiftTo = ItemList.prototype.moveTo;
        ItemList.prototype.getNext = function(current, root, direction) {
            var elements = this.getElements(root);
            return elements[this.lastEl < elements.length - 1 ? ++this.lastEl : this.lastEl];
        };
        ItemList.prototype.getElements = function(root) {
            return this.elementCache || (this.elementCache = root.getElementsByClassName('tabbable'));
        };
        ItemList.prototype.getCurrentElement = function(root) {
            if (this.elementCache) {
                return this.elementCache[this.lastEl];
            }
            this.lastEl = -1;
            return root;
        };
        ItemList.prototype.getPrev = function(current, root, direction) {
            var elements = this.getElements(root);
            return elements[this.lastEl > 0 ? --this.lastEl : this.lastEl];
        };
        ItemList.prototype.select = function(index) {
            var current = this.selected;
            if (current)
                $(current).removeClass('selected');
            this.selected = this.getElementAtIndex(index);
            if (this.selected)
                $(this.selected).addClass('selected');
            this.trigger('select', {
                index: index,
                item: this.getItem(index)
            }, true);
        };

        ItemList.prototype.getLength = function() {
            return this.items.length;
        };
        ItemList.prototype.getHtml = function(index) {
            return this.items[index];
        };
        ItemList.prototype.getItem = function(index) {
            return this.items[index];
        };
        ItemList.prototype.createItem = function(index) {
            var el = document.createElement('li');
            el.className = this.itemClass + " tabbable";
            el.setAttribute('index', index);
            el.setAttribute('tabIndex', 0);
            el.innerHTML = this.getHtml(index);
            return el;
        };
        ItemList.prototype.getElementAtIndex = function(index) {
            return this.listEl.getElementsByClassName(this.itemClass)[index];
        };
        ItemList.prototype.createElement = function(opts) {
            var root = this.el = document.createElement('div');
            root.setAttribute('id', this.id);
            this.container.appendChild(root);
            root.className = this.containerClass;
            root.innerHTML = "<div class='list-content'>" +
                "<h6 class='item-list-header'></h6>" +
                "<ul class='item-list-items'>" +
                "</ul>" +
                "</div>" +
                "<div class='modal-footer'>" +
                (this.footer ? this.footer.map(function(name, i) {
                    return '<a id="item-list-' + name.toLowerCase() + '" href="#!" class="' + (i < 1 ? "align-left " : "") + 'tabbable waves-effect btn-flat">' +
                        name + '</a>';
                }).join("") : "") +
                '</div>';
            this.listEl = root.getElementsByClassName('item-list-items')[0];
            var self = this;
            this.$el = $(this.el);
            this.$el.on('click', '.' + this.itemClass, function(e) {
                    FocusManager.focusIfKeyboard(self.$receiver);
                    e.stopPropagation();
                    var index = $(this).attr('index');
                    self.select(index);
                })
                .on('click', function(e) {
                    FocusManager.focusIfKeyboard(self.$receiver);
                    e.stopPropagation();
                });
            if (this.footer)
                this.footer.forEach(function(name) {
                    this.$el.on('click', '#item-list-' + name.toLowerCase(), this["$" + name.toLowerCase()]);
                }, this);
            KeyListener.attach(this.el, this);
        };
        ItemList.prototype.onenter = function(e){
            e.click();
        };
        ItemList.prototype.containerClass = 'modal modal-container';
        ItemList.prototype.itemClass = "item-list-item";
        ItemList.prototype.headerText = "";
        ItemList.prototype.emptyText = "No items";
        ItemList.prototype.render = function() {
            if (!this.el) {
                this.createElement();
            }
            var header = this.$el.find('.item-list-header')[0];
            header.innerHTML = this.headerText;
            var content = this.listEl;
            content.innerHTML = "";
            this.elementCache = null;
            if (this.selected)
                $(this.selected).removeClass('selected');
            this.selected = null;
            if (this.getLength() > 0) {
                for (var i = 0; i < this.getLength(); i++) {
                    var item = this.createItem(i);
                    content.appendChild(item);
                }
            } else {
                item = document.createElement('li');
                item.setAttribute("class", 'item-list-empty');
                item.innerHTML = this.emptyText;
                content.appendChild(item);
            }
        }

        function QuickList(id, items, container) {
            QuickList.super(this, arguments);
            this.$clear = (function(e) {
                this.items.length = 0;
                this.trigger('clear', null, true);
                this.hide(e);
            }).bind(this);
            this.$close = this.hide.bind(this);
        }
        QuickList.prototype.getHtml = function(index) {
            return ("" + this.items[index]).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        QuickList.prototype.containerClass = "modal bottom-list"
        QuickList.prototype.itemClass = "bottom-list-item"
        QuickList.prototype.footer = ["Clear", "Close"];
        QuickList.prototype.hide = function(e) {
            if (e) e.stopPropagation()
            if (!this.shown) return;
            this.shown = false;
            this.trigger('dismiss', null, true);
            this.$el.fadeOut();
            this.lastFocus();
            this.lastFocus = null;
        };
        QuickList.prototype.blur = function() {
            this.hide();
        }
        QuickList.prototype.show = function(forElement) {
            if (this.shown) return;
            this.shown = true;
            this.render();
            this.$el.fadeIn();
            this.$el.css("z-index", 1200)
            this.lastFocus = FocusManager.visit(this.$receiver);
        };
        Utils.inherits(QuickList, ItemList);

        global.BottomList = QuickList;
        global.ItemList = ItemList;
    }) /*_EndDefine*/