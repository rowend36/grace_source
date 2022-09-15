define(function(require, exports, module) {
    var Split = require("../libs/js/splits.min.js");
    var events = require("../core/app_events").AppEvents;
    var rootView = require("../setup/setup_root").rootView;

    function resizeHandler(element) {
        return function() {
            var editors = element.find(".editor");
            for (var i = 0; i < editors.length; i++) {
                editors[i].env && editors[i].env.onResize();
            }
        };
    }

    events.on("layoutChanged", function() {
        resizeHandler(rootView.$el)();
    });

    var splitters = new WeakMap();

    function createSplit(parent, children, direction, sizes,
    gutterSize) {
        gutterSize = parseInt(gutterSize) || 20;
        var handler = resizeHandler(parent);
        var minSize = (children.length - 1) * (gutterSize + 35);
        var dimen = direction == "vertical" ? "Height" : "Width";
        children.forEach(function(e) {
            //simple trick to stop splits from getting hidden completely
            e.style["max" + dimen] = "calc(100% - " + minSize +
                "px)";
            e.style["min" + dimen] = "35px";
        });
        splitters.set(parent[0], Split(children, {
            // sizes: [75],
            minSize: 35,
            direction: direction,
            sizes: sizes,
            gutterSize: gutterSize,
            onDragEnd: handler,
        }));
        handler();
    }

    function addSplit(container, direction, gutterSize) {
        var child = container;
        var parent = child.parent();
        if (parent.parent().hasClass('multieditor') &&
            splitters.get(parent.parent()[0]).pairs[0].direction ==
            direction) {
            parent = parent.parent();
            splitters.get(parent[0]).destroy();

        } else {
            parent.addClass('multieditor');
            child.wrap('<div class="pane"></div>');
        }
        var child2 = parent.append("<div class='pane'></div>")
        .children().last();
        var children = parent.children('.pane').toArray();
        createSplit(parent, children, direction, null, gutterSize);
        return child2[0];
    }

    function isSplit(child) {
        var parent = child.parent().parent();
        if (!parent.hasClass("multieditor")) {
            return false;
        }
        return true;
    }

    function getSplitDirection(child) {
        var parent = (child[0] ? child : $(child)).parent().parent();
        if (!parent.hasClass("multieditor")) {
            return false;
        }
        return splitters.get(parent[0]).pairs[0].direction;
    }

    function removeSplit(child) {
        if (!isSplit(child)) return false;
        //each child is wrapped by a pane
        //Warning: removes all siblings also
        var pane = child.parent();
        var parent = pane.parent();
        var split = splitters.get(parent[0]);
        var direction = split.pairs[0].direction;
        var gutterSize = parseInt(split.pairs[0].gutter.style.width);
        split.destroy();
        pane.remove();
        var remainingPanes = parent.children('.pane');
        if (remainingPanes.length > 1) {
            //recreate splitter if there are still other panes
            var children = remainingPanes.toArray();
            createSplit(parent, children, direction, null, gutterSize);
        } else if (!remainingPanes.hasClass("multieditor")) {
            //The remaining pane is not a split, move the children to parent node
            //demote parent from multieditor to pane
            remainingPanes.children().unwrap();
            remainingPanes.remove();
            parent.removeClass('multieditor');
            splitters.set(parent[0], null);
        } else {
            //The remaining pane is a split, do the same as above ie remove the pane
            //but recreate the splitter in the parent
            var childSplit = splitters.get(remainingPanes[0]);
            var sizes = childSplit.getSizes();
            direction = childSplit.pairs[0].direction;
            gutterSize = parseInt(childSplit.pairs[0].gutter.style
                .width);
            childSplit.destroy();
            remainingPanes.children().unwrap();
            remainingPanes.remove();
            createSplit(parent, parent.children(".pane").toArray(),
                direction, sizes);
        }
        resizeHandler(parent)();
        return true;
    }
    exports.SplitManager = {
        add: addSplit,
        hasSplit: getSplitDirection,
        remove: removeSplit
    };
}); /*_EndDefine*/