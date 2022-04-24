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

var oop = require("../lib/oop");
var Mirror = require("../worker/mirror").Mirror;
var JavaAst = require("./java/java_ast");

var JavaWorker = exports.JavaWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(500);
    this.setOptions();
};

oop.inherits(JavaWorker, Mirror);

var WHITESPACE = /\s*$/;
(function() {
    this.setOptions = function() {
        //do nothing
    };
    this.onUpdate = function() {
        var value = this.doc.getValue();
        var doc = this.doc;
        value = value.replace(/^#!.*\n/, "\n");
        if (!value)
            return this.sender.emit("annotate", []);
    
        var errors = [];
        try{
            JavaAst.parse(value, {
                syntaxError: function(recognizer, offendingSymbol, line, col, msg) {
                    var row= line-1;
                    if(/^missing |^no viable alternative/.test(msg)){
                        //The parser eats some extra whitespace
                        //before reporting most errors
                        do {
                            var lineText = doc.getLine(row).substring(0, col);
                            var match = WHITESPACE.exec(lineText);
                            if (row && match.index == 0) {
                                row--;
                                col = Number.MAX_VALUE;
                            } else {
                                col = (match ? match.index : lineText.length) - 1;
                                break;
                            }
                    
                        } while (true);
                    }
                    errors.push({
                        row: row,
                        column: col,
                        text: msg,
                        end: offendingSymbol && {
                            row: row,
                            column: col + offendingSymbol.stopIndex - offendingSymbol.startIndex+1
                        },
                        type: "error"
                    });
        
                }
            });
        }
        catch(e){
            errors.push({
                row: this.doc.getLength()-1,
                column: 0,
                text: "Parse failed: "+e.message
            });
        }
        this.sender.emit("annotate", errors);
    };

}).call(JavaWorker.prototype);

});
