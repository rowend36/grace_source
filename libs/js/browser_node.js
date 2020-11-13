// modules are defined as an array
// [ module function, map of requireuires ]
//
// map of requireuires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the requireuire for previous bundles

var run = (function(directory, file, fs) {
    var require = function(path) {
        var name = resolve(path);
        if (!name) {
            var err = new Error('Cannot find module \'' + name + '\'');
            err.code = 'MODULE_NOT_FOUND';
            throw err;
        }
        if (!cache[name]) {
            var m = cache[name] = { exports: {} };
            var func = createModuleWrapper(fs.readFileSync('name'));
            func.call(m.exports,run(directory,name,fs), m, m.exports);
            //,outer, modules, cache, entry);
        }
        return cache[name].exports;
    }
    // Override the current require with this new one
    return require;
})