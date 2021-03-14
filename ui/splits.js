_Define(function(global) {
    var Utils = global.Utils;
    var events = global.AppEvents;
    function resizeHandler(element) {
        return function() {
            var editors = element.find(".editor");
            for (var i=0;i<editors.length;i++) {
                editors[i].env && editors[i].env.onResize();
            }
        };
    }
    function createSplit(parent,children,direction,sizes,gutterSize){
      var handler = resizeHandler(parent);
      parent.data("splitter", Split(children, {
            // sizes: [75],
            minSize: 25,
            direction: direction,
            sizes:sizes,
            gutterSize: gutterSize || 20,
            onDragEnd: handler
        }));
        handler();
    }
    var splits = global.viewRoot;

    function addSplit(container, direction,gutterSize) {
        var child = container;
        var parent = child.parent();
        if (parent.parent().hasClass('multieditor') &&
            parent.parent().data('splitter').pairs[0].direction == direction) {
            parent = parent.parent();
            parent.data('splitter').destroy();
        }
        else {
            parent.addClass('multieditor');
            child.wrap('<div class="pane"></div>');
        }
        var child2 = parent.append("<div class='pane'></div>").children().last();
        var children = parent.children().toArray();
        createSplit(parent,children,direction,null,gutterSize);
        return child2[0];
    }
    events.on("view-change",function(){
        resizeHandler($(global.viewRoot))();
    });

    function isSplit(child) {
        var parent = child.parent().parent();
        if (!parent.hasClass("multieditor")) {
            return false;
        }
        return true;
    }
    function getSplitDirection(child){
        var parent = (child[0]?child:$(child)).parent().parent();
        if (!parent.hasClass("multieditor")) {
            return false;
        }
        return parent.data('splitter').pairs[0].direction;
    }
    function removeSplit(child) {
        if (!isSplit(child)) return false;
        //each child is wrapped by a pane
        var pane = child.parent();
        var parent = pane.parent();
        var split = parent.data('splitter');
        var direction = split.pairs[0].direction;
        var gutterSize = parseInt(split.pairs[0].gutter.style.width);
        split.destroy();
        pane.remove();
        var remaining = parent.children();
        if (remaining.length > 1) {
            //recreate splitter
            var children = remaining.toArray();
            createSplit(parent,children,direction,null,gutterSize);
        }
        else if (!remaining.hasClass("multieditor")) {
            //not a split, remove redundant pane
            remaining.children().unwrap();
            remaining.detach();
        }
        else {
            //destroy split before removing pane
            var childSplit = remaining.data('splitter');
            var sizes = childSplit.getSizes();
            direction = childSplit.pairs[0].direction;
            gutterSize = parseInt(childSplit.pairs[0].gutter.style.width);
            childSplit.destroy();
            remaining.children().unwrap();
            remaining.detach();
            //create the split back but attaching directly to parent
            createSplit(parent,parent.children().toArray(),direction,sizes);
        }
        resizeHandler(parent)();
        return true;
    }
    global.SplitManager = {
        add: addSplit,
        hasSplit: getSplitDirection,
        remove: removeSplit
    };
});/*_EndDefine*/