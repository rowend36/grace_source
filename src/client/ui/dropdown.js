define(function (require, exports, module) {
  'use strict';
  /*globals $*/
  var FocusManager = require('./focus_manager').FocusManager;
  var Utils = require('../core/utils').Utils;
  var AutoCloseables = require('./auto_closeables').AutoCloseables;
  var Navigation = require('./navigation').Navigation;
  var setProp = Utils.setProp;

  /**
   * @callback UpdateCallback
   * @param {DropdownData} self - The dropdown being shown. Must not be modified directly.
   * @param {function} update - Accepts two arguments, a property to update and its new value.
   * 
   * @typedef {{
     "!update":[UpdateCallback],
     [property]:({
       "!update": UpdateCallback,
       caption: string,
       isHeader?: boolean,
       sortIndex?: number,
       className?: string,
       icon?: string,
       subIcon?: string,
       subTree?: DropdownData,
       rebase?: boolean - true if to anchor this item's subtree to the parent anchor
       hasChild?: boolean,
       anchor?: HTMLElement - set by this dropdown when an item 
                              with hasChild is clicked
       onclick: (ev: Event, id: string, item: HTMLElement)
     }|string)
   }} DropdownData
   
   * @constructor
   * @property {function} [ondismiss],
   * @property {function} [onclick]
   */
  function Dropdown(keepFocus, align, vAlign) {
    Dropdown.create(this, keepFocus, align, vAlign);
  }

  /**
   * @param {DropdownOpts} self
   * @param {Boolean} keepFocus? - whether the overflow should avoid stealing focus
   * @param {string} align? - how to align . One of right(align with right edge),left (align with left edge), full (take the full screen), center (center on screen), responsive-right (align right on wide screens and take full screen on mobile)
   * @param {string} vAlign? - One of above,below,above_or_below,full
   */

  Dropdown.create = function (self, keepFocus, align, vAlign) {
    if (keepFocus === undefined) keepFocus = true;
    if (align === undefined) align = 'right';
    var isSmallScreen = window.innerWidth < 600;

    /** @type {HTMLElement} anchor */
    var anchor;
    var id = Utils.genID('o');
    var cachedElements = {};
    var history = [];
    //prevent calling ondismiss while recreating
    var inRecreate;

    /** @type {DropdownData} root,current */
    var root, current;

    function getElement() {
      return cachedElements[history.join('>')];
    }

    function showDropdown(name, parent) {
      //no data for specified path
      if (!current[name]) {
        return;
      }
      if (current == root) {
        isSmallScreen = window.innerWidth < 600;
        if (!inRecreate) {
          anchor = parent;
          addOverlay();
          AutoCloseables.add(id, autoCloseHandler);
        }
        //remove previous overflows on small screens
      } else if (isSmallScreen) {
        Navigation.removeRoot(getElement());
        $(getElement()).hide();
      }
      history.push(name);
      var items = current[name].subTree;
      current = items;
      var elem = getElement();
      for (var i in items) {
        if (items[i] && items[i]['!update']) {
          items[i]['!update'](items, lazyAssign.bind(items));
        }
      }
      if (items['!update']) {
        items['!update'].forEach(function (e) {
          if (e(items, lazyAssign.bind(items))) items['!changed'] = true;
        });
      }
      if (items['!changed'] && elem) {
        items['!changed'] = false;
        $(elem).remove();
        elem = null;
      }
      if (!elem) {
        elem = Dropdown.createElement(items, id);
        $(elem).click(handleItemClick);
        if (keepFocus) {
          var hasInputs = $(elem).find('input,textarea');
          FocusManager.trap($(elem), !hasInputs.length);
        }
        cachedElements[history.join('>')] = elem;
      }
      document.body.appendChild(elem);
      //Position above the highest possible modal dialog
      elem.style.zIndex = ++Dropdown.count + 1100;
      if (inRecreate) $(elem).show();
      else $(elem).fadeIn();

      Dropdown.positionElement(
        elem,
        isSmallScreen ? anchor : parent,
        document.body,
        align,
        history.length > 1 && !isSmallScreen,
        vAlign,
      );
      Navigation.addRoot(elem, hideOverflow);
    }

    function hideOverflow(e) {
      var b = getElement();
      Navigation.removeRoot(b);
      --Dropdown.count;
      history.pop();
      current = getCurrent(root, history) || root;
      if (inRecreate) $(b).hide();
      else {
        if (history.length == 0) {
          //used for onOverlayClick
          removeOverlay();
          AutoCloseables.close(id);
          self.ondismiss && self.ondismiss(e);
        }
        $(b).fadeOut();
      }
    }

    var overlay;

    function addOverlay() {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = overlay.style.left = overlay.style.right = overlay.style.bottom = 0;
        overlay.style.opacity = 0;
        $(overlay).click(handleOverlayClick);
        if (keepFocus) FocusManager.trap($(overlay), true);
      }
      document.body.appendChild(overlay);
      Dropdown.count++;
      overlay.style.zIndex = Dropdown.count + 1100;
    }

    function removeOverlay() {
      Dropdown.count--;
      overlay.remove();
    }

    function handleOverlayClick(e) {
      e.stopPropagation();
      if (history.length == 0) {
        //Should be impossible but
        //did the same in sidenav
        //just out of paranoia,
        removeOverlay();
        console.error('handleOverlayClick called without current Item');
        return;
      }
      hideOverflow(e);
      var parent = closest(e.target, id);
      while (current != root && getElement() != parent) {
        hideOverflow(e);
      }
    }

    function handleItemClick(e) {
      if (closest(e.target, id) != getElement()) {
        return handleOverlayClick(e);
      }
      e.stopPropagation();
      var span = closest(e.target, id, true);
      if (!span) return;
      var id2 = span.getAttribute('id');
      if (!id2) return;
      var data = current[id2];
      if (data.hasChild) {
        data.anchor = isSmallScreen ? anchor : span;
      }
      if (self.onclick && self.onclick(e, id2, span, data)) {
        //do nothing
      } else if (data.onclick) {
        data.onclick(e, id2, span);
      }
      if (id2 == 'back') {
        hideOverflow();
      } else if (data.subTree) {
        FocusManager.hintNoChangeFocus();
        showDropdown(id2, data.rebase ? anchor : span, true);
      } else if (data.close !== false || (data.hasChild && isSmallScreen)) {
        while (history[0]) {
          hideOverflow();
        }
      }
    }

    function hideAll() {
      while (history.length > 0) {
        hideOverflow();
      }
    }

    function toggleDropdown(e) {
      if (root) {
        if (history.length < 1) showDropdown('root', e.currentTarget);
        else {
          hideAll();
        }
      }
      e.stopPropagation();
    }

    self.createTrigger = function (btn) {
      if (keepFocus) FocusManager.trap($(btn), true);
      $(btn).on('click', toggleDropdown);
    };

    //BackButton clears all dropdowns
    var autoCloseHandler = {
      close: hideAll,
    };

    self.show = function (el, shift) {
      showDropdown('root', el, shift);
    };
    self.hide = hideAll;
    self.close = hideOverflow;

    /**
     * Used when multiple dropdowns are shown.
     * The lower dropdowns don't receive the click event.
     * The user can manually call onOverlayClick.
     */
    self.onOverlayClick = function (e) {
      var parent = closest(document.elementFromPoint(e.clientX, e.clientY), id);
      while (current != root && getElement() != parent) {
        hideOverflow(e);
      }
    };

    /**
     * Like setData but updates the content of a dropdown
     * without hiding it. Hides subtrees.
     */
    self.update = function (w) {
      var el = cachedElements.root;
      while (history.length > 1) {
        hideOverflow();
      }
      if (w) {
        root = {
          root: {
            subTree: w,
          },
        };
      }
      current = getCurrent(root, history) || root;

      if (el) {
        var elem = Dropdown.createElement(w || root.root.subTree, id);
        //Could be more efficient, but the entire overflow could be more efficient
        el.innerHTML = elem.innerHTML;
        if (getElement() == el) {
          Dropdown.positionElement(el, anchor, document.body, align);
        }
      }
    };

    /**
     * Sets the data of a dropdown.
     * @param {DropdownData} [w] - the new data, can be null
     * @param {RegExp} [invalidateRe]
     */
    self.setData = function (w, invalidateRe) {
      var store = history.slice(0);
      if (history.length) {
        inRecreate = true;
        while (history.length) {
          hideOverflow();
        }
      }
      if (w) {
        root = {
          root: {
            subTree: w,
          },
        };
      }
      current = root;
      for (var i in cachedElements) {
        if (!invalidateRe || invalidateRe.test(i)) {
          $(cachedElements[i]).remove();
          delete cachedElements[i];
        }
      }
      if (inRecreate) {
        for (var j = 0; current[store[j]] && j < store.length; j++) {
          showDropdown(
            store[j],
            j < 1 ? anchor : $(getElement()).find('#' + store[j])[0],
          );
        }
        inRecreate = false;
        if (history.length === 0) {
          // Should be impossible
          self.ondismiss && self.ondismiss();
          AutoCloseables.close(id);
          removeOverlay();
        }
      }
    };
  };

  var lazyAssign = function (prop, value) {
    if (this[prop] !== value) {
      this[prop] = value;
      this['!changed'] = true;
    }
  };

  function closest(el, id, isParentId) {
    var childEl;
    while (el) {
      if (el.getAttribute('id') == id) {
        return isParentId ? childEl && childEl.children[0] : el;
      }
      childEl = el;
      el = el.parentElement;
    }
  }

  function getCurrent(root, history) {
    if (!history.length) {
      return root;
    }
    var current = root;
    for (var i = 0; i < history.length; i++) {
      if (!current[history[i]]) {
        return null;
      }
      current = current[history[i]].subTree;
    }
    return current;
  }

  Dropdown.count = 0;
  Dropdown.defaultLabel = function (label) {
    return {
      isHeader: true,
      className: 'mt-10',
      caption:
        "<label class='sub-header'>" + Utils.htmlEncode(label) + '</label>',
    };
  };

  //Merges two data trees
  Dropdown.assign = function (dest, src) {
    if (src['!update']) {
      dest['!update'] = dest['!update'] || [];
      dest['!update'].push.apply(dest['!update'], src['!update']);
    }
    for (var i in src) {
      if (src[i] == undefined) continue;
      if (i == '!update') continue;
      if (dest[i] && src[i]) {
        if (src[i].subTree && dest[i].subTree) {
          Dropdown.assign(dest[i].subTree, src[i].subTree);
          var items = dest[i].subTree;
          Object.assign(dest[i], src[i]);
          dest[i].subTree = items;
          continue;
        }
      }
      setProp(dest, i, src[i]);
    }
  };

  // How many items in a list must have icons for us to show icons
  Dropdown.minIconPercent = 0.7;
  Dropdown.createElement = function (items, id) {
    var menu = document.createElement('ul');
    var noCaret = true,
      numIcons = 0;
    menu.setAttribute('id', id);
    menu.className = 'dropdown-content';
    var sorted = [[]];
    var p = 0;
    //collect item
    for (var h in items) {
      if (items[h] && h[0] != '!') {
        if (items[h].isHeader) {
          sorted.push([]);
          p++;
        }
        sorted[p].push(h);
      }
    }
    //sort sections
    if (sorted[0][0] && sorted[0][0].isHeader) {
      sorted.sort(function (a, b) {
        var t = items[a].sortIndex || 100;
        var l = items[b].sortIndex || 100;
        return items[a].isHeader
          ? -1
          : items[b].isHeader
          ? 1
          : l > t
          ? -1
          : l < t
          ? 1
          : (items[a].caption || items[a]).localeCompare(
              items[b].caption || items[b],
            );
      });
    }
    //sort items in each section
    sorted.forEach(function (e) {
      e.sort(function (a, b) {
        var t = items[a].sortIndex || 100;
        var l = items[b].sortIndex || 100;
        return items[a].isHeader
          ? -1
          : items[b].isHeader
          ? 1
          : l > t
          ? -1
          : l < t
          ? 1
          : (items[a].caption || items[a]).localeCompare(
              items[b].caption || items[b],
            );
      });
    });
    var numHeaders = sorted.length - 1;
    //merge everything back
    sorted = [].concat.apply([], sorted);
    for (var j = 0; j < sorted.length; j++) {
      var i = sorted[j];
      var item = document.createElement('li');
      item.className = items[i].className || '';
      if (items[i].isHeader) {
        item.innerHTML = items[i].caption;
      } else {
        var a = document.createElement('a');
        a.className = 'dropdown-item';
        if (items[i].icon) {
          numIcons++;
          var icon = document.createElement('span');
          icon.className = 'material-icons dropdown-icon';
          icon.innerText = items[i].icon;
          if (items[i].subIcon) {
            icon.className += ' parent-icon';
            var subIcon = document.createElement('span');
            subIcon.className = 'sub-icon';
            subIcon.innerText = items[i].subIcon;
            icon.appendChild(subIcon);
          }
          a.appendChild(icon);
        } else a.className += ' dropdown-item-noicon';
        a.setAttribute('href', '#');
        a.setAttribute('id', i);
        a.innerHTML += items[i].caption || items[i];
        if (items[i].subTree || items[i].hasChild) {
          if (noCaret) noCaret = false;
          var caret = document.createElement('span');
          caret.className = 'dropdown-caret';
          caret.innerHTML = "<span class='material-icons'>play_arrow</span>";
          a.appendChild(caret);
        }
        item.appendChild(a);
      }
      menu.appendChild(item);
    }
    if (!noCaret) menu.className += ' dropdown-has-caret';
    if (numIcons / (sorted.length - numHeaders) > Dropdown.minIconPercent)
      menu.className += ' dropdown-has-icon';
    return menu;
  };
  /**
   * Tries to align an element with size 'itemSize',
   * with one of the edges of an element with dimensions in 'box'.
   * Used by searchbox.
   * @param {DOMRect} rect - a container element
   * @param itemSize {number} - size of item
   * @param size {number} - size of window whom the positions in box are relative to
   * @param {boolean} [vertical=false]
   * @returns {{0?:number,1?:number}}
   */
  Dropdown.clipWindow = function (box, itemSize, size, vertical) {
    var a = vertical ? 'top' : 'left';
    var b = vertical ? 'bottom' : 'right';
    var c = vertical ? 'Height' : 'Width';
    var W = size || window['inner' + c];
    if (box[b] > itemSize) {
      return [undefined, W - box[b]];
    } else if (box[a] < W - itemSize) {
      return [box[a]];
    } else {
      return [0, 0];
    }
  };

  Dropdown.defaultAlignment = 'right';
  /**
    Maximize screen usage on mobile with positionElement
   * @param {HTMLElement} element - the element to position
   * @param {HTMLElement|[HTMLElement]} anchor - the button that triggered the dropdown
   * @param {HTMLElement} [inside=document.body] - the bounding container
   * @param {(right|left|full|center|responsive-right)} [align=Dropdown#defaultAlignment] - horizontal alignment
   * @param {boolean} allowBeside - allow desktop stacking behaviour on wide screens
   * @param {(above|below|above_or_below|full|max)} [vertAlign='above_or_below'] - horizontal alignment
   **/
  Dropdown.positionElement = function (
    element,
    anchor,
    inside,
    align,
    allowBeside,
    vertAlign,
  ) {
    align = align || Dropdown.defaultAlignment;
    vertAlign = vertAlign || 'above_or_below';
    inside = inside || document.body;

    var offsetTop = 0;
    var offsetLeft = 0;
    if (inside !== document.body) {
      var outer = inside.getBoundingClientRect();
      offsetTop = outer.top;
      offsetLeft = outer.left;
    }
    var maxH = inside.clientHeight;
    var maxW = inside.clientWidth;

    var anchorRect = anchor.getBoundingClientRect();
    var anchorOffset = anchorRect.height;
    var anchorBottom = anchorRect.bottom - offsetTop;
    var anchorTop = anchorRect.top - offsetTop;
    var anchorLeft = anchorRect.left - offsetLeft;
    var anchorRight = anchorRect.right - offsetLeft;

    element.style.height = 'initial';
    element.style.overflow = 'auto';
    var h = $(element).height() + 20;
    var w = $(element).width();

    //Try positioning element to the beside the trigger
    if (allowBeside) {
      if (anchorRight > 0 && maxW - anchorRight > w + 10) {
        element.style.right = maxW - anchorRight - w + 'px';
        anchorOffset = 0;
        element.style.left = 'auto';
      } else if (anchorLeft > w + 10) {
        element.style.left = anchorLeft - w + 'px';
        anchorOffset = 0;
        element.style.right = 'auto';
      } else allowBeside = false;
    }

    /*
     * max -
     * full - fill the container ie inside
     * top,bottom,top_or_bottom - align above or below anchor
     * top_or_bottom - tries to position below or above.
     * max - like top_or_bottom but does not clip the element size
            (except to container).
     */
    var top;
    var marginTop = 5, // top margin of element
      marginBottom = 10, // bottom margin of element
      minHeight = 250,
      padding = 15, //padding of container(collapsed with margins)
      bias = allowBeside ? 1.25 : 0.8; //>1 means prefer the dropdown above.
    var canBeAbove = anchorBottom - anchorOffset > h + padding;
    var canBeBelow = maxH - (anchorTop + anchorOffset) > h + padding;
    var preferBelow =
      maxH - (anchorTop + anchorOffset) > (anchorBottom - anchorOffset) * bias;
    if (vertAlign == 'above_or_below') {
      if (preferBelow) {
        vertAlign = 'below';
      } else vertAlign = 'above';
    }
    if (vertAlign == 'below' || (preferBelow && vertAlign === 'max')) {
      if (canBeBelow) {
        //Position below
        top = anchorTop + anchorOffset + marginTop;
      } else if (
        vertAlign !== 'max' &&
        maxH - anchorBottom - anchorOffset > minHeight
      ) {
        //Clip height then position below
        top = anchorTop + anchorOffset + marginTop;
        h = maxH - top - padding;
        $(element).css('height', h);
      } else if (canBeAbove) {
        //position above, possible because preferBelow has a bias
        top = anchorBottom - anchorOffset - h - marginBottom;
      } else {
        vertAlign = 'full';
      }
    } else if (vertAlign !== 'full') {
      if (canBeAbove) {
        //position above
        top = anchorBottom - anchorOffset - h - marginBottom;
      } else if (vertAlign !== 'max' && anchorTop + anchorOffset > minHeight) {
        //crop then position above
        top = padding;
        h = anchorBottom - anchorOffset - padding - marginBottom;
        $(element).css('height', h);
      } else if (canBeBelow) {
        //position below, possible because preferBelow has a bias
        top = anchorTop + anchorOffset + marginTop;
      } else {
        vertAlign = 'full';
      }
    }
    if (vertAlign == 'full') {
      if (h > maxH - padding * 2) {
        h = maxH - padding * 2;
        $(element).css('height', h);
        top = padding;
      } else top = maxH - h - padding; //anchor to bottom of screen
    }
    if (top * 1.5 > maxH) {
      element.style.bottom = maxH - top - h + 'px';
      element.style.top = 'auto';
    } else {
      element.style.top = top + 'px';
      element.style.bottom = 'auto';
    }
    if (allowBeside) return;

    if (
      align == 'right' ||
      (align == 'responsive-right' && window.innerWidth > 400)
    ) {
      element.style.right = maxW - Math.max(w + 10, anchorRight - 10) + 'px';
      element.style.left = 'auto';
    } else if (align == 'left') {
      element.style.left = Math.min(anchorLeft + 10, maxW - w - 10) + 'px';
      element.style.right = 'auto';
    } else {
      var space =
        align == 'full'
          ? 20
          : align == 'responsive-right'
          ? Math.min(20, (maxW - w) / 2)
          : (maxW - w) / 2; //center no margin
      element.style.right = space + 'px';
      element.style.left = space + 'px';
    }
  };

  Dropdown.openSelect = function (ev, select) {
    if (ev) {
      select = select || ev.target;
      ev.preventDefault();
      if (!require('./focus_manager').FocusManager.keyboardVisible) {
        select.focus();
      }
    }

    var opts = $(select).find('option,optgroup');
    var items = [];
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].tagName == 'OPTGROUP') {
        items.push({
          isHeader: true,
          className: i ? 'mt-10' : '',
          caption:
            "<label class='sub-header'>" +
            opts[i].getAttribute('label') +
            '</label>',
        });
      } else {
        items.push({
          value: opts[i].value,
          caption: opts[i].innerHTML,
        });
      }
    }
    var dropdown = new Dropdown(false, 'responsive-right');
    dropdown.setData(items);
    dropdown.show(select);
    dropdown.onclick = function (ev, id, element, item) {
      select.value = item.value;
      $(select).trigger('change');
    };
    dropdown.ondismiss = function () {
      dropdown.setData(null);
    };
  };

  exports.Dropdown = Dropdown;
}); /*_EndDefine*/
