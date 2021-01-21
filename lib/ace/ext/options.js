define(function(require, exports, module) {
"use strict";
var overlayPage = require('./menu_tools/overlay_page').overlayPage;

 
var dom = require("../lib/dom");
var oop = require("../lib/oop");
var config = require("../config");
var EventEmitter = require("../lib/event_emitter").EventEmitter;
var buildDom = dom.buildDom;

var modelist = require("./modelist");
var themelist = require("./themelist");

var themes = { Bright: [], Dark: [] };
themelist.themes.forEach(function(x) {
    themes[x.isDark ? "Dark" : "Bright"].push({ caption: x.caption, value: x.theme });
});

var modes = modelist.modes.map(function(x){ 
    return { caption: x.caption, value: x.mode }; 
});


var optionGroups = {
    "Session":{
        Mode: {
            path: "mode",
            type: "select",
            items: modes
        },
        "Soft Wrap": {
            type: "buttonBar",
            path:"wrap",
            onchange: function(val,defaults){
                if(val=="default"){
                    val = defaults.wrap;
                }
                editor.setOption("wrap",val);
            },
            items: [
               { caption : "Off",  value : "off" },
               { caption : "View", value : "free" },
               { caption : "margin", value : "printMargin" },
               { caption : "40",   value : "40" },
               { caption: "Default", value: "default" }
            ]
        },
        "Soft Tabs": [{
            path: "useSoftTabs"
        }, {
            path: "tabSize",
            type: "number",
            values: [2, 3, 4, 8, 16]
        }],
    },
    General: {
        
        Theme: {
            path: "theme",
            type: "select",
            items: themes
        },
        "Keybinding": {
            type: "buttonBar",
            path: "keyboardHandler",
            items: [
                { caption : "Ace", value : null },
                { caption : "Vim", value : "ace/keyboard/vim" },
                { caption : "Emacs", value : "ace/keyboard/emacs" },
                { caption : "Sublime", value : "ace/keyboard/sublime" }
            ]
        },
        "Font Size": {
            path: "fontSize",
            type: "number",
            defaultValue: 12,
            defaults: [
                {caption: "12px", value: 12},
                {caption: "24px", value: 24}
            ]
        },
        "Soft Wrap": {
            type: "buttonBar",
            getValue: function(defaults){
                return defaults.wrap;
            },
            onchange: function(value,defaults){
                editor.setOption("wrap",value);
                defaults.wrap = value;
            },
            items: [
               { caption : "Off",  value : "off" },
               { caption : "View", value : "free" },
               { caption : "margin", value : "printMargin" },
               { caption : "40",   value : "40" }
            ]
        },
        "Folding": {
            path: "foldStyle",
            items: [
                { caption : "Manual", value : "manual" },
                { caption : "Mark begin", value : "markbegin" },
                { caption : "Mark begin and end", value : "markbeginend" }
            ]
        },
        "Soft Tabs": [{
            path: "useSoftTabs",
            getValue: function(defaults){
              return defaults[this.path]  
            },
            onchange: function(value,defaults){
                defaults.tabSize = value;
                editor.setOption("useSoftTabs",value);
            }
        }, {
            path: "tabSize",
            getValue: function(defaults){
              return defaults[this.path]  
            },
            onchange: function(value,defaults){
                defaults.tabSize = value;
                editor.setOption("tabSize",value);
            },
            type: "number",
            values: [2, 3, 4, 8, 16]
        }],
        "Overscroll": {
            type: "buttonBar",
            path: "scrollPastEnd",
            items: [
               { caption : "None",  value : 0 },
               { caption : "Half",   value : 0.5 },
               { caption : "Full",   value : 1 }
            ]
        }
    },
    Interaction: {
        "Atomic soft tabs": {
            path: "navigateWithinSoftTabs"
        },
        "Live Autocompletion": {
            path: "enableLiveAutocompletion"
        },
        "Enable Behaviours": {
            path: "behavioursEnabled"
        },
        "Full Line Selection": {
            type: "checkbox",
            values: "text|line",
            path: "selectionStyle"
        },
        "Indented Soft Wrap": {
            path: "indentedSoftWrap"
        },
        "Elastic Tabstops": {
            path: "useElasticTabstops"
        },
        "Incremental Search": {
            path: "useIncrementalSearch"
        },
        "Copy without selection": {
            path: "copyWithEmptySelection"
        }
    },
    Appearance:{
        "Cursor Style": {
            path: "cursorStyle",
            items: [
               { caption : "Ace",    value : "ace" },
               { caption : "Slim",   value : "slim" },
               { caption : "Smooth", value : "smooth" },
               { caption : "Smooth And Slim", value : "smooth slim" },
               { caption : "Wide",   value : "wide" }
            ]
        },
        "Highlight Active Line": {
            path: "highlightActiveLine"
        },
        
        "Highlight selected word": {
            path: "highlightSelectedWord"
        },
        "Show Invisibles": {
            path: "showInvisibles"
        },
        "Show Indent Guides": {
            path: "displayIndentGuides"
        },
        "Persistent Scrollbar": [{
            path: "hScrollBarAlwaysVisible"
        }, {
            path: "vScrollBarAlwaysVisible"
        }],
        "Animate scrolling": {
            path: "animatedScroll"
        },
        "Show Gutter": {
            path: "showGutter"
        },
        "Show Line Numbers": {
            path: "showLineNumbers"
        },
        "Relative Line Numbers": {
            path: "relativeLineNumbers"
        },
        "Fixed Gutter Width": {
            path: "fixedWidthGutter"
        },
        "Show Print Margin": [{
            path: "showPrintMargin"
        }, {
            type: "number",
            path: "printMarginColumn"
        }],
        "Fade Fold Widgets": {
            path: "fadeFoldWidgets"
        }
    },
    Advanced:{
        "Use textarea for IME": {
            path: "useTextareaForIME"
        },
        "Merge Undo Deltas": {
            path: "mergeUndoDeltas",
            items: [
               { caption : "Always",  value : "always" },
               { caption : "Never",   value : "false" },
               { caption : "Timed",   value : "true" }
            ]
        }
    }
};


var OptionPanel = function(editor, element) {
    this.editor = editor;
    this.container = element || document.createElement("div");
    this.groups = [];
    this.options = {};
    this.defaults = {
        "useSoftTabs":editor.getOption("useSoftTabs"),
        "tabSize":editor.getOption("tabSize"),
        "wrap":editor.getOption("wrap")
    };
};

(function() {
    
    oop.implement(this, EventEmitter);
    
    this.add = function(config) {
        for(var i in config){
            if (!optionGroups[i]) 
                optionGroups[i] = {}
            oop.mixin(optionGroups[i], config[i]);
        }
    };
    
    this.render = function() {
        this.container.innerHTML = "";
        buildDom(["ul", {id: "controls"}, Object.keys(optionGroups).map(function(key){
            return this.renderOptionGroup(optionGroups[key],key);
        },this),  ["li",{ style: "padding:10px;text-align:right" }, "version " + config.version]
        ], this.container);
        this.container.getElementsByTagName("li").namedItem("Session").classList.remove("closed");
    };
    this.renderOptionGroupHeader = function(name){
        return ["h6",{class:"header","id":name ,onclick:this.unfoldGroup()},name];
    };
    this.unfoldGroup = function(){
        var c = this.container.getElementsByTagName("li");
        var f = this.container;
        return function(e){
            var d = e.target.parentElement;
            d.classList.toggle("closed");
            for (var i=0;i< c.length;i++)
                if(c[i]!=d)c[i].classList.add("closed");
            f.scrollTop = 0;
        };
    };
    this.renderOptionGroup = function(group,name) {
        var entries = Object.keys(group).map(function(key, i) {
            var item = group[key];
            if (!item.position)
                item.position = i / 10000;
            if (!item.label)
                item.label = key;
            return item;
        }).sort(function(a, b) {
            return a.position - b.position;
        }).map(function(item) {
            return this.renderOption(item.label, item);
        }, this);
        return ["li",{id: name,class:"closed"},[this.renderOptionGroupHeader(name),["table",null,entries]]];
    };
    
    this.renderOptionControl = function(key, option) {
        var self = this;
        if (Array.isArray(option)) {
            return option.map(function(x) {
                return self.renderOptionControl(key, x);
            });
        }
        var control;
        
        var value = self.getOption(option);
        
        if (option.values && option.type != "checkbox") {
            if (typeof option.values == "string")
                option.values = option.values.split("|");
            option.items = option.values.map(function(v) {
                return { value: v, name: v };
            });
        }
        
        if (option.type == "buttonBar") {
            control = ["div",{ class: "buttonBar" }, option.items.map(function(item) {
                return ["span", { 
                    value: item.value, 
                    ace_selected_button: value == item.value, 
                    onclick: function() {
                        self.setOption(option, item.value);
                        var nodes = this.parentNode.querySelectorAll("[ace_selected_button]");
                        for (var i = 0; i < nodes.length; i++) {
                            nodes[i].removeAttribute("ace_selected_button");
                        }
                        this.setAttribute("ace_selected_button", true);
                    } 
                }, item.desc || item.caption || item.name];
            })];
        } else if (option.type == "number") {
            control = ["input", {type: "number", value: value || option.defaultValue, style:"width:3em", oninput: function() {
                self.setOption(option, parseInt(this.value));
            }}];
            if (option.defaults) {
                control = [control,[
                    ["select", { class:"number",onchange: function() {
                        var input = this.parentNode.firstChild;
                        input.value = this.value;
                        input.oninput();
                    }
            }, option.defaults.map(function(item) {
                    return ["option",{ value: item.value }, item.caption];
                })]]];
            }
        } else if (option.items) {
            var buildItems = function(items) {
                return items.map(function(item) {
                    return ["option", { value: item.value || item.name }, item.desc || item.caption || item.name];
                });
            };
            
            var items = Array.isArray(option.items) 
                ? buildItems(option.items)
                : Object.keys(option.items).map(function(key) {
                    return ["optgroup", {"label": key}, buildItems(option.items[key])];
                });
            control = ["select", { id: key, value: value, onchange: function() {
                self.setOption(option, this.value);
            } }, items];
        } else {
            if (typeof option.values == "string")
                option.values = option.values.split("|");
            if (option.values) value = value == option.values[1];
            control = ["input", { type: "checkbox", id: key, checked: value || null, onchange: function() {
                var value = this.checked;
                if (option.values) value = option.values[value ? 1 : 0];
                self.setOption(option, value);
            }}];
            if (option.type == "checkedNumber") {
                control = [control, []];
            }
        }
        return control;
    };
    
    this.renderOption = function(key, option) {
        if (option.path && !option.onchange && !this.editor.$options[option.path])
            return;
        this.options[option.path] = option;
        var safeKey = "-" + option.path;
        var control = this.renderOptionControl(safeKey, option);
        return ["tr", {class: "ace_optionsMenuEntry"}, ["td",
            ["span", {for: safeKey}, key]
        ], ["td", control]];
    };
    
    this.setOption = function(option, value) {
        if (typeof option == "string")
            option = this.options[option];
        if (value == "false") value = false;
        if (value == "true") value = true;
        if (value == "null") value = null;
        if (value == "undefined") value = undefined;
        if (typeof value == "string" && parseFloat(value).toString() == value)
            value = parseFloat(value);
        if (option.onchange)
            option.onchange(value,this.defaults);
        else if (option.path)
            this.editor.setOption(option.path, value);
        this._signal("setOption", {name: option.path, value: value});
    };
    
    this.getOption = function(option) {
        if (option.getValue)
            return option.getValue(this.defaults);
        return this.editor.getOption(option.path);
    };
    
}).call(OptionPanel.prototype);

exports.OptionPanel = OptionPanel;

});
