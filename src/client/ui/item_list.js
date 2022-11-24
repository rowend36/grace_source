define(function (require, exports, module) {
    /*globals $*/
    var FocusManager = require('./focus_manager').FocusManager;
    var KeyListener = require('./soft_keyboard_navigation').KeyListener;

    var EventsEmitter = require('../core/events_emitter').EventsEmitter;
    var Utils = require('../core/utils').Utils;
    /*
      Events: moveSelect - called on keyboard focus,
              select, clear and dismiss
    */
    function ItemList(id, items, container) {
        ItemList.super(this);
        this.container = container || document.body;
        this.id = id;
        if (items) {
            this.items = items;
        }
    }
    Utils.inherits(ItemList, EventsEmitter);
    ItemList.prototype.onEsc = function () {
        $(this.selected).removeClass('item-selected');
        this.selected = null;
    };
    ItemList.prototype.moveTo = function (newEl, oldEl) {
        $(oldEl).removeClass('item-selected');
        this.selected = newEl;
        $(newEl).addClass('item-selected');
        var index = newEl.getAttribute('item-list-index');
        if (index || index === 0) {
            this.trigger('moveSelect', this.getItem(index), true);
        }
    };
    ItemList.prototype.selectAll = function () {};
    ItemList.prototype.shiftTo = ItemList.prototype.moveTo;
    ItemList.prototype.getNext = function (current, root) {
        var elements = this.getElements(root);
        var lastIndex = indexOf(elements, current);
        return elements[lastIndex + 1] || current;
    };
    ItemList.prototype.getElements = function (root) {
        return root.getElementsByClassName('tabbable');
    };
    ItemList.prototype.getCurrentElement = function (root) {
        if (this.selected) {
            return this.selected;
        }
        return root;
    };
    ItemList.prototype.getPrev = function (current, root) {
        var elements = this.getElements(root);
        var lastIndex = indexOf(elements, current);
        return elements[lastIndex - 1] || elements[0];
    };
    ItemList.prototype.select = function (index) {
        var current = this.selected;
        if (current) $(current).removeClass('item-selected');
        this.selected = this.getElementAtIndex(index);
        if (this.selected) $(this.selected).addClass('item-selected');
        this.trigger(
            'select',
            {
                index: index,
                item: this.getItem(index),
            },
            true
        );
    };

    ItemList.prototype.getLength = function () {
        return this.items.length;
    };
    ItemList.prototype.getHtml = function (index) {
        return this.items[index];
    };
    ItemList.prototype.getItem = function (index) {
        return this.items[index];
    };
    ItemList.prototype.createItem = function (index) {
        var el = document.createElement('li');
        el.className = this.itemClass + ' tabbable';
        el.setAttribute('tabIndex', 0);
        el.innerHTML = this.getHtml(index);
        return el;
    };
    ItemList.prototype.getElementAtIndex = function (index) {
        return this.listEl.getElementsByClassName(this.itemClass)[index];
    };
    ItemList.prototype.createElement = function () {
        var root = (this.el = document.createElement('div'));

        root.setAttribute('id', this.id);
        var toId = function (name) {
            return name.toLowerCase().replace(/\s/g, '_');
        };
        this.container.appendChild(root);
        root.className = this.containerClass;
        KeyListener.attach(this.el, this);
        $(root).append(
            "<h6 class='modal-header'></h6>" +
                "<div class='modal-content'>" +
                "<ul class='" +
                this.listClass +
                "'>" +
                '</ul>' +
                '</div>' +
                (this.footer
                    ? "<div class='modal-footer align-right'>" +
                      this.footer
                          .map(function (name) {
                              return (
                                  '<a id="item-list-' +
                                  toId(name) +
                                  '" href="#!" class="tabbable waves-effect btn-flat">' +
                                  name +
                                  '</a>'
                              );
                          })
                          .join('') +
                      '</div>'
                    : '')
        );
        this.listEl = $(root).find('ul')[0];
        var self = this;
        this.$el = $(this.el);
        this.$el
            .on('click', '.list-item', function (e) {
                FocusManager.focusIfKeyboard(self.$receiver);
                e.stopPropagation();
                var index = $(this).attr('item-list-index');
                self.select(index);
            })
            .on('click', function (e) {
                FocusManager.focusIfKeyboard(self.$receiver);
                e.stopPropagation();
            });
        if (this.footer)
            this.footer.forEach(function (name) {
                this.$el.on(
                    'click',
                    '#item-list-' + toId(name),
                    self['$' + toId(name)] || false
                );
            }, this);
    };
    ItemList.prototype.onEnter = function (el, ev) {
        ev && ev.stopPropagation();
        el.click();
    };
    ItemList.prototype.getRoot = function () {
        return this.container;
    };
    ItemList.prototype.containerClass = 'modal modal-container';
    ItemList.prototype.itemClass = 'item_list-item border-inactive';
    ItemList.prototype.listClass = 'item-list-items';
    ItemList.prototype.headerText = '';
    ItemList.prototype.emptyText = 'No items';
    ItemList.prototype.render = function () {
        if (!this.el) {
            this.createElement();
        }
        var header = this.$el.find('.modal-header')[0];
        header.innerHTML = this.headerText;
        var content = this.listEl;
        var item;
        content.innerHTML = '';
        if (this.selected) $(this.selected).removeClass('item-selected');
        this.selected = null;
        if (this.getLength() > 0) {
            for (var i = 0; i < this.getLength(); i++) {
                item = this.createItem(i);
                item.className += ' list-item';
                item.setAttribute('item-list-index', i);
                content.appendChild(item);
            }
        } else {
            item = document.createElement('li');
            item.setAttribute('class', 'item-list-empty');
            item.innerHTML = this.emptyText;
            content.appendChild(item);
        }
    };

    var indexOf = Array.prototype.indexOf.call.bind(Array.prototype.indexOf);
    exports.ItemList = ItemList;
}); /*_EndDefine*/