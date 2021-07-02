_Define(function(global) {
    var noop = global.Utils.noop;
    /**@constructor*/
    var JSONWalker = function(json, onEnter, onLeave, onToken) {
        onEnter = onEnter || noop;
        onLeave = onLeave || noop;
        onToken = onToken || noop;
        var ARRAY = 1,
            OBJ = 2,
            VALUE = 4,
            jSON = 5,
            END = 7,
            ITEM = 9,
            CLOSE_OBJ = 6,
            CLOSE_ARR = 10,
            END_VALUE = 11;
        // var ch = 0;
        // var line = 0;
        var pos = 0;
        var end = json.length;
        var state = jSON;
        var stack = [];
        var NUMBER = /^\d+(?:\.\d*)?/;
        var STRING = /^(\")(?:[^\"\n\\]|\\.)*(\1)/;
        var BOOLEAN = /^(?:true|false)/;
        var NULL = /^null/;

        function read(re) {
            var t = json.substring(pos);
            var b = re.exec(t);
            if (b) {
                pos += b[0].length;
                return true;
            }
            return false;
        }

        function notify(start) {
            var a = (function() {
                switch (state) {
                    case END:
                    case jSON:
                        return "JSON";
                    case CLOSE_OBJ:
                    case OBJ:
                        return "OBJECT";
                    case ITEM:
                        return "KEY";
                    case CLOSE_ARR:
                    case ARRAY:
                        return "ARRAY";
                    case VALUE:
                    case END_VALUE:
                        switch (stack[stack.length - 1]) {
                            case CLOSE_ARR:
                                return "ARR_VALUE";
                            case CLOSE_OBJ:
                                return "OBJ_VALUE";
                            case END:
                                return "ROOT_VALUE";
                        }
                        throw "Bad State";
                }
            })();
            start ? onEnter(a, pos, json) : onLeave(a, pos, json);
        }

        function advance() {
            notify();
            if (stack.length) {
                state = stack.pop();
            } else throw new Error("Unexpected end of state");
            eatSpace();
        }
        var SPACE = /\s/;

        function eatSpace() {
            while (SPACE.test(json[pos])) pos++;
        }

        function la(ch) {
            return json[pos] == ch;
        }
        this.getState = function() {
            return {
                stack: stack.slice(0),
                pos: pos,
                json: json,
            };
        };
        this.setState = function(s) {
            stack = s.stack.slice(0);
            pos = s.pos;
            json = s.json;
        };
        this.insertAfter = function(text, advance) {
            json = json.slice(0, pos) + text + json.slice(pos);
            end += text.length;
            if (advance) pos += text.length;
        };
        this.insert = function(text, index) {
            json = json.slice(0, index) + text + json.slice(index);
            if (pos > index) {
                pos += text.length;
            }
            end += text.length;
        };
        this.delete = function(length, index) {
            json = json.slice(0, index) + json.slice(index + length);

            if (pos > index) {
                if (pos <= index + length) pos = index;
                else pos -= length;
            }
            end -= length;
        };

        function eat(token) {
            onToken(token, pos++, json);
        }

        function call(op, after) {
            state = op;
            stack.push(after);
            if (pos == end) throw "Unexpected end of input";
        }

        function next() {
            while (pos <= end) {
                switch (state) {
                    case END_VALUE:
                        advance();
                        continue;
                    case VALUE:
                        notify(true);
                        if (read(NUMBER) || read(STRING) || read(NULL) || read(BOOLEAN)) {
                            advance();
                            continue;
                        } else if (la("{")) {
                            call(OBJ, END_VALUE);
                            continue;
                        } else if (la("[")) {
                            call(ARRAY, END_VALUE);
                            continue;
                        } else throw new Error("Unexpected token " + json[pos]);
                        break;
                    case jSON:
                        notify(true);
                        call(VALUE, END);
                        continue;
                    case END:
                        if (pos != end) throw "Unexpected tokens " + json.substr(pos, 10);
                        else {
                            pos += 1;
                        }
                        break;
                    case OBJ:
                        notify(true);
                        eat("{");
                        eatSpace();
                        if (la("}")) {
                            state = CLOSE_OBJ;
                        } else state = ITEM;
                        continue;
                    case ITEM:
                        notify(true);
                        if (!read(STRING)) throw "Expected string";
                        notify();
                        eatSpace();
                        if (!la(":")) throw "Expected colon";
                        eat(":");
                        eatSpace();
                        call(VALUE, CLOSE_OBJ);
                        continue;
                    case CLOSE_OBJ:
                        if (la(",")) {
                            eat(",");
                            onToken("SEP", pos);
                            eatSpace();
                            if (la('"')) {
                                state = ITEM;
                                continue;
                            }
                        }
                        if (!la("}")) throw "Expected }";
                        eat("}");
                        advance();
                        continue;
                    case ARRAY:
                        notify(true);
                        eat("[");
                        eatSpace();
                        if (la("]") || la[","]) {
                            state = CLOSE_ARR;
                        } else call(VALUE, CLOSE_ARR);
                        continue;
                    case CLOSE_ARR:
                        if (la(",")) {
                            eat(",");
                            eatSpace();
                            if (!la("]")) {
                                call(VALUE, CLOSE_ARR);
                                continue;
                            }
                        }
                        if (!la("]")) throw "Expected ]";
                        eat("]");
                        advance();
                        continue;
                    default:
                        throw "Unknown state " + state;
                }
            }
            if (state != END) throw "Counter Error";
            notify();
        }
        this.walk = function() {
            try {
                next();
            } catch (e) {
                var error = e.message.split("\n");
                var before = json.substr(Math.max(0, pos - 10), 10) + "<error>" + json.substring(pos, pos + 10);
                error[0] += " at position " + pos + "\n" + before;
                e.message = error.join("\n");
                throw e;
            }
        };
    };
    //The preprocessor step removes comments
    JSONWalker.stripComments = function(str, strictMode, padWithSpace, returnComments) {
        var re = /(\\)|(\"|\')|(\/\*)|(\*\/)|(\/\/)|(\r\n|\r|\n)/g;
        var lines = [];
        var comments = [];
        var inComment = false;
        var inString = "";
        var escaped = -1;
        var inLineComment = false;
        var i = null;
        var j = 0;

        function addComment(s, e) {
            if (padWithSpace) {
                lines.push(str.substring(s, e).replace(/\S/g, " "));
            }
            if (returnComments)
                comments.push({
                    start: s,
                    end: e,
                    text: str.substring(s, e)
                });
        }

        function addText(s, e) {
            lines.push(str.substring(s, e));
        }
        re.lastIndex = j;
        var k = 0;
        for (;;) {
            i = re.exec(str);
            if (i) {
                //open comment
                if (i[3]) {
                    if (!inComment && !inLineComment && !inString) {
                        k = i.index;
                        addText(j, k);
                        inComment = true;
                    }
                }
                //close comment
                else if (i[4]) {
                    if (inComment) {
                        j = i.index + 2;
                        addComment(k, j);
                        inComment = false;
                    } else if (!inString) {
                        //but can be regex
                        //throw new Error('Error: Parse Error ' + i);
                    }
                } else if (inComment) {
                    continue;
                }
                //open line comment
                else if (i[5]) {
                    if (!(inLineComment || inString)) {
                        k = i.index;
                        addText(j, k);
                        inLineComment = true;
                    }
                }
                //leave line comment
                else if (i[6]) {
                    if (inLineComment) {
                        j = i.index;
                        addComment(k, j);
                        inLineComment = false;
                    } else if (inString) {
                        //throw error-new line terminated string
                    }
                } else if (inLineComment) continue;
                //enter string
                else if (i[2]) {
                    if (escaped != i.index) {
                        if (i[2] == inString) {
                            inString = "";
                        } else if (!inString) {
                            inString = i[2];
                        }
                    }
                    //escape string
                } else if (i[1]) {
                    if (inString && escaped != i.index) escaped = i.index + 1;
                }
            } else {
                if (j < str.length) {
                    if (inComment || inLineComment) {
                        addComment(j, str.length);
                    } else
                        addText(j, str.length);
                }
                break;
            }
        }
        var text = lines.join(""),
            header = "",
            footer = "";
        if (!strictMode) {
            var firstBrace = text.indexOf("{");
            if (firstBrace > -1) {
                header = text.substring(0, firstBrace);
                var lastBrace = text.lastIndexOf("}");
                if (lastBrace > -1) {
                    footer = text.substring(lastBrace + 1);
                } else lastBrace = text.length - 1;
                text = (padWithSpace ? header.replace(/\S/g, " ") : "") +
                    text.slice(firstBrace, lastBrace + 1) +
                    (padWithSpace ? footer.replace(/\S/g, " ") : "");
            }
        }
        return returnComments ? {
            clean: text,
            header: header,
            footer: footer,
            comments: comments
        } : text;
    };

    JSONWalker.parse = function(json, reviver, strict) {
        var data = JSONWalker.stripComments(json, strict !== false, true, true);
        json = data.clean;
        var trailingCommas = /,\s*[}\]]/.test(json);
        if (trailingCommas) {
            //the best way is to lookahead rather than store needless state
            var trailingComma = /^\s*[}\]]/;
            var walker = new JSONWalker(json, null, null, function(token, pos, text) {
                if (token == "," &&
                    trailingComma.test(text.substring(pos + 1))) {
                    walker.delete(1, pos);
                    walker.insert(" ", pos);
                }
            });
            walker.walk();
            json = walker.getState().json;
        }
        return JSON.parse(json, reviver);
    };
    global.JSONWalker = JSONWalker;
    global.JSONExt = JSONWalker;
});