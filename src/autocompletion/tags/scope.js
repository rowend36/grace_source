_Define(function(global) {
    var noop = global.Utils.noop;

    //iterate through a sorted list of items assigning scope
    function scopeIterator(scopes) {
        var rootScopes = [];
        for (var i = 0; i < scopes.length; i++) {
            if (!scopes[i].parent)
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
            findLinear: function(item) {
                var loc = item.loc || item.locEnd || 0;
                for (var i = 0; i < scopes.length; i++) {
                    if (scopes[i].start < loc && scopes[i].end > loc)
                        return scopes[i];
                }
            },
            find: function(item) {
                var loc = item.loc || item.locEnd || 0;
                //check if in last scope
                if (findScope(loc, lastScope, 0, 1, true)) {
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
    /*Streams{
       next() 
       current - last result of next()
       indexToPosition? - for line streams
       getCurrentIndex - index of this.current in stream
       private:
        cursor - the internal position before this.current
    }*/
    var TextStream = function(text) {
        this.res = text;
        this.cursor = 0;
    };
    TextStream.prototype.next = function() {
        if (this.res) {
            this.current = this.res;
            this.res = null;
        } else {
            if (this.current)
                this.cursor += this.current.length;
            this.current = null;
        }
        return this.current;
    };
    TextStream.prototype.getCurrentIndex = function() {
        return this.cursor;
    };

    var DocStream = function(doc) {
        this.res = doc.session.getDocument();
        this.lineEnding = this.res.getNewLineCharacter();
        this.lineIndex = this.cursor = 0;
        this.current = "";
        this.cursor = 0;
    };
    DocStream.prototype.next = function() {
        if (this.lineIndex == this.res.getLength()) return (this.current = null);
        this.cursor += this.current.length;
        this.current = this.res.getLine(this.lineIndex++) + this.lineEnding;
        return this.current;
    };
    DocStream.prototype.getCurrentIndex = function() {
        return this.cursor;
    };
    DocStream.prototype.indexToPosition = function(i) {
        return this.res.indexToPosition(i);
    };

    var LineStream = function(stream) {
        this.stream = stream;
        this.current = this.buffer = "";
        this.pos = 0; //the position after this.current
        this.cursor = 0;
        this.history = [0];
    };
    LineStream.from = function(stream) {
        if (stream.constructor == DocStream) {
            return stream;
        }
        return new LineStream(stream);
    };
    //A bit redundant
    LineStream.prototype.indexToPosition = function(i) {
        var t = 0;
        while (t < this.history.length && i > this.history[t + 1]) {
            t++;
        }
        return {
            row: t,
            column: i - this.history[t]
        };
    };
    LineStream.prototype.next = function() {
        if (this.pos >= this.buffer.length) {
            this.buffer = this.stream.next();
            this.cursor = 0;
            this.pos = 0;
        } else this.cursor = this.pos;
        if (this.buffer === null) return (this.current = this.buffer = null);

        //without a regex for once
        var lineEnd;
        do {
            var lineEndNL = this.buffer.indexOf("\n", this.pos);
            var lineEndCR = this.buffer.indexOf("\r", this.pos);
            lineEnd = (lineEndNL < 0 ? lineEndCR : lineEndCR < 0 ? lineEndNL : Math.min(lineEndNL,
                lineEndCR));
            if (lineEnd + 1 == lineEndNL) { //crlf
                lineEnd = lineEndNL;
            }
            if (lineEnd < 0 && this.stream.next() !== null) {
                if (this.cursor) {
                    this.buffer = this.buffer.substring(this.cursor);
                    this.cursor = 0;
                }
                this.pos = this.buffer.length;
                //can \r\n be split into two??? not by any of our current filters
                this.buffer += this.stream.current;
            } else break;
        } while (true);
        this.pos = lineEnd > -1 ? lineEnd + 1 : this.buffer.length;
        this.history.push(this.pos);
        this.current = this.buffer.substring(this.cursor, this.pos);
        return this.current;
    };
    LineStream.prototype.getCurrentIndex = function() {
        return this.cursor + this.stream.getCurrentIndex();
    };
    //base class for streams that filter out blocks of text
    var BlockFilter = function(start, stream) {
        this.start = new RegExp(start, 'g');
        this.stream = stream;
        this.buf = "";
        this.cursor = 0;
    };
    BlockFilter.prototype.next = function() {
        if (!this.buf) {
            this.buf = this.stream.next();
            this.cursor = 0;
        } else this.cursor += (this.current.length + this.filteredLength);
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
        return this.stream.getCurrentIndex() + this.cursor;
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
                }], LineStream.from(rawStream))));
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
    var regexRe = "(?<=(?:[^\w]|^) *)\\/"; //the only look behind in this codebase
    try {
        new RegExp(regexRe);
    } catch (e) {
        regexRe = "(?:[^\w\{\}]|^) *\\/";
    }
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
                open: regexRe,
                close: "/",
                breaksOnNewLine: true,
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
        'kotlin': cScopeFinder,
        'dart': cScopeFinder,
        'typescript': cScopeFinder,
        'php': cScopeFinder,
        'java': cScopeFinder,
        'python': pyScopeFinder,
        'c_cpp': cScopeFinder
    };
    global.scopeIterator = scopeIterator;
    global.DocStream = DocStream;
    global.LineStream = LineStream;
    global.TextStream = TextStream;
}); /*_EndDefine*/
