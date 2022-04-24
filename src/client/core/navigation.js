define(function(require,exports,module) {
    //runtime class
    var Utils = require("./utils").Utils;
    var nav = {
        addRoot: Utils.noop,
        removeRoot: Utils.noop,
        pop: Utils.noop,
        attach: function(){
            require(["./ext/navigation/enhanced_navigation"]);
        },
        detach: Utils.noop
    };
    exports.Navigation = nav;
}); /*_EndDefine*/