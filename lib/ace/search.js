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
                if (callback(line, match.index, line, match.index + match[0].length))
                    return true;
                    ch=match.index+match.length;
                    regexp.lastIndex = ch;
                    match = regexp.exec(string);
            }
        }
    }

    function searchRegexpForwardMultiline(doc,regexp,start,range,callback) {
        if (!maybeMultiline(regexp)) return searchRegexpForward(doc, regexp, start,range,callback);
        var string, chunk = 1;
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
                if (callback(startLine, startCh,
                    startLine + inside.length - 1,
                    inside.length == 1 ? startCh + inside[0].length : inside[inside.length - 1].length))return true;
                        ch=match.index+match.length;
                        regexp.lastIndex = ch;
                        match = regexp.exec(string);
            }
        }
    }

    function lastMatchIn(string, regexp) {
        var cutOff = 0,match;
        for (;;) {
            regexp.lastIndex = cutOff;
            var newMatch = regexp.exec(string);
            if (!newMatch) return match;
            match = newMatch;
            cutOff = match.index + (match[0].length || 1);
            if (cutOff == string.length) return match;
        }
    }

    function searchRegexpBackward(doc, regexp,start,range,callback) {
        regexp = ensureFlags(regexp, "g");
        for (var line = start.row, ch = start.column, first = range.start.row ; line >= first; line--, ch = -1) {
            var string = doc.getLine(line);
            if (ch > -1) string = string.slice(0, ch);
            var match = lastMatchIn(string, regexp);
            while (match){
                if (callback(line, match.index,
                        line, match.index + match[0].length)) return true;
                ch = match.index;
                string = string.slice(0, ch);
                var match = lastMatchIn(string, regexp);
            }
        }
    }

    function searchRegexpBackwardMultiline(doc, regexp,start,range,callback) {
        if (!maybeMultiline(regexp)) return searchRegexpBackward(doc, regexp, start,range,callback);
        var string, chunk = 1;
        for (var line = start.row, first = range.start.row; line >= first;) {
            for (var i = 0; i < chunk; i++) {
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
                if (callback(startLine, startCh,
                    startLine + inside.length - 1,
                    inside.length == 1 ? startCh + inside[0].length : inside[inside.length - 1].length))return true;
                var ch = match.index;
                string = string.slice(0, ch);
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
        var start = options.start;
        var backwards = options.backwards === true;
        var skipCurrent = options.skipCurrent !== false;
        if (!start)
            start = range ? range[backwards ? "end" : "start"] : session.selection.getRange();
        if (start.start)
            start = start[skipCurrent != backwards ? "end" : "start"];
        if (!range) {
            range = Range.fromPoints({ row: 0, column: 0 }, doc.clippedPos(Number.MAX_VALUE, Number.MAX_VALUE));
        }
        this.findNext = function(callback) {
            if ((backwards ? searchRegexpBackwardMultiline : searchRegexpForwardMultiline)(doc, re, start, range, callback)) {
                return;
            }
            else if (options.wrap === false) {
                return;
            }
            else if (backwards) {
                searchRegexpBackwardMultiline(doc, re, range.end, range, function(sr, sc, er, ec) {
                    if (er <= start.row && ec <= start.column) {
                        return true;
                    }
                    return callback(sr, sc, er, ec);
                });
                return;
            }
            else {
                searchRegexpForwardMultiline(doc, re, range.start, range, function(sr, sc, er, ec) {
                    if (sr >= start.row && sc >= start.column) {
                        return true;
                    }
                    return callback(sr, sc, er, ec);
                });
                return;
            }
        };
    }
    
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
        iterator.findNext(function(sr, sc, er, ec) {
            result = new Range(sr, sc, er, ec);
            return true;
        });
        
        return result;
    };
    /**
     * Searches for all occurrances `options.needle`. If found, this method returns an array of [[Range `Range`s]] where the text first occurs. If `options.backwards` is `true`, the search goes backwards in the session.
     * @param {EditSession} session The session to search with
     *
     * 
     * @returns {[Range]}
    **/
    this.findAll = function(session){
        var options = this.$options;
        if (!options.needle)
            return false;
        this.$assembleRegExp(options);
        var iterator = this.iterator = new $matchIterator(session, options);
        if (!iterator)
            return false;
        var result = [];
        options.wrap = true;
        iterator.findNext(function(sr, sc, er, ec) {
            result.push(new Range(sr, sc, er, ec));
            return false;
        });
        return result;
    }
    this.$assembleRegExp = function(options, $disableFakeMultiline) {
        if (options.needle instanceof RegExp)
            return options.re = options.needle;

        var needle = options.needle;

        if (!options.needle)
            return options.re = false;

        if (!options.regExp)
            needle = lang.escapeRegExp(needle);

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
    this.replace = function(input, replacement) {
        var options = this.$options;

        var re = this.$assembleRegExp(options);
        
        if (!re)
            return;
        var match = re.exec(input);
        if (!match || match[0].length != input.length)
            return null;
        
        /*I guesss only regExps would fancy this*/
        if(options.regExp)
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
            })

        replacement = input.replace(re, replacement);
        if (options.preserveCase) {
            replacement = replacement.split("");
            for (var i = Math.min(input.length, input.length); i--;) {
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
    return wordBoundary(needle[0]) + needle
        + wordBoundary(needle[needle.length - 1]);
}

exports.Search = Search;
});
