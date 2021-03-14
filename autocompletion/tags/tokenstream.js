_Define(function(global) {
    var StickyRegex;
    try {
        var reg = new RegExp("test", "y");
        StickyRegex = function(re) {
            if (re.flags.indexOf("y") < 0)
                return new RegExp(re.source, re.flags.replace("g", "") + "y");
            return re;
        };
    } catch (e) {
        StickyRegex = function(re) {
            if (re.flags.indexOf("y") > -1) return re;
            var regex = new RegExp("^" + re.source, re.flags.replace("g", ""));
            return {
                source: re.source,
                lastIndex: 0,
                flags: regex.flags + "y",
                exec: function(text) {
                    var match = regex.exec(text.substring(this.lastIndex));
                    if (match) {
                        match.index += this.lastIndex;
                        this.lastIndex += regex.lastIndex;
                        return match;
                    }
                    return null;
                }
            };
        };
    }

    function TokenStream(res, pos, match) {
        pos = pos || 0;
        match = match || false;
        return {
            constructor: tokenStream,
            readUntil: function(re) {
                re.lastIndex = pos;
                match = re.exec(res);
                if (match) {
                    pos = match.index;
                }
                return this;
            },
            readUntilText: function(text) {
                var a = res.indexOf(text, pos);
                if (a < 0) {
                    match = null;
                } else {
                    pos = a;
                    match = {
                        0: text,
                        index: pos,
                        length: 1
                    };
                }
                return this;
            },
            read: function(sticky_re) {
                sticky_re.lastIndex = pos;
                var result = sticky_re.exec(res) || false;
                if (result) {
                    match = result;
                    this.advance();
                    return result;
                }
                return match;
            },
            readText: function(text) {
                if (res.startsWith(text, pos)) {
                    var result = {
                        0: text,
                        index: pos,
                        length: 1
                    };
                    match = result;
                    this.advance();
                    return result;
                }
                return (match = false);
            },
            skip: function(re) {
                this.read(re);
                return this;
            },
            skipText: function(text) {
                this.readText(re);
                return this;
            },
            advance: function() {
                if (match) {
                    pos += match[0].length;
                    match = false;
                }
                return this;
            },
            eof: function() {
                return pos == res.length || (pos > 0 && match === null);
            },
            get token() {
                return match;
            },
            get offset() {
                return pos;
            },
            save: function() {
                return tokenStream(res, pos, match);
            },
            reset: function() {
                pos = 0;
                match = false;
                return this;
            }
        };
    }
    global.TokenStream = TokenStream;
    global.StickyRegex = StickyRegex;
})/*_EndDefine*/