define(function (require, exports, module) {
    'use strict';
    var map = new Map();
   require('grace/setup/setup_console')
    exports.verify = function (instance, type) {
        setTimeout(function () {
            var _class = Object.getOwnPropertyNames(instance).join('%');
            if (map.has(type)) {
                if (map.get(type).indexOf(_class) < 0) {
                    map.get(type).push(_class);
                    var slice = common(_class, map.get(type)[0]);
                    console.warn(
                        'New Class for',
                        type,
                        '.',
                        slice(_class),
                        'instead of',
                        slice(map.get(type)[0])
                    );
                }
            } else map.set(type, [_class]);
            console.log(Array.from(map.entries()));
        }, 50);
    };
    function common(a, b) {
        var i = 0,
            j = 1,
            m = Math.min(a.length, b.length);
        while (a[i] === b[i] && i < m) i++;
        m -= i;
        while (a[a.length - j] === b[b.length - j] && j <= m) j++;
        return function (str) {
            if (i > 0) str = '...' + str.slice(i);
            if (j > 1) str = str.slice(0, 1 - j) + '...';
            return str;
        };
    }
});