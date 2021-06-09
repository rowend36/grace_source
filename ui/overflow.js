_Define(function(global) {
  "use strict";
  var FocusManager = global.FocusManager;
  var KeyListener = global.KeyListener;
  var Utils = global.Utils;
  var AutoCloseable = global.AutoCloseable;
  var Navigation = global.Navigation;

  /*@param {Boolean} keepFocus - whether the overflow should avoid stealing focus
  * @param {string} align - how to align . One of right(align with right edge),left (align with left edge), full (take the full screen), center (center on screen), responsive-right (align right on wide screens and take full screen on mobile)
  */
  function Overflow(keepFocus, align) {
    if (keepFocus === undefined) keepFocus = true;
    if (align === undefined) align = 'right';
    var anchor;
    var id = Utils.genID("o");
    var childElems = {};
    var nav = [];
    var root, current;
    var self = this;

    function getElement() {
      return childElems[nav.join(">")];
    }

    function showOverflow(name, parent, event) {
      var isSmallScreen = window.innerWidth < 600;
      //no data for specified path
      if (!current[name]) {
        return;
      }
      if (current == root) {
        if (!inRecreate) {
          anchor = parent;
          addOverlay();
          AutoCloseable.add(id, closeable);
        }
        //remove previous overflows on small screens
      } else if (isSmallScreen) $(getElement()).hide();
      nav.push(name);
      var hier = current[name].childHier;
      current = hier;
      var elem = childElems[nav.join(">")];
      var changed = false;
      if(hier["!update"]){
        hier["!update"].forEach(function(e){
          changed = e(hier) || changed;
        });
      }
      if(changed && elem){
        elem.onclick = null;
        elem.remove();
        elem = null;
      }
      if (!elem) {
        elem = Overflow.createElement(hier, id);
        elem.onclick = handleItemClick;
        if (keepFocus) {
          var hasInputs = $(elem).find('input,textarea');
          FocusManager.trap($(elem), !hasInputs.length);
        }
        childElems[nav.join(">")] = elem;
      }
      document.body.appendChild(elem);
      //anchor is the first parent ie the button that initiated the overflow
      Overflow.positionContainer(elem, isSmallScreen ? anchor : parent, document.body, align, nav.length > 1 && !isSmallScreen);
      elem.style.zIndex = (++Overflow.count) + 1100;
      if(inRecreate)$(elem).show();
      else
        $(elem).fadeIn();
      Navigation.addRoot(elem, self.close);
    }

    function hideOverflow(e) {
      var b = getElement();
      if(inRecreate)$(b).hide();
      else
        $(b).fadeOut();
      Navigation.removeRoot(b);
      --Overflow.count;
      nav.pop();
      current = currentTarget() || root;
      if (nav.length == 0 && !inRecreate) {
        removeOverlay();
        AutoCloseable.close(id);
        self.ondismiss && self.ondismiss(e);
      } else {
        //do nothing
      }
    }

    var overlay;

    function addOverlay(append) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.style.position = "absolute";
        overlay.style.top =
          overlay.style.left =
          overlay.style.right =
          overlay.style.bottom = 0;
        overlay.onclick = handleBodyClick;
        if (keepFocus)
          FocusManager.trap($(overlay), true);
      }
      document.body.appendChild(overlay);
      Overflow.count++;
      overlay.style.zIndex = Overflow.count + 1100;
    }

    function removeOverlay(detach) {
      Overflow.count--;
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
        parent = parent[nav[i]].childHier;
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
      var data = current[id2];
      if (self.onclick && self.onclick(e, id2, span, data)) {
        //do nothing
      } else if (data.onclick) {
        data.onclick(e, id2, span);
      }
      if (id2 == 'back') {
        hideOverflow();
      } else if (data.childHier) {
        FocusManager.hintNoChangeFocus();
        showOverflow(id2, data.rebase ? anchor : span, true);
      } else if (data.close !== false) {
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
            childHier: w
          }
        };
      }
      current = currentTarget() || root;

      if (el) {
        var elem = Overflow.createElement(w || root.root.childHier, id);
        //could be more efficient, the entire overflow could be more efficient
        el.innerHTML = elem.innerHTML;
        if (getElement() == el) {
          Overflow.positionContainer(el, anchor, document.body, align);
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
    self.setHierarchy = function(w, changed) {
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
            childHier: w
          }
        };
      }
      current = root;
      for (var i in childElems) {
        if (!changed || changed.test(i)) {
          childElems[i].onclick = null;
          childElems[i].remove();
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
  Overflow.count = 0;

  Overflow.createElement = function(hier, id) {
    var menu = document.createElement("ul");
    var noCaret = true,
      noIcon = true;
    menu.setAttribute("id", id);
    menu.className = "dropdown-content";
    var sorted = [];
    for (var h in hier) {
      if (hier[h] && h[0]!="!")
        sorted.push(h);
    }
    sorted = sorted.sort(function(a, b) {
      var t = hier[a].sortIndex || 100;
      var l = hier[b].sortIndex || 100;
      return l > t ? -1 : l < t ? 1 : ((hier[a].isHeader ? 0 : 1) - (hier[b].isHeader ? 0 : 1)) || a.localeCompare(b);
    });
    for (var j in sorted) {
      var i = sorted[j];
      var item = document.createElement("li");
      item.className = hier[i].className || "";
      if (hier[i].isHeader) {
        item.innerHTML = hier[i].caption;
      } else {
        var a = document.createElement("a");
        a.className = "dropdown-item";
        if (hier[i].icon) {
          if (noIcon) noIcon = false;
          var icon = document.createElement('span');
          icon.className = 'material-icons dropdown-icon';
          icon.innerHTML = hier[i].icon;
          a.appendChild(icon);
        } else a.className += " dropdown-item-noicon";
        a.setAttribute('href', '#');
        a.setAttribute("id", i);
        a.innerHTML += hier[i].caption || hier[i];
        if (hier[i].childHier || hier[i].hasChild) {
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
    if (!noIcon) menu.className += " dropdown-has-icon";
    return menu;
  };
  Overflow.defaultAlignment = "right";
  /** @param {DOMRect} rect - a container element
   * @param itemSize {number} size of item
   * @param size {number} size of outer container whom the positions are relative to
   * @param {boolean} [vertical=false]
   * Will try to align with either edge
   * if not will align with outer container
   * does not care about container width
   * @returns {{0?:number,1?:number}}
   */
  Overflow.clipWindow = function(rect, itemSize, size, vertical) {
    var a = vertical ? 'top' : 'left';
    var b = vertical ? 'bottom' : 'right';
    var c = vertical ? 'Height' : 'Width';
    var w = itemSize;
    var W = size || window['inner' + c];
    if (rect[a] < W - w) {
      return [rect[a]];
    } else if (rect[b] > w) {
      return [undefined, W - rect[b]];
    } else {
      return [0, 0];
    }
  };
  Overflow.positionContainer = function(el, anchor, inside, align, allowShift, vPos) {
    align = align || Overflow.defaultAlignment;
    var rect = anchor.getBoundingClientRect();
    var offset = rect.height;
    var y = rect.bottom;

    el.style.height = 'initial';
    el.style.overflow = 'auto';

    var h = $(el).height() + 20; //I cant tell how jquery does it
    var maxH = inside.clientHeight;
    var maxW = inside.clientWidth;
    var w = $(el).width();


    var isShifted = false;
    
    //shift element to the right of trigger
    if (allowShift) {
      if ((rect.right > 0) && (maxW - rect.right > (w + 10))) {
        el.style.right = maxW - rect.right - w + "px";
        isShifted = true;
        el.style.left = "auto";
      }
    }
    
    var top;
    var canBeAbove = y > h - (isShifted ? offset : 0) + 10;
    var canBeBelow = maxH - y - (isShifted ? offset : 0) > h + 15;
    if (vPos == "below" || (vPos != "above" && (maxH - y) > (y - offset)*0.8)) {
      if (canBeBelow) {//position below
        top = y + 5 - (isShifted ? offset : 0);
      } else if (maxH - y > 250) {//fix maximum height
        h = maxH - y - 25;
        $(el).css('height', h);
        top = y + 5 - (isShifted ? offset : 0);
      } else if (canBeAbove) {//position above, not sure how this is possible
        top = y - h - offset - 10 + (isShifted ? offset : 0);
      } else {//fill screen
        if (h > maxH - 10) {
          h = maxH - 20;
          $(el).css('height', h);
          top = 10;
        } else top = maxH - h - 10;
      }
    } else if (canBeAbove) {//position above
      top = y - h - offset - 10 + (isShifted ? offset : 0);
    } else if (canBeBelow) {//position below
      top = y + 5 + (isShifted ? offset : 0);
    } else {//fill screen
      if (h > maxH - 10) {
        h = maxH - 20;
        $(el).css('height', h);
        top = 10;
      } else top = maxH - h - 10;
    }
    if (top * 1.5 > maxH) {
      el.style.bottom = maxH - top - h + "px";
      el.style.top = "auto";
    } else {
      el.style.top = top + "px";
      el.style.bottom = "auto";
    }
    if (isShifted) return;

    if (align == "right" || (align == "responsive-right" && window.innerWidth > 400)) {
      el.style.right = maxW - Math.max(w + 10, rect.right - 10) + "px";
      el.style.left = "auto";
    } else if (align == "left") {
      el.style.left = Math.min(rect.left + 10, maxW - w - 10) + "px";
      el.style.right = "auto";
    } else {
      var space = align == "full" ? 20 : align == "responsive-right" ? Math.min(20, (maxW - w) / 2) : (maxW - w) / 2;//center no margin
      //full
      el.style.right = space + "px";
      el.style.left = space + "px";
    }

  };
  global.Overflow = Overflow;
}); /*_EndDefine*/
_Define(function(global) {
  var Overflow = global.Overflow;
  Overflow.openSelect = function(ev, select) {
    if (ev) {
      select = select || ev.target;
      ev.preventDefault();
    }
    var opts = select.getElementsByTagName('option');
    var items = [];
    for (var i = 0; i < opts.length; i++) {
      items.push({
        value: opts[i].value,
        caption: opts[i].innerHTML
      });
    }
    var dropdown = new Overflow(false, "responsive-right");
    dropdown.setHierarchy(items);
    dropdown.show(select);
    dropdown.onclick = function(ev, id, element, item) {
      select.value = item.value;
      $(select).trigger("change");
    };
    dropdown.ondismiss = function(ev) {
      dropdown.setHierarchy(null);
    };
  };
}); /*_EndDefine*/
_Define(function(global) {
  var menuItems = {
    'more': false
  };

  var otherItems = {

  };
  var otherClick = {
    icon: "more_vert",
    caption: "More",
    childHier: otherItems,
    sortIndex: 10000,
  };
  var menu = global.MainMenu = new global.Overflow(true);
  menu.setHierarchy(menuItems);
  menu.addOption = function(optionId, option, showAsMore) {
    if (menuItems[optionId]) {
      menuItems[optionId] = option;
    } else if (otherItems[optionId]) {
      otherItems[optionId] = option;
    } else {
      var hier = menuItems;
      if (showAsMore === undefined) showAsMore = Object.keys(menuItems).length > 6;
      if (showAsMore) {
        hier = otherItems;
      }
      hier[optionId] = option;
    }
    if (Object.keys(otherItems).length > 0) {
      menuItems.more = otherClick;
    }
    menu.setHierarchy(menuItems);
  };
  menu.extendOption = function(optionId, option) {
    if (menuItems[optionId] && menuItems[optionId].childHier) {
      Object.assign(menuItems[optionId].childHier, option.childHier);
      menu.addOption(optionId, menuItems[optionId]);
    } else if (otherItems[optionId] && otherItems[optionId].childHier) {
      Object.assign(otherItems[optionId].childHier, option.childHier);
      menu.addOption(optionId, otherItems[optionId]);
    } else menu.addOption(optionId, option);
  };
  menu.removeOption = function(optionId) {
    if (menuItems[optionId])
      delete menuItems[optionId];
    if (menuItems.others[optionId]) {
      delete menuItems.others[optionId];
      if (Object.keys(otherItems).length < 1) {
        menuItems.more = false;
      }
    }
    menu.setHierarchy(menuItems);
  };
}); /*_EndDefine*/