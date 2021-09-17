_Define(function(global) {
  "use strict";
  var FocusManager = global.FocusManager;
  var Utils = global.Utils;
  var AutoCloseable = global.AutoCloseable;
  var Navigation = global.Navigation;

  /*@param {Boolean} keepFocus? - whether the overflow should avoid stealing focus
   * @param {string} align? - how to align . One of right(align with right edge),left (align with left edge), full (take the full screen), center (center on screen), responsive-right (align right on wide screens and take full screen on mobile)
   * @param {string} vAlign? - One of above,below,above_or_below,full
   */
  function Dropdown(keepFocus, align, vAlign) {
    if (keepFocus === undefined) keepFocus = true;
    if (align === undefined) align = 'right';
    var anchor;
    var id = Utils.genID("o");
    var childElems = {};
    var nav = [];
    var root, current;
    var self = this;
    var isSmallScreen = window.innerWidth < 600;

    function getElement() {
      return childElems[nav.join(">")];
    }
    var $set = function(prop, value) {
      if (this[prop] !== value) {
        this[prop] = value;
        this["!changed"] = true;
      }
    };

    function showOverflow(name, parent) {
      //no data for specified path
      if (!current[name]) {
        return;
      }
      if (current == root) {
        isSmallScreen = window.innerWidth < 600;
        if (!inRecreate) {
          anchor = parent;
          addOverlay();
          AutoCloseable.add(id, closeable);
        }
        //remove previous overflows on small screens
      } else if (isSmallScreen) {
        Navigation.removeRoot(getElement());
        $(getElement()).hide();
      }
      nav.push(name);
      var items = current[name].subTree;
      current = items;
      var elem = childElems[nav.join(">")];
      if (items["!update"]) {
        items["!update"].forEach(function(e) {
          if (e(items, $set.bind(items))) items["!changed"] = true;
        });
      }
      if (items["!changed"] && elem) {
        items["!changed"] = false;
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
        childElems[nav.join(">")] = elem;
      }
      document.body.appendChild(elem);
      //anchor is the first parent ie the button that initiated the overflow
      Dropdown.positionElement(elem, isSmallScreen ? anchor : parent, document.body, align, nav.length > 1 && !
        isSmallScreen, vAlign);
      //Position above the highest possible modal dialog
      elem.style.zIndex = (++Dropdown.count) + 1100;
      if (inRecreate) $(elem).show();
      else
        $(elem).fadeIn();
      Navigation.addRoot(elem, self.close);
    }

    function hideOverflow(e) {
      var b = getElement();
      Navigation.removeRoot(b);
      --Dropdown.count;
      nav.pop();
      current = currentTarget() || root;
      if (inRecreate) $(b).hide();
      else {
        if (nav.length == 0) {
          //used for onOverlayClick
          removeOverlay();
          AutoCloseable.close(id);
          self.ondismiss && self.ondismiss(e);
        }
        $(b).fadeOut();
      }
    }

    var overlay;

    function addOverlay() {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.style.position = "absolute";
        overlay.style.top =
          overlay.style.left =
          overlay.style.right =
          overlay.style.bottom = 0;
        overlay.style.opacity = 0;
        $(overlay).click(handleBodyClick);
        if (keepFocus)
          FocusManager.trap($(overlay), true);
      }
      document.body.appendChild(overlay);
      Dropdown.count++;
      overlay.style.zIndex = Dropdown.count + 1100;
    }

    function removeOverlay() {
      Dropdown.count--;
      overlay.remove();
    }

    function currentTarget() {
      if (!nav.length) {
        return null;
      }
      var parent = root;
      for (var i in nav) {
        if (!parent[nav[i]]) {
          return null;
        }
        parent = parent[nav[i]].subTree;
      }
      return parent;
    }

    function handleBodyClick(e) {
      e.stopPropagation();
      if (nav.length == 0) {
        //Should never happen but
        //just out of paranoia
        removeOverlay();
        console.error('handleBodyClick called without current Item');
        return;
      }
      hideOverflow(e);
      var parent = closest(e.target);
      while (current != root && getElement() != parent) {
        hideOverflow(e);
      }
    }

    function handleItemClick(e) {
      if (closest(e.target) != getElement()) {
        return handleBodyClick(e);
      }
      e.stopPropagation();
      var span = closest(e.target, true);
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
        showOverflow(id2, data.rebase ? anchor : span, true);
      } else if (data.close !== false || ((data.hasChild && isSmallScreen))) {
        while (nav[0]) {
          hideOverflow();
        }
      }
    }

    function closest(el, child) {
      var childEl;
      while (el) {
        if (el.getAttribute('id') == id) {
          return child ? childEl && childEl.children[0] : el;
        }
        childEl = el;
        el = el.parentElement;
      }
    }
    //backButton clears all for closeable interface for state
    var closeable = {
      close: function() {
        while (nav[0]) {
          hideOverflow();
        }
      }
    };
    //prevent calling ondissmiss while recreating
    var inRecreate;

    self.show = function(el, shift) {
      showOverflow('root', el, shift);
    };
    self.hide = closeable.close;

    self.onOverlayClick = function(e) {
      var parent = closest(document.elementFromPoint(e.clientX, e.clientY));
      while (current != root && getElement() != parent) {
        hideOverflow(e);
      }
    };

    //closeable interface for navigation
    self.close = hideOverflow;

    //For now only supports depth of 1 since previous overflows are not visible on mobile
    self.update = function(w) {
      var el = childElems.root;
      while (nav.length > 1) {
        hideOverflow();
      }
      if (w) {
        root = {
          root: {
            subTree: w
          }
        };
      }
      current = currentTarget() || root;

      if (el) {
        var elem = Dropdown.createElement(w || root.root.subTree, id);
        //could be more efficient, the entire overflow could be more efficient
        el.innerHTML = elem.innerHTML;
        if (getElement() == el) {
          Dropdown.positionElement(el, anchor, document.body, align);
        }
      }
    };

    function toggle(e) {
      if (root) {
        if (nav.length < 1)
          showOverflow("root", e.currentTarget);
        else {
          closeable.close();
        }
      }
      e.stopPropagation();
    }

    self.createTrigger = function(btn) {
      if (keepFocus)
        FocusManager.trap($(btn), true);
      $(btn).on("click", toggle);
    };

    //wierd name but it stuck setData is more like it
    self.setData = function(w, changed) {
      var store = [].concat(nav);
      if (nav.length) {
        inRecreate = true;
        while (nav.length) {
          hideOverflow();
        }
      }
      if (w) {
        root = {
          root: {
            subTree: w
          }
        };
      }
      current = root;
      for (var i in childElems) {
        if (!changed || changed.test(i)) {
          $(childElems[i]).remove();
          delete childElems[i];
        }
      }
      if (inRecreate) {
        for (var j = 0; current[store[j]] && j < store.length; j++) {
          showOverflow(store[j], j < 1 ? anchor : $(getElement()).find("#" + store[j])[0]);
        }
        inRecreate = false;
        if (nav.length === 0) {
          // should be impossible
          self.ondismiss && self.ondismiss();
          AutoCloseable.close(id);
          removeOverlay();
        }
      }
    };
  }
  Dropdown.count = 0;
  Dropdown.defaultLabel = function(label) {
    return {
      isHeader: true,
      className: 'mt-10',
      caption: "<label class='sub-header'>" + Utils.htmlEncode(label) + "</label>"
    };
  };
  var setProp = Utils.setProp;
  //Merges two data trees
  Dropdown.assign = function(dest, src) {
    if (src["!update"]) {
      dest["!update"] = dest["!update"] || [];
      dest["!update"].push.apply(dest["!update"], src["!update"]);
    }
    for (var i in src) {
      if (src[i] == undefined) continue;
      if (i == "!update") continue;
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
  Dropdown.createElement = function(items, id) {
    var menu = document.createElement("ul");
    var noCaret = true,
      numIcons = 0;
    menu.setAttribute("id", id);
    menu.className = "dropdown-content";
    var sorted = [
      []
    ];
    var p = 0;
    //collect item
    for (var h in items) {
      if (items[h] && h[0] != "!") {
        if (items[h].isHeader) {
          sorted.push([]);
          p++;
        }
        sorted[p].push(h);
      }
    }
    //sort sections
    if (sorted[0][0] && sorted[0][0].isHeader) {
      sorted.sort(function(a, b) {
        var t = items[a].sortIndex || 100;
        var l = items[b].sortIndex || 100;
        return items[a].isHeader ? -1 : items[b].isHeader ? 1 : l > t ? -1 : l < t ? 1 : (
          items[a].caption || items[a]).localeCompare(items[b].caption || items[b]);
      });
    }
    //sort items in each section
    sorted.forEach(function(e) {
      e.sort(function(a, b) {
        var t = items[a].sortIndex || 100;
        var l = items[b].sortIndex || 100;
        return items[a].isHeader ? -1 : items[b].isHeader ? 1 : l > t ? -1 : l < t ? 1 : (
          items[a].caption || items[a]).localeCompare(items[b].caption || items[b]);
      });
    });
    var numHeaders = sorted.length - 1;
    //merge everything back
    sorted = [].concat.apply([], sorted);
    for (var j = 0; j < sorted.length; j++) {
      var i = sorted[j];
      var item = document.createElement("li");
      item.className = items[i].className || "";
      if (items[i].isHeader) {
        item.innerHTML = items[i].caption;
      } else {
        var a = document.createElement("a");
        a.className = "dropdown-item";
        if (items[i].icon) {
          numIcons++;
          var icon = document.createElement('span');
          icon.className = 'material-icons dropdown-icon';
          icon.innerText = items[i].icon;
          if (items[i].subIcon) {
            icon.className += " parent-icon";
            var subIcon = document.createElement('span');
            subIcon.className = 'sub-icon';
            subIcon.innerText = items[i].subIcon;
            icon.appendChild(subIcon);
          }
          a.appendChild(icon);
        } else a.className += " dropdown-item-noicon";
        a.setAttribute('href', '#');
        a.setAttribute("id", i);
        a.innerHTML += items[i].caption || items[i];
        if (items[i].subTree || items[i].hasChild) {
          if (noCaret) noCaret = false;
          var caret = document.createElement("span");
          caret.className = "dropdown-caret";
          caret.innerHTML = "<span class='material-icons'>play_arrow</span>";
          a.appendChild(caret);
        }
        item.appendChild(a);
      }
      menu.appendChild(item);
    }
    if (!noCaret) menu.className += " dropdown-has-caret";
    if ((numIcons / (sorted.length - numHeaders)) > Dropdown.minIconPercent) menu.className +=
      " dropdown-has-icon";
    return menu;
  };
  Dropdown.defaultAlignment = "right";
  /** @param {DOMRect} rect - a container element
   * @param itemSize {number} size of item
   * @param size {number} size of outer container whom the positions are relative to
   * @param {boolean} [vertical=false]
   * Will try to align with either edge
   * if not will align with outer container
   * does not care about container width
   * @returns {{0?:number,1?:number}}
   */
  Dropdown.clipWindow = function(rect, itemSize, size, vertical) {
    var a = vertical ? 'top' : 'left';
    var b = vertical ? 'bottom' : 'right';
    var c = vertical ? 'Height' : 'Width';
    var w = itemSize;
    var W = size || window['inner' + c];
    if (rect[b] > w) {
      return [undefined, W - rect[b]];
    } else if (rect[a] < W - w) {
      return [rect[a]];
    } else {
      return [0, 0];
    }
  };
  //Maximize screen usage on mobile with position container
  Dropdown.positionElement = function(element, anchor, inside, align, allowToRight, vertAlign) {
    align = align || Dropdown.defaultAlignment;

    var anchorRect = anchor.getBoundingClientRect();
    var anchorH = anchorRect.height;
    var anchorBottom = anchorRect.bottom;
    var anchorTop = anchorRect.top;

    element.style.height = 'initial';
    element.style.overflow = 'auto';
    var h = $(element).height() + 20; //jquery gets better approximation of height
    var w = $(element).width();

    var maxH = inside.clientHeight;
    var maxW = inside.clientWidth;


    //Try positioning element to the right of trigger
    if (allowToRight) {
      if ((anchorRect.right > 0) && (maxW - anchorRect.right > (w + 10))) {
        element.style.right = maxW - anchorRect.right - w + "px";
        anchorH = 0;
        element.style.left = "auto";
      } else allowToRight = false;
    }

    var top;
    var gapAbove = 5,
      gapBelow = 10,
      padding = 15;
    vertAlign = "above_or_below";
    var canBeAbove = anchorBottom - anchorH > h + padding;
    var canBeBelow = maxH - (anchorTop + anchorH) > h + padding;
    var preferBelow = (maxH - (anchorTop + anchorH)) > (anchorBottom - anchorH) * 0.8;
    if (vertAlign == "above_or_below") {
      if (preferBelow) {
        vertAlign = "below";
      } else vertAlign = "above";
    }
    if (vertAlign == "below" || (preferBelow && !vertAlign)) {
      if (canBeBelow) {
        //position below
        top = anchorTop + anchorH + gapAbove;
      } else if (vertAlign || maxH - anchorBottom > 250) {
        //clip height then position below
        h = maxH - (anchorTop + anchorH) - gapAbove - padding;
        $(element).css('height', h);
        top = anchorTop + anchorH + gapAbove;
      } else if (canBeAbove) { //position above, used
        top = anchorBottom - anchorH - h - gapBelow;
      } else {
        vertAlign = "full";
      }
    } else if (vertAlign !== "full") {
      if (canBeAbove) { //position above
        top = anchorBottom - anchorH - h - gapBelow;
      } else if (vertAlign) { //crop then position above
        h = anchorBottom - anchorH - padding - gapBelow;
        $(element).css('height', h);
        top = padding;
      } else {
        vertAlign = "full";
      }
    }
    if (vertAlign == "full") {
      if (h > maxH - padding * 2) {
        h = maxH - padding * 2;
        $(element).css('height', h);
        top = padding;
      } else top = maxH - h - padding; //anchor to bottom of screen
    }
    if (top * 1.5 > maxH) {
      element.style.bottom = maxH - top - h + "px";
      element.style.top = "auto";
    } else {
      element.style.top = top + "px";
      element.style.bottom = "auto";
    }
    if (allowToRight) return;

    if (align == "right" || (align == "responsive-right" && window.innerWidth > 400)) {
      element.style.right = maxW - Math.max(w + 10, anchorRect.right - 10) + "px";
      element.style.left = "auto";
    } else if (align == "left") {
      element.style.left = Math.min(anchorRect.left + 10, maxW - w - 10) + "px";
      element.style.right = "auto";
    } else {
      var space = align == "full" ? 20 :
        align == "responsive-right" ? Math.min(20, (maxW - w) / 2) :
        (maxW - w) / 2; //center no margin
      element.style.right = space + "px";
      element.style.left = space + "px";
    }

  };
  global.Dropdown = Dropdown;
}); /*_EndDefine*/
_Define(function(global) {
  var Dropdown = global.Dropdown;
  Dropdown.openSelect = function(ev, select) {
    if (ev) {
      select = select || ev.target;
      ev.preventDefault();
      if (!global.FocusManager.keyboardVisible) {
        select.focus();
      }
    }

    var opts = $(select).find("option,optgroup");
    var items = [];
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].tagName == 'OPTGROUP') {
        items.push({
          isHeader: true,
          className: i ? 'mt-10' : '',
          caption: "<label class='sub-header'>" + opts[i].getAttribute('label') + "</label>"
        });
      } else {
        items.push({
          value: opts[i].value,
          caption: opts[i].innerHTML
        });
      }
    }
    var dropdown = new Dropdown(false, "responsive-right");
    dropdown.setData(items);
    dropdown.show(select);
    dropdown.onclick = function(ev, id, element, item) {
      select.value = item.value;
      $(select).trigger("change");
    };
    dropdown.ondismiss = function() {
      dropdown.setData(null);
    };
  };
}); /*_EndDefine*/
_Define(function(global) {
  var Dropdown = global.Dropdown;
  var moreItems = {

  };

  var menuItems = {
    'more': {
      icon: "more_vert",
      caption: "More",
      subTree: moreItems,
      sortIndex: 10000,
    }
  };
  var menu = global.MainMenu = new Dropdown();
  menu.setData(menuItems);
  menu.addOption = function(optionId, option, showAsMore) {
    if (optionId == "!update") {
      if (!showAsMore) {
        Array.prototype.push.apply((menuItems[optionId] || (menuItems[optionId] = [])), option);
      }
      if (showAsMore || showAsMore === undefined) {
        Array.prototype.push.apply((moreItems[optionId] || (moreItems[optionId] = [])), option);
      }
    } else if (menuItems[optionId]) {
      menuItems[optionId] = option;
    } else if (moreItems[optionId]) {
      moreItems[optionId] = option;
    } else {
      var items = menuItems;
      if (showAsMore === undefined) {
        showAsMore = Object.keys(menuItems).filter(function(e) {
          return e !== "!changed" && e !== '!update' && !menuItems["!" + e];
        }).length>6;
      }
      if (showAsMore) {
        items = moreItems;
      }
      items[optionId] = option;
    }
    menu.setData();
  };
  menu.extendOption = function(optionId, option, others) {
    var extension = {};
    extension[optionId] = option;
    if (menuItems[optionId]) {
      Dropdown.assign(menuItems, extension);
      menu.setData();
    } else if (moreItems[optionId]) {
      Dropdown.assign(moreItems, extension);
      menu.setData();
    } else menu.addOption(optionId, option, others);
  };
  menu.removeOption = function(optionId) {
    if (menuItems[optionId])
      delete menuItems[optionId];
    if (menuItems.others[optionId]) {
      delete menuItems.others[optionId];
    }
    menu.setData(menuItems);
  };
}); /*_EndDefine*/