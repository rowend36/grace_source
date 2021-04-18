_Define(function(global) {
    function memo(func) {
        var res;
        return function() {
            if (res !== undefined) {
                return res;
            }
            return func.apply(this, arguments);
        };
    }
    function cachedItem(filename,item){
        var oldOid = item.oid;
        item.oid = function(){
            fs.
        }
    }
});