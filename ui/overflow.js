_Define(function(global) {
    "use strict";
    var FocusManager = global.FocusManager;
    var KeyListener = global.KeyListener;
    var Utils = global.Utils;
    var AutoCloseable = global.AutoCloseable;
    var Navigation = global.Navigation;

    function Overflow(keepFocus = true, align = "right") {
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
            if (!current[name]) {
                return;
            }
            if (current == root && !inRecreate) {
                anchor = parent;
                addOverlay();
                AutoCloseable.add(id, closeable);
            }
            nav.push(name);
            var hier = current[name].childHier;
            current = hier;
            var elem = childElems[nav.join(">")];
            if (!elem) {
                elem = Overflow.createElement(hier, id);
                elem.onclick = handleClick;
                if (keepFocus) {
                    var hasInputs = $(elem).find('input,textarea');
                    FocusManager.trap($(elem), !hasInputs.length);
                }
                childElems[nav.join(">")] = elem;
            }
            document.body.appendChild(elem);
            Overflow.positionContainer(elem, parent, document.body, event, align);
            elem.style.zIndex = (++Overflow.count) + 1100;
            $(elem).fadeIn();
            Navigation.addRoot(elem, self.close);
        }

        function hideOverflow(e) {
            var b = getElement();
            $(b).fadeOut();
            Navigation.removeRoot(b);
            --Overflow.count;
            nav.pop();
            current = currentTarget() || root;
            if (nav.length==0 && !inRecreate) {
                removeOverlay();
                AutoCloseable.close(id);
                self.ondismiss && self.ondismiss(e);
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
            if (nav.length==0) {
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

        function handleClick(e) {
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
        //one backButton clears all
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
                    Overflow.positionContainer(el, anchor, document.body, false, align);
                }
            }
        };
        self.createTrigger = function(btn) {
            if (keepFocus)
                FocusManager.trap($(btn), true);
            btn.addEventListener("click", function(e) {
                if (root) {
                    if (nav.length<1)
                        showOverflow("root", btn);
                    else {
                        closeable.close();
                    }
                }
                e.stopPropagation();
            });
        };
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
                    //impossible
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
        var hasCaret = false;
        menu.setAttribute("id", id);
        menu.className = "dropdown-content fileview-dropdown align-center";
        var sorted = [];
        for (var i in hier) {
            if (hier[i])
                sorted.push(i);
        }
        sorted = sorted.sort(function(a, b) {
            var t = hier[a].sortIndex || 0;
            var l = hier[b].sortIndex || 0;
            return l > t ? -1 : l < t ? 1 : (hier[b].icon ? 1 : 0) - (hier[b].icon ? 1 : 0);
        });
        for (var j in sorted) {
            var i = sorted[j];
            var item = document.createElement("li");
            item.className = hier[i].className || "";
            if (hier[i].isHeader) {
                item.innerHTML = hier[i].caption;
            } else {
                var a = document.createElement("a");
                if (hier[i].icon) {
                    var icon = document.createElement('span');
                    icon.className = 'material-icons dropdown-icon';
                    icon.innerHTML = hier[i].icon;
                    a.appendChild(icon);
                }
                a.className = "dropdown-item";
                a.setAttribute('href', '#');
                a.setAttribute("id", i);
                a.innerHTML += hier[i].caption || hier[i];
                if (hier[i].childHier || hier[i].hasChild) {
                    hasCaret = true;
                    var caret = document.createElement("span");
                    caret.className = "dropdown-caret";
                    caret.innerHTML = "<span class='material-icons'>play_arrow</span>";
                    a.appendChild(caret);
                }
                item.appendChild(a);
            }
            menu.appendChild(item);
        }
        if (hasCaret) menu.className += " dropdown-has-caret";
        return menu;
    };
    Overflow.defaultAlignment = "right";
    Overflow.positionContainer = function(el, relativeTo, inside, shiftFull, align, vPos) {
        align = align || Overflow.defaultAlignment;
        var rect = relativeTo.getBoundingClientRect();
        var offset = rect.height;
        var y = rect.bottom;

        el.style.height = 'initial';
        el.style.overflow = 'auto';

        var h = $(el).height() + 20; //I cant tell how jquery does it
        var maxH = inside.clientHeight;

        var top;
        var canBeAbove = y - offset > h + 10;
        var canBeBelow = maxH - y > h + 15;
        if (vPos == "below" || (vPos != "above" && (maxH - y) > (y - offset))) {
            if (canBeBelow) {
                top = y + 5;
            } else if (maxH - y > 250) {
                h = maxH - y - 25;
                $(el).css('height', h);
                top = y + 5;
            } else if (canBeAbove) {
                top = y - h - offset - 10;
            } else {
                if (h > maxH - 10) {
                    h = maxH - 20;
                    $(el).css('height', h);
                    top = 10;
                } else top = maxH - h - 10;
            }
        } else if (canBeAbove) {
            top = y - h - offset - 10;
        } else if (canBeBelow) {
            top = y + 5;
        } else {
            if (h > maxH - 10) {
                h = maxH - 20;
                $(el).css('height', h);
                top = 10;
            } else top = maxH - h - 10;
        }
        if (top*1.5 > maxH) {
            el.style.bottom = maxH - top - h + "px";
            el.style.top = "auto";
        } else {
            el.style.top = top + "px";
            el.style.bottom = "auto";
        }
        var maxW = inside.clientWidth;
        var w = $(el).width();

        if (shiftFull) {
            if ((rect.right > (w / 2 + 10)) && (maxW - rect.right > (w / 2 + 10))) {
                el.style.right = maxW - rect.right - w / 2 + "px";
                el.style.left = "auto";
                return;
            } else {
                //a way to do shiftFull
                //1 fade other element
                //2 border
            }
        }
        if (align == "right" || (align == "mobile" && window.innerWidth > 400)) {
            el.style.right = maxW - Math.max(w + 10, rect.right - 10) + "px";
            el.style.left = "auto";
        } else if (align == "left") {
            el.style.left = Math.min(rect.left + 10, maxW - w - 10) + "px";
            el.style.right = "auto";
        } else {
            var space = align == "full" ? 20 : align == "mobile" ? Math.min(20, (maxW - w) / 2) : (maxW - w) / 2;
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
        var dropdown = new Overflow(false, "mobile");
        dropdown.setHierarchy(items);
        dropdown.show(select);
        dropdown.onclick = function(ev, id, element, item) {
            select.value = item.value;
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
        sortIndex: 100,
    };
    var menu = global.MainMenu = new global.Overflow(true);
    menu.setHierarchy(menuItems);
    menu.addOption = function(optionId, option, others) {
        if (menuItems[optionId]) {
            menuItems[optionId] = option;
        } else if (otherItems[optionId]) {
            otherItems[optionId] = option;
        } else {
            var hier = menuItems;
            if (others === undefined) others = Object.keys(menuItems).length > 6;
            if (others) {
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
            Object.assign(menuItems[optionId].childHier, option);
            menu.addOption(optionId, menuItems[optionId]);
        } else if (otherItems[optionId] && otherItems[optionId].childHier) {
            Object.assign(otherItems[optionId].childHier, option);
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