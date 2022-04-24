/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2013 Matthew Christopher Kastor-Inare III, Atropa Inc. Intl
 * All rights reserved.
 *
 * Contributed to Ajax.org under the BSD license.
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

/*jslint indent: 4, maxerr: 50, white: true, browser: true, vars: true*/
/*global define, require */

/**
 * Get Editor Keyboard Shortcuts
 * @fileOverview Get Editor Keyboard Shortcuts <br />
 * Gets a map of keyboard shortcuts to command names for the current platform.
 * @author <a href="mailto:matthewkastor@gmail.com">
 *  Matthew Christopher Kastor-Inare III </a><br />
 *  ☭ Hial Atropa!! ☭
 */

define(function(require, exports, module) {
"use strict";
var keys = require("../../lib/keys");

/**
 * Gets a map of keyboard shortcuts to command names for the current platform.
 * @author <a href="mailto:matthewkastor@gmail.com">
 *  Matthew Christopher Kastor-Inare III </a><br />
 *  ☭ Hial Atropa!! ☭
 * @param {ace.Editor} editor An editor instance.
 * @returns {Array} Returns an array of objects representing the keyboard
 *  shortcuts for the given editor.
 * @example
 * var getKbShortcuts = require('./get_keyboard_shortcuts');
 * console.log(getKbShortcuts(editor));
 * // [
 * //     {'command' : aCommand, 'key' : 'Control-d'},
 * //     {'command' : aCommand, 'key' : 'Control-d'}
 * // ]
 */
var mods = {"C-": "Ctrl-", "S-": "Shift", "M-": "alt", "Cmd-": "command"};

function upper(x) {
    return x.toUpperCase(); }
function toMod(key){
    return mods[key]||key;
}
function normalize(k){
    var a = k.toLowerCase();
    a = a.replace(/(?:^|\-| )\w/g,upper);
    a = a.replace(/(?:Cmd|[CSM])\-/g,toMod);
    return a;
}
//{name:{keys:string,item:obj}}
module.exports.getCommandsByName = function(editor,validate) {
    var KEY_MODS = keys.KEY_MODS;
    var commandMap = Object.create(null);
    var bindings;
    if(validate){
        bindings = module.exports.getCommandsByKey(editor);
    }
    editor.keyBinding.$handlers.forEach(function(handler) {
        var ckb = handler.commandKeyBinding;
        for (var i in ckb) {
            var key = normalize(i);
            var commands = ckb[i];
            if (!Array.isArray(commands))
                commands = [commands];
            for(var k=0;k<commands.length;k++){
                var command = commands[k];
                var item,obj;
                if (typeof command != "string"){
                    item = command;
                    command  = command.name;
                    obj = commandMap[command];
                    if(obj && obj.item!=item){
                        if(obj.item){
                            //debug here
                        }
                        obj.item = item;
                    }
                }
                else obj = commandMap[command];
                var binding = key;
                if(validate && bindings[key] && bindings[key][bindings[key].length-1]!=command){
                    binding = "??"+key;
                }
                if(!obj){
                    commandMap[command]={item:item,keys:binding};
                }
                else{
                    var keys = obj.keys;
                    if(!keys)obj.keys = binding;
                    else if(keys!=binding){
                        if(("|"+keys+"|").indexOf("|"+binding+"|")>0){
                            keys = ("|"+keys+"|").replace("|"+binding+"|","|").substring(0,-1);
                        }
                        obj.keys = keys+"|"+binding;
                    }
                }
            }
        }
        var unmapped = handler.commands;
        for(var t in unmapped){
            if(!commandMap[t]){
                commandMap[t]={item:unmapped[t],keys:""};
            }
        }
    });
    return commandMap;
};
//{key:[commands:string]}
module.exports.getCommandsByKey = function(editor) {
    var KEY_MODS = keys.KEY_MODS;
    var keyBindings = Object.create(null);
    editor.keyBinding.$handlers.forEach(function(handler) {
        var ckb = handler.commandKeyBinding;
        for (var i in ckb) {
            var key = normalize(i);
            var commands = ckb[i];
            if (!Array.isArray(commands))
                commands = [commands];
            var keys = keyBindings[key];
            if(!keys){
                keys = keyBindings[key]=[];
            }
            for(var k=0;k<commands.length;k++){
                var command = commands[k];
                if (typeof command != "string")
                    command  = command.name;
                var pos = keys.indexOf(command);
                if(pos>-1){
                    keys.splice(pos,1);
                }
                keys.push(command);
            }
        }
    });
    return keyBindings;
};
module.exports.normalizeKey = normalize;
});