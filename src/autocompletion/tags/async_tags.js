_Define(function(global) {
    var Utils = global.Utils;
    var unimplemented = global.unimplemented;
    var profile;
    // profile = console.debug;

    function AsyncTags() {
        this.findAll = this.findAll.bind(this);
    }
    AsyncTags.prototype.onStart = Utils.noop;
    AsyncTags.prototype.onBatch = unimplemented;
    AsyncTags.prototype.findAll = function(stream, filename, allowText, cb) {
        var ctx = {
            res: stream,
            pos: 0,
            file: filename,
            allowText: allowText,
            cb: cb,
            name: 'Tags',
            found: [],
            endT: new Date().getTime() + 500,
            numPhases: 0,
            startT: new Date().getTime()
        };
        this.onStart(ctx);
        var self = this;
        return (function run() {
            ctx.numPhases++;
            do {
                var num, t;
                if (profile) {
                    num = ctx.found.length,
                        t = Date.now();
                }
                self.onBatch(ctx);
                if (profile) {
                    num = ctx.found.length - num;
                    t = Date.now() - t;
                    if (t > 100)
                        profile({
                            "file": ctx.file,
                            "pos": ctx.pos,
                            "matches": num,
                            "name": ctx.name,
                            "time": t,
                            "matches/ms": num / t + '/ms',
                            "Adjusted matches/ms": num / t / Math.log(stream
                                .length) + '/ms',
                            "percent": ctx.pos / stream.length * 100 +
                                "%"
                        });
                }
                if (new Date().getTime() > ctx.endT) {
                    if (!ctx.cb) return self.onFinish(ctx);
                    if (ctx.done) return self.onFinish(ctx);
                    ctx.endT += 1500;
                    setTimeout(run, 100);
                    return ctx;
                }
                if (ctx.done) {
                    return self.onFinish(ctx);
                }
            } while (true);
        })();
    };
    AsyncTags.prototype.onFinish = function(ctx) {
        if (profile) profile({
            "total": ctx.found.length,
            "phases": ctx.numPhases,
            "time": new Date().getTime() - ctx.startT
        });
        var found = ctx.found;
        if (found.length < 5000 && ctx.allowText !== false) {
            //supplement
            found.push.apply(found, global.TagFinders.text(ctx.res)
                .slice(0, 5000 - found.length));
        }
        ctx.cb && ctx.cb(found);
        return found;
    };
    global.AsyncTags = AsyncTags;
});