_Define(function(global) {
    var wordAfterRe = /^[\$_\w]+/;
    var Docs = global.Docs;

    function nextIdent(text, a) {
        return wordAfterRe.exec(text.substring(a, a + 50));
    }
    var wordBeforeRe = /[\$_\w]+$/;

    function prevIdent(text, a) {
        return wordBeforeRe.exec(text.substring(Math.max(0, a - 50), a));
    }
    //further work, use type and shit, but that's for another person
    function createProps(name, session, timeout) {
        var props = getProps(name, session, ".", 5, timeout);
        var prop2 = getProps(name, session, "->", 5, timeout);
        for (var i in prop2) {
            props[i] = props[i] ? props[i] + prop2[i] : prop2[i];
        }
        return props;
    }

    function getAllProps(name, path, session, paths, timeout) {
        timeout = timeout || new Date().getTime() + 1000;
        var tags = global.TagCompleter;
        var cache = tags.propCache[path];
        var res = {};
        if (path) {
            cache = cache || (tags.propCache[path] = {});
            if (!cache[name]) {
                cache[name] = createProps(name, session, timeout);
            }
            Object.assign(res, cache[name]);
        }
        var toCheck = [];

        function add(otherFileTags) {
            for (var i in otherFileTags) {
                res[i] = (res[i] || 0) + otherFileTags[i] / 20;
            }
        }
        paths.forEach(function(e) {
            if (e == path) return;
            if (tags.propCache[e]) {
                if (tags.propCache[e][name]) {
                    add(tags.propCache[e][name]);
                } else toCheck.push(e);
            } else {
                tags.propCache[e] = {};
                toCheck.push(e);
            }
        });
        var delta, file;
        while ((delta = (timeout - new Date().getTime())) > 0) {
            file = toCheck.pop();
            if (!file) return res;
            var doc = Docs.forPath(file);
            if (doc) {
                var props = createProps(name, doc.session, timeout);
                tags.propCache[file][name] = props;
                add(props);
            }
        }
        if (delta < 0) tags.propCache[file] = null;
        return res;
    }

    function getProps(name, session, dot, score, timeout) {
        var props = {};
        var parents = [name];
        var i = 0;

        var tex = new Counter(session),
            inner = new Counter(session);
        var start = 0;
        score = isNaN(score) ? 5 : score;
        while (i < parents.length) {
            var val = score * score;
            name = parents[i];
            var x = name.length + dot.length;
            var a = tex.indexOf(name + dot);
            while (a > -1 && score) {
                a += x;
                var child = nextIdent(tex.line, a);
                if (child) {

                    child = child[0];
                    if (props[child]) {
                        if (i == 0) props[child] += 25;
                        else props[child]++;
                    } else {

                        props[child] = val;
                        inner.reset();
                        var b = inner.indexOf(dot + child);
                        while (b > -1) {
                            var similar = prevIdent(inner.line, b);
                            if (similar) {
                                similar = similar[0];
                                if (parents.indexOf(similar) < 0) {

                                    parents.push(similar);
                                }
                            }
                            b = inner.indexOf(dot + child, b + 1);
                        }
                    }
                    a += child.length;
                }
                a = tex.indexOf(name + dot, a + 1);
            }
            if (i == start) {
                score -= 1;
                start = parents.length - 1;
            }
            i++;
            if (timeout < new Date().getTime()) break;
        }
        return props;
    }
    var Counter = function(session) {
        session && (this.session = session);
        this.line = this.session.getLine(0);
        this.c = 1;
        this.last = this.session.getLength();
    };
    Counter.prototype.reset = Counter;
    Counter.prototype.indexOf = function(ch, start) {
        do {
            var index = this.line.indexOf(ch, start);
            if (index > -1 || this.c == this.last) return index;
            this.line = this.session.getLine(this.c++);
            start = 0;
        } while (true);
    };
    global.inferProps = getAllProps;
});