_Define(function(global) {
    var Imports = global.Imports;
    var Utils = global.Utils;
    var EventsEmitter = global.EventsEmitter;

    function View(el, deps) {
        this.el = el;
        this.deps = deps;
        this.loading = null;
    }
    Utils.inherits(View, EventsEmitter);
    (function() {
        this.preload = function(cb) {
            if (this.deps) {
                if (this.loading) {
                    this.once('preload', cb);
                } else {
                    this.loading = new Imports(function() {
                        this.deps = null;
                        this.loading = null;
                        this.triggerForever('preload');
                    });
                    this.loading.add.apply(this.loading, this.deps);
                    this.once('preload',cb);
                    this.loading.next();
                }
            }
            else if(!this.loaded){
                this.load();
                cb();
            }
        };
        this.load = Utils.noop;
        this.unload = Utils.noop;
        this.$notifyAttached = function() {
            this.trigger('attach');
        };
        this.$notifyDetached = function() {
            this.trigger('detach');
        };
        this.destroy = Utils.noop;
    }).call(View.prototype);
    global.View = View;
}); /*_EndDefine*/

_Define(function(global){
   function EditorView(editor){
       this.editor = editor;
       EditorView.super(this,[editor.container]);
   }
   EditorView,prototype.load = function(){
       this.editor.renderer.unfreeze();
   };
   EditorView.prototype.unload = function(){
       this.editor.renderer.freeze();
   };
});
