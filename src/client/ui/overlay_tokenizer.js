define(function(require,exports,module){
    /** 
     * Inspired by codemirror. If only that library had supported
     * mobile better.
     * Overlays a one highlight rule eg diff highlight, text selection etc
     * over another one. 
     * Subclasses can override mergeType method for different behaviour,
     * The optional ranges argument allows selecting ranges to overlay
     * The mainTokenizer argument allows using it as a mode
     **/
    var RangeList = require('ace!range_list').RangeList;
    function OverlayTokenizer(tokenizer, ranges, mainTokenizer) {
        //the only necessary argument
        this.tokenizer = tokenizer;
        //needed only if no range is passed in overlay
        this.rangelist = new RangeList();
        if(ranges) this.rangelist.addList(ranges);
        //needed for getTokens
        this.mainTokenizer = mainTokenizer;
    }
    (function() {
        this.getTokens = function(row) {
            var tokens = this.mainTokenizer.getTokens(row);
            tokens = this.overlay(row, tokens);
            return tokens;
        };
        this.overlay = function(row, tokens1, intersect) {
            if (!tokens1.length) return tokens1;
            if (arguments.length === 2) {
                intersect = this.rangelist.clipRows(row, row + 1);
                for (var i = 0; i < intersect.length - 1; i++) {
                    tokens1 = this.overlay(row, tokens1, intersect[i]);
                }
                intersect = intersect[i];
            }
            if (!intersect) return tokens1;
            var tokens2 = this.tokenizer.getTokens(row, tokens);
            var l1 = 0;//index in tokens
            var l2 = 0;
            var i1 = 0;//offset in tokens1[l1]
            var i2 = 0;
            var end = Infinity;
            var tokens = [];
            var token = {};
            var chars = 0;//offset in row
            if (intersect.start.row == row) {
                //Add the unmodified tokens before the intersect column
                chars = tokens1[l1++].value.length;
                while (chars <= intersect.start.column) {
                    if (l1 >= tokens1.length) {
                        return tokens1;
                    }
                    tokens.push(tokens1[l1 - 1]);
                    chars += (tokens1[l1++].value.length);
                }
                i1 = intersect.start.column - chars + tokens1[--l1].value.length;
                tokens.push({
                    type: tokens1[l1].type,
                    value: tokens1[l1].value.substring(0, i1)
                });
                chars = tokens2[l2++].value.length;
                while (chars <= intersect.start.column) {
                    if (l2 >= tokens2.length) {
                        return tokens1;
                    }
                    chars += (tokens2[l2++].value.length);
                }
                chars -= tokens2[--l2].value.length;
                i2 = intersect.start.column - chars;
                chars = intersect.start.column;
            }
            if (intersect.end.row == row) {
                end = intersect.end.column;
            }
            while (l1 < tokens1.length) {
                var a = tokens1[l1].value;
                var type = tokens1[l1].type;
                if (i1)
                    a = a.substring(i1);
                if (l2 < tokens2.length && chars < end) {
                    type = this.mergeTypes(type, tokens2[l2].type);
                    var b = tokens2[l2].value;
                    var last = b.length - i2;
                    if ((chars + last) > end) {
                        last = end - chars;
                    }
                    var diff = last - a.length;
                    if (diff < 0) {
                        l2++;
                        a = a.substring(0, last);
                        i1 += last;
                        i2 = 0;
                    }
                    else if (diff > 0) {
                        l1++;
                        i2 += a.length;
                        i1 = 0;
                    }
                    else {
                        l2++;
                        l1++;
                        i1 = 0;
                        i2 = 0;
                    }
                    chars += a.length;
                }
                else {
                    l1++;
                    i1 = 0;
                    token = {
                        type: type,
                        value: a
                    };
                    tokens.push(token);
                    tokens.push.apply(tokens, tokens1.slice(l1));
                    return tokens;
                }
                token = {
                    type: type,
                    value: a
                };
                tokens.push(token);
            }
            return tokens;
        };
        this.mergeTypes = function(type1, type2) {
            return type1 == type2 ? type1 : type1 + "." + type2;
            /*var types = type1.split(".");
            return types.concat(type2.split(".").filter(function(a){
                return types.indexOf(a)<0;
            })).join(".");*/
        };
    }).apply(OverlayTokenizer.prototype);
    exports.OverlayTokenizer = OverlayTokenizer;
});/*_EndDefine*/