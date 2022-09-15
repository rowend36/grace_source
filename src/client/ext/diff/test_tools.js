//Testing tools
//python assert
var debug = console;
function test(cond, result) {
    if (!cond) throw new Error(result);
}

function noop() {}

function time(func, name) {
    return function () {
        debug.log(name);
        debug.time(name);
        var res = func.apply(this, arguments);
        debug.timeEnd(name);
        return res;
    };
}
//python-like @decorate
function decorate(func, after) {
    return function () {
        var result = func.apply(this, arguments);
        var error = after.apply(this, spread(arguments, result));
        return error !== undefined ? error : result;
    };
}

//used to check if elements in an array are unique
function uniq(arr, map) {
    for (var i = 0; i < arr.length; i++) {
        for (var j = i + 1; j < arr.length; j++) {
            if (map(arr[i]) == map(arr[j])) return false;
        }
    }
    return true;
}

//python func(*a,b)
function spread(args, arg) {
    var arg2 = [];
    arg2.push.apply(arg2, args);
    arg2.push(arg);
    return arg2;
}