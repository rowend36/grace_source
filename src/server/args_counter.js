module.exports = function ArgsCounter(icount, callback) {
    var args = {};
    args.length = icount;
    var count = icount;
    this.push = function(index, value) {
        args[index] = value;
        if (--count === 0) {
            count = icount;
            callback.apply(this, args);
        }
    };
    this.end = function() {
        if (count < icount && count > 0) {
            count = 0;
            callback.apply(this, args);
        }
    };
};