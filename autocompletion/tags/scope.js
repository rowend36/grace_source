_Define(function(global) {
    var noop = global.Utils.noop;

    //iterate through a sorted list of items assigning scope
    function scopeIterator(scopes) {
        var rootScopes = [];
        for (var i = scopes.length - 1; i >= 0; i--) {
            if (scopes[i].parent) break;
            rootScopes.push(scopes[i]);
        }
        var lastScope = rootScopes[0];
        if (!lastScope) return {
            find: noop,
            findNext: noop
        };
        var root = {
            children: rootScopes
        };
        // scopes = null;
        //contextual search
        var findScope = function(loc, scope, index, dx, fromChild) {
            var list = scope.children;
            if (list)
                for (var i = index; i < list.length; i += dx) {
                    if (list[i].end < loc) {
                        continue;
                    }
                    if (list[i].start > loc) {
                        break;
                    }
                    //last correct scope
                    if (
                        list[i] === fromChild ||
                        !findScope(loc, list[i], 0, 1, false)
                    ) {
                        //go down
                        lastScope = list[i];
                    }
                    //if from call, already set otherwise parent wil
                    //set
                    return true;
                }
            if (fromChild) {
                //go up
                if (scope.parent)
                    return findScope(loc, scope.parent, 0, 1, scope);
                if (scope !== root) {
                    return findScope(loc, root, 0, 1, scope);
                }
            }
            //last wrong scope
            lastScope = scope;
        };
        return {
            find: function(item) {
                var loc = item.loc || item.locEnd || 0;
                //check if in last scope
                if (findScope(loc, lastScope, 0, 1, false)){
                    global.Utils.assert(lastScope);
                    return lastScope;
                }
                return false;
            },
            findNext: function(item) {
                //only call after finding scope
                var loc = item.loc || item.locEnd || 0;
                var list = item.scope ? item.scope.children : rootScopes;
                if (!list) return;
                for (var i = 0; i < list.length; i++) {
                    if (list[i].start > loc) {
                        return list[i];
                    }
                }

            }
        };
    }

    //returns output line by line
    var TextStream = function(text) {
        this.res = text;
        this.index = 0;
        var pos = [];
        var t = /\n|\r\n|\r/g;
        var m;
        while ((m = t.exec(text))) {
            pos.push(m.index + m[0].length);
        }
        this.pos = pos;
    };
    TextStream.prototype.indexToPosition = function(i) {
        var t = 0;
        while (t < this.pos.length && i > this.pos[t + 1]) {
            t++;
        }
        return {
            row: t,
            column: i - this.pos[t]
        };
    };
    TextStream.prototype.next = function() {
        if (this.res) {
            this.current = this.res;
            this.res = null;
        } else {
            if (this.current)
                this.index += this.current.length;
            this.current = null;
        }
        return this.current;
    };
    TextStream.prototype.getCurrentIndex = function() {
        return this.index;
    };

    var DocStream = function(doc) {
        this.res = doc.session.getDocument();
        this.lineEnding = this.res.getNewLineCharacter();
        this.lineIndex = this.index = 0;
        this.current = "";
        this.index = 0;
    };
    DocStream.prototype.next = function() {
        if (this.lineIndex == this.res.getLength()) return (this.current = null);
        this.index += this.current.length;
        this.current = this.res.getLine(this.lineIndex++) + this.lineEnding;
        return this.current;
    };
    DocStream.prototype.getCurrentIndex = function() {
        return this.index;
    };
    DocStream.prototype.indexToPosition = function(i) {
        return this.res.indexToPosition(i);
    };

    var LineStream = function(stream, regex) {
        this.stream = stream;
        this.buf = "";
        this.regex = regex || /\r\n|\n|\r/g;
    };
    LineStream.prototype.next = function() {
        if (!this.buf) {
            this.buf = this.stream.next();
            this.index = 0;
        } else this.index += this.current.length;
        if (this.buf === null) return (this.current = this.buf = null);
        var lineEnd = this.regex;
        lineEnd.lastIndex = 0;
        var next = lineEnd.exec(this.buf);
        while (!next && this.stream.current) {
            this.buf += (this.stream.next() || "");
            //can \r\n be split into two
            next = lineEnd.exec(this.buf);
        }
        var index = next ? lineEnd.lastIndex : this.buf.length;
        this.current = this.buf.substring(0, index);
        this.buf = this.buf.substring(index);
        return this.current;
    };
    LineStream.prototype.getCurrentIndex = function() {
        return this.index + this.stream.getCurrentIndex();
    };
    //base class for streams that filter out blocks of text
    var BlockFilter = function(start, stream) {
        this.start = new RegExp(start, 'g');
        this.stream = stream;
        this.buf = "";
        this.index = 0;
    };
    BlockFilter.prototype.next = function() {
        if (!this.buf) {
            this.buf = this.stream.next();
            this.index = 0;
        } else this.index += (this.current.length + this.filteredLength);
        this.isPending = !!this.buf;
        this.filteredLength = 0;
        if (this.buf === null) return (this.current = this.buf = null);
        this.start.lastIndex = 0;
        var blockStart = this.start.exec(this.buf);
        if (blockStart) {
            this.current = this.buf.substring(0, blockStart.index);
            var end, start = blockStart[0].length + blockStart.index;
            var filtered = "";
            //shows if the search has spanned more than one block
            var finish = true;
            do {
                end = this.findEnding(blockStart, start);
                if (end < 0) {
                    filtered += this.buf;
                    if (finish) {
                        start = 0;
                        finish = false;
                    }
                    this.buf = this.stream.next();
                } else {
                    filtered += this.buf.substring(blockStart.index, end);
                    this.buf = this.buf.substring(end);
                    break;
                }
            }
            while (this.buf);
            this.isPending = finish && !!this.buf;
            this.filteredLength = filtered.length;
            return this.current;
        }
        this.current = this.buf;
        this.buf = "";
        this.isPending = false;
        return this.current;
    };
    BlockFilter.prototype.getCurrentIndex = function() {
        return this.stream.getCurrentIndex() + this.index;
    };
    //special block filter for when blocks end at newline
    var LineFilter = function(start, stream) {
        LineFilter.super(this, [start, stream]);
        this.end = new RegExp("\\r\\n|\\r|\\n", 'g');
    };
    LineFilter.prototype.findEnding = function(blockStart, start) {
        this.end.lastIndex = start;
        var blockEnd = this.end.exec(this.buf);
        return (blockEnd ? blockEnd.index + blockEnd[0].length : -1);
    };
    var RegionFilter = function(starts, stream) {
        var start = [];
        for (var i in starts) {
            start.push("(" + starts[i].open + ")");
        }
        this.starts = starts;
        RegionFilter.super(this, [start.join("|"), stream]);
    };
    RegionFilter.prototype.findEnding = function(start, from) {
        for (var k = 0; k < this.starts.length; k++) {
            if (start[k + 1]) {
                var end = this.starts[k];
                var close = end.close || start[0];
                var escaped = false;
                var hasEscape = end.hasEscapes;
                for (var i = from; i < this.buf.length; i++) {
                    var char = this.buf[i];
                    if (escaped) escaped = false;
                    else if (hasEscape && char == "\\") escaped = true;
                    else if (char == close[0] && (close.length == 1 || this.buf
                            .substring(i, i + close.length) == close)) break;
                    else if (end.breaksOnNewLine && char == '\n') break;
                }
                if (i == this.buf.length) {
                    return -1;
                }
                return i + close.length;
            }
        }
        return -1;
    };
    global.Utils.inherits(LineFilter, BlockFilter);
    global.Utils.inherits(RegionFilter, BlockFilter);
    var pyScopeFinder = function(rawStream) {
        var multiLine;
        var stream =
            new LineFilter("\\#",
                (multiLine = new RegionFilter([{
                    open: "\\\"",
                    hasEscapes: true,
                    breaksOnNewLine: true
                }, {
                    open: "\\'",
                    hasEscapes: true,
                    breaksOnNewLine: true
                }, {
                    open: "\\`",
                    hasEscapes: true,
                    breaksOnNewLine: true
                }, {
                    open: "\"\"\"",
                    hasEscapes: true,
                }, {
                    open: "'''",
                    hasEscapes: true,
                }], new LineStream(rawStream))));
        var scopes = [],
            scope;
        // var colon = ":";
        var indent = /^[ \t]+\S/g;
        var rootIndent = 0;
        var lastIndent = rootIndent;
        while (stream.next() != null) {
            var current = stream.current;
            var index = stream.getCurrentIndex();
            while (stream.current != null && multiLine.isPending) {
                current += (stream.next() || "");
            }
            indent.lastIndex = 0;
            var found = indent.exec(current),
                newIndent;
            if (found) {
                newIndent = found[0].length - 1;
            } else continue;
            if (newIndent > lastIndent) {
                var newscope = {
                    indent: newIndent,
                    start: index,
                    pos: rawStream.indexToPosition(index),
                    parent: scope
                };
                if (scope) {
                    if (scope.children) scope.children.push(newscope);
                    else scope.children = [newscope];
                }
                lastIndent = newIndent;
                scope = newscope;
            } else
                while (newIndent < lastIndent) {
                    scope.end = index - 1;
                    scopes.push(scope);
                    scope = scope.parent;
                    if (scope)
                        lastIndent = scope.indent;
                    else lastIndent = 0;
                }
        }
        while (scope) {
            scope.end = stream.getCurrentIndex();
            scopes.push(scope);
            scope = scope.parent;
        }
        return scopes;
    };
    var cScopeFinder = function(stream) {
        stream = new LineFilter("\\/\\/",
            new RegionFilter([{
                open: "\\\"",
                hasEscapes: true,
                breaksOnNewLine: true
            }, {
                open: "\\'",
                hasEscapes: true,
                breaksOnNewLine: true
            }, {
                open: "\\`",
                hasEscapes: true,
                breaksOnNewLine: true
            }, {
                open: "\\/\\*",
                close: "*/"
            }, {
                name: 'regex',
                open: "(?<=(?:[^\w]|^) *)\\/",
                close: "/",
                hasEscapes: true
            }], stream));
        var scopes = [],
            scope,
            depth = 0;
        var tag = /(\{)|(\})/g;
        while (stream.next() != null) {
            var current = stream.current;
            var index = stream.getCurrentIndex();
            tag.lastIndex = 0;
            var found = tag.exec(current);
            while (found) {
                if (found[1]) {
                    var newscope = {
                        start: index + found.index,
                        depth: depth++,
                        parent: scope
                    };
                    if (scope) {
                        if (scope.children) scope.children.push(newscope);
                        else scope.children = [newscope];
                    }
                    scope = newscope;
                } else if (scope) {
                    depth--;
                    scope.end = index + found.index + 1;
                    scopes.push(scope);
                    scope = scope.parent;
                } else {
                    //scopes[scopes.length-1].end = found.index+found[0].length;
                }
                found = tag.exec(current);
            }
        }
        while (scope) {
            scope.end = stream.getCurrentIndex();
            scopes.push(scope);
            scope = scope.parent;
        }
        return scopes;
    };
    global.ScopeSolvers = {
        'javascript': cScopeFinder,
        'jsx': cScopeFinder,
        'typescript': cScopeFinder,
        'php': cScopeFinder,
        'java': cScopeFinder,
        'python': pyScopeFinder,
        'c_cpp': cScopeFinder
    };
    global.scopeIterator = scopeIterator;
    global.DocStream = DocStream;
    global.TextStream = TextStream;
}); /*_EndDefine*/
