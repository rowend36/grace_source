_Define(function(global) {
    function LinearLayout(root,size, orientation,config) {
        this.orientation = orientation;
        this.size = size;
        this.options = config;
        this.$el = root;
        this.views = [];
    }
    LinearLayout.VERTICAL = 1;
    LinearLayout.HORIZONTAL = 2;
    LinearLayout.prototype.render = function(){
        var edge1 = this.orientation==LinearLayout.VERTICAL?'top':'left';
        var edge2 = this.orientation==LinearLayout.VERTICAL?'bottom':'right';
        var size = this.orientation==LinearLayout.VERTICAL?'height':'width';
        var totalSize = 0,totalWeight=0;
        this.size = parseInt(this.$el.css(size));
        var view;
        for(var i in this.views){
            view = this.views[i];
            if(view.hidden)
                continue;
            totalSize+=view['layout_'+size];
            totalWeight+=view.weight||0;
        }
        if(this.size<totalSize)this.size = totalSize;
        var remSize = this.size-totalSize;
        var weight = remSize/(totalWeight||1);
        var lastPos=0;
        for(i in this.views){
            view = this.views[i];
            if(view.hidden)
                continue;
            view[size] = view['layout_'+size]+(view.weight||0)*weight;
            var nextPos = lastPos+view[size];
            if(view.weight){
                view.$el.css(edge1,lastPos);
                view.$el.css(edge2,this.size-nextPos);
                view.$el.css(size,'auto');
            }
            else if(lastPos<this.size/2){
                view.$el.css(edge1,lastPos);
                view.$el.css(size,view[size]);
                view.$el.css(edge2,'auto');
            }
            else{
                view.$el.css(edge2,this.size-nextPos);
                view.$el.css(size,view[size]);
                view.$el.css(edge1,'auto');
            }
            lastPos=nextPos;
        }
        this.onRender();
    };
    LinearLayout.prototype.addChild = function(el,size,weight,index){
        var size_ = this.orientation==LinearLayout.VERTICAL?'height':'width';
        var view = Object.create(ViewProps);
        view.$el = el;
        view.parent = this;
        if(size)
            view['layout_'+size_]=size;
        else view.computeSize(size_);
        view.weight = weight;
        if(!isNaN(index)){
            this.views.splice(index,0,view);
        }
        else this.views.push(view);
        return view;
    };
    LinearLayout.prototype.onRender = function(){};
    var ViewProps = {
        computeSize: function(size){
            var layout_size = this.$el.children()[size]();
            this['layout_'+size] = layout_size;
        },
        hide: function(){
            this.hidden = true;
            this.$el.fadeOut('fast');
            this.parent.render();
        },
        show: function(){
            this.hidden = false;
            this.$el.fadeIn();
            this.parent.render();
        },
        toggle: function(){
            if(this.hidden)this.show();
            else this.hide();
        }
    };
    global.LinearLayout = LinearLayout;
})/*_EndDefine*/