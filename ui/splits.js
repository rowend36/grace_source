(function(global) {
    var Utils = global.Utils;
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
      Utils.inspect(arguments);
      parent.data("splitter", Split(children, {
            // sizes: [75],
            minSize: 25,
            direction: direction,
            sizes:sizes,
            gutterSize: gutterSize || 20,
            onDragEnd: handler
        }))
        handler();
    }
    function addSplit(container, direction,gutterSize) {
        var child = container;
        var parent = child.parent()
        if (parent.parent().hasClass('multieditor') &&
            parent.parent().data('splitter').pairs[0].direction == direction) {
            parent = parent.parent()
            parent.data('splitter').destroy()
        }
        else {
            parent.addClass('multieditor')
            child.wrap('<div class="pane"></div>')
        }
        var child2 = parent.append("<div class='pane'></div>").children().last()
        var children = parent.children().toArray()
        createSplit(parent,children,direction,null,gutterSize);
        return child2[0];
    }
    $("#viewroot").on('click', '.editor', function() {
        //editor = this.env.editor;
    })

    function isSplit(child) {
        var parent = child.parent().parent()
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
        var parent = child.parent().parent();
        child.parent().detach();
        var split = parent.data('splitter');
        var direction = split.pairs[0].direction;
        var gutterSize = parseInt(split.pairs[0].gutter.style.width);
        split.destroy();
        var pop = parent.children();
        if (pop.length > 1) {
            //recreate splitter
            var children = pop.toArray();
            createSplit(parent,children,direction,null,gutterSize);
        }
        else if (!pop.hasClass("multieditor")) {
            //remove empty multieditor
            pop.children().unwrap();
            pop.detach();
        }
        else {
            //recreate child splitter
            split = pop.data('splitter');
            var sizes = split.getSizes()
            direction = split.pairs[0].direction;
            gutterSize = parseInt(split.pairs[0].gutter.style.width);
            split.destroy()
            pop.children().unwrap()
            pop.detach()
            createSplit(parent,parent.children.toArray(),direction,sizes);
        }
        return true;
    }
    global.SplitManager = {
        notifyResize: function(el){
            resizeHandler(el)();
        },
        add: addSplit,
        hasSplit: getSplitDirection,
        remove: removeSplit
    }
})(Modules)