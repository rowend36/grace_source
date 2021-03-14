_Define(function(global){
    function OverlayTokenizer(tokenizer, ranges, mainTokenizer) {
        //the only necessary argument
        this.tokenizer = tokenizer;
        //needed only if no range is passed in multiplex
        this.ranges = ranges || [{
            start: {
                row: -Infinity
            },
            end: {
                row: Infinity
            }
        }];
        //needed for getTokens
        this.mainTokenizer = mainTokenizer;
    }
    (function() {
        this.getTokens = function(row) {
            var tokens = this.mainTokenizer.getTokens(row);
            tokens = this.multiplex(row, tokens);
            return tokens;
        };
        this.multiplex = function(row, tokens1, intersect) {
            if (!tokens1.length) return tokens1;
            if (!intersect) {
                for (var rangeID in this.ranges) {
                    var range = this.ranges[rangeID];
                    if (row >= range.start.row && row <= range.end.row) {
                        //this does not detect multiple
                        //intersects on a single line yet
                        //todo
                        //one way to do this is to
                        //have multiple multiplexers
                        //run in turn
                        //any way to save state will speed things up
                        //another way is to have a separate clipper
                        //clip the ranges first
                        //then overlay tokenizer will not have to worry
                        //about range
                        intersect = range
                        break;
                    }
                }
            }
            if (!intersect) return tokens1;
            var tokens2 = this.tokenizer.getTokens(row, tokens);
            var i1 = 0;
            var i2 = 0;
            var l1 = 0;
            var l2 = 0;
            var end = Infinity;
            var tokens = [];
            var token = {};
            var chars = 0;
            if (intersect.start.row == row) {
                chars = tokens1[l1++].value.length;
                var chars2 = 0;
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
                    i1 = 0
                    token = {
                        type: type,
                        value: a
                    }
                    tokens.push(token);
                    tokens.push.apply(tokens, tokens1.slice(l1));
                    return tokens;
                }
                token = {
                    type: type,
                    value: a
                }
                tokens.push(token);
            }
            return tokens;
        }
        this.mergeTypes = function(type1, type2) {
            return type1 == type2 ? type1 : type1 + "." + type2;
            /*var types = type1.split(".");
            return types.concat(type2.split(".").filter(function(a){
                return types.indexOf(a)<0;
            })).join(".");*/
        };
    }).apply(OverlayTokenizer.prototype);
    global.OverlayTokenizer = OverlayTokenizer;
})/*_EndDefine*/