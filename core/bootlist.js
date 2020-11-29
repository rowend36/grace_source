(function(global) {

    function loadScript(script, cb) {
        var scr = document.createElement('script');
        scr.src = script;
        scr.onload = function() {
            cb();
        };
        document.body.appendChild(scr);
    }

    function loadStyle(style, cb) {
        var styleEl = document.createElement('link');
        styleEl.href = style;
        styleEl.setAttribute("rel", "stylesheet");
        styleEl.onload = function() {
            cb();
        };
        document.body.appendChild(styleEl);
    }
    //Everything in bootlist
    //needs to be run after boot
    //either because they need getEditor
    //or they are simply tasking
    //Todo spread to other files

    function BootList(onload,delay) {
        this.onLoad = onload;
        this.delay = delay || 30;
        this.next = this.next.bind(this);
    }
    BootList.prototype = [];
    BootList.prototype.next = function() {
        if (this.length < 1) {
            return this.onLoad();
        }
        if(!this.started){
            this.started = true;
        }
        var nextItem = this.shift();
        if(nextItem.id){
            this[nextItem.id]=true;
        }
        if (nextItem.ignoreIf)
            return this.next();
        if (nextItem.name) {
            console.debug(nextItem.name);
        }
        if (nextItem.func)
            setTimeout(function() {
                try {
                    nextItem.func();
                }
                catch (e) {
                    try {
                        console.error(e);
                        nextItem.error && nextItem.error(e);
                    }
                    catch (i) {
                        console.error(i);
                    }
                }
                this.next();
            }.bind(this), this.delay);
        else if (nextItem.script) {
            loadScript(nextItem.script, this.next);
        }
        else if (nextItem.style) {
            loadStyle(nextItem.style, this.next);
        }
    };
    global.BootList = BootList;

})(Modules);