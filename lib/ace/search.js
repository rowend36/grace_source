/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var lang = require("./lib/lang");
var oop = require("./lib/oop");
var Range = require("./range").Range;
/**
 * @class Search
 *
 * A class designed to handle all sorts of text searches within a [[Document `Document`]].
 *
 **/

/**
 * 
 *
 * Creates a new `Search` object. The following search options are available:
 *
 * - `needle`: The string or regular expression you're looking for
 * - `backwards`: Whether to search backwards from where cursor currently is. Defaults to `false`.
 * - `wrap`: Whether to wrap the search back to the beginning when it hits the end. Defaults to `false`.
 * - `caseSensitive`: Whether the search ought to be case-sensitive. Defaults to `false`.
 * - `wholeWord`: Whether the search matches only on whole words. Defaults to `false`.
 * - `range`: The [[Range]] to search within. Set this to `null` for the whole document
 * - `regExp`: Whether the search is a regular expression or not. Defaults to `false`.
 * - `start`: The starting [[Range]] or cursor position to begin the search
 * - `skipCurrent`: Whether or not to include the current line in the search. Default to `false`.
 * 
 * @constructor
 **/

var Search = function() {
    this.$options = {};
};

(function() {
    /**
     * Sets the search options via the `options` parameter.
     * @param {Object} options An object containing all the new search properties
     *
     * 
     * @returns {Search}
     * @chainable
    **/
    this.set = function(options) {
        oop.mixin(this.$options, options);
        this.$lastResult = null;
        return this;
    };
    
    /**
     * [Returns an object containing all the search options.]{: #Search.getOptions}
     * @returns {Object}
    **/
    this.getOptions = function() {
        return lang.copyObject(this.$options);
    };
    
    /**
     * Sets the search options via the `options` parameter.
     * @param {Object} An object containing all the search propertie
     * @related Search.set
    **/
    this.setOptions = function(options) {
        this.$options = options;
        this.$lastResult = null;
    };
    
    function regexpFlags(regexp) {
        var flags = regexp.flags;
        return flags !== null ? flags : (regexp.ignoreCase ? "i" : "") +
            (regexp.global ? "g" : "") +
            (regexp.multiline ? "m" : "");
    }

    function ensureFlags(regexp, flags) {
        var current = regexpFlags(regexp),
            target = current;
        for (var i = 0; i < flags.length; i++)
            if (target.indexOf(flags.charAt(i)) == -1)
                target += flags.charAt(i);
        return current == target ? regexp : new RegExp(regexp.source, target);
    }

    function maybeMultiline(regexp) {
        return /\\s|\\n|\n|\\W|\\D|\[\^/.test(regexp.source);
    }

    function searchRegexpForward(doc,regexp,start,range, callback) {
        for (var line = start.row, ch = start.column, last = range.end.row; line <= last; line++, ch = 0) {
            regexp.lastIndex = ch;
            var string = doc.getLine(line),
                match = regexp.exec(string);
            while (match){
                if(line==last && match.index+match[0].length > range.end.column)return;
                if (callback(line, match.index, line, match.index + match[0].length,match))
                    return true;
                    ch=match.index+(match[0].length||1);
                    regexp.lastIndex = ch;
                    match = regexp.exec(string);
            }
        }
    }

    function searchRegexpForwardMultiline(doc,regexp,start,range,callback) {
        if (!maybeMultiline(regexp)) return searchRegexpForward(doc, regexp, start,range,callback);
        var string, chunk = 3;
        for (var line = start.row,ch=start.column, last = range.end.row; line <= last;) {
            // This grows the search buffer in exponentially-sized chunks
            // between matches, so that nearby matches are fast and don't
            // require concatenating the whole document (in case we're
            // searching for something that has tons of matches), but at the
            // same time, the amount of retries is limited.
            for (var i = 0; i < chunk; i++) {
                if (line > last) break;
                var curLine = doc.getLine(line++);
                string = string == null ? curLine : string + "\n" + curLine;
            }
            chunk = chunk * 2;
            regexp.lastIndex = ch;
            var match = regexp.exec(string);
    
            while(match) {
                var before = string.slice(0, match.index).split("\n"),
                    inside = match[0].split("\n");
                var startLine = start.row + before.length - 1,
                    startCh = before[before.length - 1].length;
                var endCh = inside.length == 1 ? startCh + inside[0].length : inside[inside.length - 1].length;
                if(startLine==last && endCh > range.end.column)return;
                if (callback(startLine, startCh,
                    startLine + inside.length - 1,
                    endCh,match))return true;
                        ch=match.index+((match[0].length)||1);
                        regexp.lastIndex = ch;
                        match = regexp.exec(string);
            }
        }
    }

    /**
     * Matches are exclusive and not necessarily
     * equivalent to the order of forward matches.
     * ababa ~ /\w\w/-> ba,ba rather than ab,ab.
     * This is the only way for multiline reverse search
     * to be exclusive efficiently. Vim multiline searches
     * are not exclusive but maintain order.
     */
    function lastMatchIn(string, regexp) {
        var cutOff = -1,match,index=0;
        for (;;) {
            regexp.lastIndex = index;//cutOff;
            var newMatch = regexp.exec(string);
            if (!newMatch) return match;
            if(newMatch.index+newMatch[0].length<=cutOff){
                index++;
                continue;
            }
            match = newMatch;
            cutOff = match.index + match[0].length;
            index = match.index + 1;
            if (cutOff > string.length) return match;
        }
    }

    function searchRegexpBackward(doc, regexp,start,range,callback) {
        regexp = ensureFlags(regexp, "g");
        for (var line = start.row, ch = start.column, first = range.start.row ; line >= first; line--, ch = -1) {
            var string = doc.getLine(line);
            if (ch > -1) string = string.slice(0, ch);
            var match = lastMatchIn(string, regexp);
            while (match){
                if(line==first && match.index < range.start.column)return;
                if (callback(line, match.index,
                        line, match.index + match[0].length,match)){
                            return true;
                        }
                ch = match.index;
                var newstring = string.slice(0, ch);
                if(newstring == string){
                    if(string.length){
                        newstring = string.slice(0,string.length-1);
                    }
                    else break;
                }
                string = newstring;
                match = lastMatchIn(string, regexp);
            }
        }
    }

    function searchRegexpBackwardMultiline(doc, regexp,start,range,callback) {
        if (!maybeMultiline(regexp)) return searchRegexpBackward(doc, regexp, start,range,callback);
        var string, chunk = 3;
        for (var line = start.row, first = range.start.row; line >= first;) {
            for (var i = 0; i < chunk && line >= 0; i++) {
                var curLine = doc.getLine(line--);
                string = string == null ? curLine.slice(0, start.column) : curLine + "\n" + string;
            }
            chunk *= 2;

            var match = lastMatchIn(string, regexp);
            while (match) {
                var before = string.slice(0, match.index).split("\n"),
                    inside = match[0].split("\n");
                var startLine = line + before.length,
                    startCh = before[before.length - 1].length;
                if(startLine==first && startCh < range.start.column)return;
                
                if (callback(startLine, startCh,
                    startLine + inside.length - 1,
                    inside.length == 1 ? startCh + inside[0].length : inside[inside.length - 1].length,match))return true;
                var ch = match.index;
                
                var newstring = string.slice(0, ch);
                if(newstring == string){
                    if(string.length){
                        newstring = string.slice(0,string.length-1);
                    }
                    else break;
                }
                string = newstring;
                match = lastMatchIn(string, regexp);
            }
        }
    }


    var $matchIterator = function(session, options) {
        var re = options.re;
        if (!re)
            return false;
        var doc = session.getDocument();
        var range = options.range ? Range.fromPoints(options.range.start, options.range.end) : null;
        var backwards = options.backwards === true;
        var skipCurrent = options.skipCurrent !== false;
        var start = options.start;
        if (!start){
            start = range ? range[backwards ? "end" : "start"] : session.selection.getRange();
        }
        if (start.start){
            var newstart = start[skipCurrent != backwards ? "end" : "start"];
            start = newstart;
        }
        if (!range) {
            range = Range.fromPoints({ row: 0, column: 0 }, doc.clippedPos(Number.MAX_VALUE, Number.MAX_VALUE));
        }
        this.findNext = function(callback) {
            //Note: start variable is not updated automatically
            //might change if a use case is provided
            if ((backwards ? searchRegexpBackwardMultiline : searchRegexpForwardMultiline)(doc, re, start, range, callback)) {
                return;
            }
            else if (options.wrap === false) {
                return;
            }
            else if (backwards) {
                searchRegexpBackwardMultiline(doc, re, range.end, range, function(sr, sc, er, ec,match) {
                    if (er < start.row || (er==start.row && ec <= start.column)) {
                        return true;
                    }
                    return callback(sr, sc, er, ec,match);
                });
                return;
            }
            else {
                searchRegexpForwardMultiline(doc, re, range.start, range, function(sr, sc, er, ec,match) {
                    if (sr > start.row || (sr==start.row && sc >= start.column)) {
                        return true;
                    }
                    return callback(sr, sc, er, ec,match);
                });
                return;
            }
        };
    };
    
    /**
     * Searches for `options.needle`. If found, this method returns the [[Range `Range`]] where the text first occurs. If `options.backwards` is `true`, the search goes backwards in the session.
     * @param {EditSession} session The session to search with
     *
     * 
     * @returns {Range}
    **/
    this.find = function(session) {
        var options = this.$options;
        if (!options.needle)
            return false;
        this.$assembleRegExp(options);
        
        var iterator = this.iterator = new $matchIterator(session, options);
        if (!iterator)
            return false;
        var result;
        iterator.findNext(function(sr, sc, er, ec,match) {
            result = new Range(sr, sc, er, ec);
            if (sc == ec && options.start && options.start.start &&
                options.skipCurrent != false && result.isEqual(options.start)
            ) {
                result = null;
                return false;
            }
            result.match = match;
            return true;
        });
        this.$lastResult = result;
        return result;
    };
    this.getSearchIterator = function(session,reset) {
        var options = this.$options;
        if (!options.needle)
            return false;
        this.$assembleRegExp(options);
        if(reset){
            options.skipCurrent = false;
            options.start = options.range ? options.range[options.backwards ? "end" : "start"] : { row: 0, column: 0 };
        }
        return new $matchIterator(session, options);
    };
    /**
     * Searches for all occurrances `options.needle`. If found, this method returns an array of [[Range `Range`s]] where the text first occurs. If `options.backwards` is `true`, the search goes backwards in the session.
     * @param {EditSession} session The session to search with
     * @param {Boolean} includeMatches Whether to include the match results in search
     * 
     * 
     * @returns {[Range]}
    **/
    this.findAll = function(session,unused,unused2,includeMatches,guard){
        var options = this.$options;
        if (!options.needle)
            return false;
        this.$assembleRegExp(options);
        options.skipCurrent = false;
        options.start = options.range ? options.range[options.backwards ? "end" : "start"]:{ row: 0, column: 0 };
        var iterator = this.iterator = new $matchIterator(session, options);
        if (!iterator)
            return false;
        var results = [];
        if(includeMatches){
            iterator.findNext(function(sr, sc, er, ec, match) {
                var result = new Range(sr, sc, er, ec);
                result.match = match;
                results.push(result);
            });
        }
        else iterator.findNext(function(sr, sc, er, ec) {
            results.push(new Range(sr, sc, er, ec));
            return false;
        });
        return options.backwards?results.reverse():results;
    };
    
    this.$assembleRegExp = function(options, $disableFakeMultiline) {
        if (options.needle instanceof RegExp)
            return options.re = options.needle;

        var needle = options.needle;

        if (!options.needle)
            return options.re = false;

        if (!options.regExp){
            needle = lang.escapeRegExp(needle);
        }
        if (options.wholeWord)
            needle = addWordBoundary(needle, options);

        var modifier = options.caseSensitive ? "gm" : "gmi";

        if (/\r\n|\r|\n/.test(needle)) {
            needle = needle.replace(/\r\n|\r|\n/g, "$\n^");
            options.$isMultiline = true;
        }
        else{
            options.$isMultiline=false;
        }
        
        var re = new RegExp(needle, modifier);

        return options.re = re;
    };
    
    /**
     * Searches for `options.needle` in `input`, and, if found, replaces it with `replacement`.
     * @param {String} input The text to search in
     * @param {String} replacement The replacing text
     * + (String): If `options.regExp` is `true`, this function returns `input` with the replacement already made. Otherwise, this function just returns `replacement`.<br/>
     * If `options.needle` was not found, this function returns `null`.
     *
     * 
     * @returns {String}
    **/
    this.replace = function(input,replacement,match, replaceOptions) {
        var options = this.$options;
        if(!match){
            this.$assembleRegExp(options);
            match = options.re.exec(input);
            if(!match || match[0].length != input.length)
                return null;
        }
        /*I guesss only regExps would fancy this*/
        if(options.regExp){
            replacement = replacement.replace(/\\(\\|n|r|t)/g, function(m, r) {
                switch (r) {
                    case "\\":
                        return "\\";
                    case "r":
                        return "\r";
                    case "n":
                        return "\n";
                    case "t":
                        return "\t";
                }
            });
            replacement = replacement.replace(/\$(\d|\$|\&|<\w+>)/g, function(m, n) {
                if (n == '$') return n;
                if (n == '&') return input;
                if (n[0] == '<') return (match.groups && match.groups[n.substring(1, n.length - 1)])||"";
                return match[n]===undefined?("$" + n):match[n];
            });
        }
        if (replaceOptions && replaceOptions.preserveCase) {
            replacement = replacement.split("");
            for (var i = Math.min(replacement.length, input.length); i--;) {
                var ch = input[i];
                if (ch && ch.toLowerCase() != ch)
                    replacement[i] = replacement[i].toUpperCase();
                else
                    replacement[i] = replacement[i].toLowerCase();
            }
            replacement = replacement.join("");
        }

        return replacement;
    };


}).call(Search.prototype);

function addWordBoundary(needle, options) {
    function wordBoundary(c) {
        if (/\w/.test(c) || options.regExp) return "\\b";
        return "";
    }
    return wordBoundary(needle[0]) + "(?:"+needle
        + ")"+wordBoundary(needle[needle.length - 1]);
}

exports.Search = Search;
});
