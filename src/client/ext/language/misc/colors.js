define(function (require, exports, module) {
    //A very simple completer for css
    var Docs = require("grace/docs/document").Docs;
    var Utils = require("grace/core/utils").Utils;
    var completions = ace.require("ace/ext/completions");
    var ConfigEvents = require("grace/core/config").Config;
    var appConfig = require("grace/core/config").Config.registerAll(
        {
            colors: {
                presets: ["red", "blue", "orange"],
            },
            enableColorCompletion: true,
        },
        "autocompletion"
    );
    var config = appConfig.colors;
    require("grace/core/config").Config.registerInfo(
        {
            "!root":
                "Allow completing with html colors as well as colors found in files",

            presets:
                "An Array of color presets. Best loaded as a separate file. Each item can either be an object of the form \n\
{\n\
    value:string, - The value inserted when selected\n\
    caption?string, - The name in autocompletion menu\n\
    color?:string?\n - The color used for preview\n\
} or a plain string representing all of them",
        },
        "autocompletion.colors"
    );
    var prefixes = [
        "color:",
        "background-color:",
        "style.color=",
        "style.backgroundColor=",
        "background:",
        "style.background=",
        "#",
        "rgb(",
        "rgba(",
    ];
    //what attrocity
    var regex = /rgba?\(\s*(\d*\.)?\d+\s*,\s*(\d*\.)?\d+\s*,\s*(\d*\.)?\d+(?:\s*,\s*(\d*\.)?\d+\s*)?\)|\#(?:[\da-f]{6,8}|[\da-f]{3,4})/g;

    function matchLine(prefix, line) {
        line = line
            .replace(/^\s*|\s*$/g, "")
            .replace(/\s+/g, " ")
            .replace(/['"`]/g, "");
        prefix =
            Utils.regEscape(prefix)
                .replace(/\\#\\#/g, "\\s?.+\\s?")
                .replace(/\W+/g, "\\s?$&\\s?") + "$";
        try {
            return new RegExp(prefix).exec(line);
        } catch (e) {
            require("grace/ui/notify").Notify.error("Invalid color regex");
            return false;
        }
    }

    function update() {
        if (
            exports.colorCompleter.registered !==
            Boolean(appConfig.enableColorCompletion)
        ) {
            exports.colorCompleter.registered = Boolean(
                appConfig.enableColorCompletion
            );
            if (appConfig.enableColorCompletion)
                completions.addCompleter(exports.colorCompleter);
            else completions.removeCompleter(exports.colorCompleter);
        }
    }
    ConfigEvents.on("autocompletion", update);
    var registry = {};

    function uniq(arr) {
        var prev;
        return arr.sort().filter(function (e) {
            return e == prev ? false : (prev = e);
        });
    }

    function gatherColors(removePrefix) {
        var p = config.presets.slice(0);
        Docs.forEach(function (doc) {
            if (
                !registry[doc.id] ||
                doc.getRevision() != registry[doc.id].rev
            ) {
                registry[doc.id] = {
                    rev: doc.getRevision(),
                };
                var t = doc.getValue();
                regex.lastIndex = 0;
                var colors = t.match(regex);
                if (colors) {
                    //perharps Utils.uniq
                    colors = uniq(colors);
                }
                registry[doc.id].colors = colors;
            }
            if (registry[doc.id].colors) {
                p = p.concat(registry[doc.id].colors);
            }
        });
        p = uniq(p);
        var score = 600;
        var prefixOffset = 0;
        if (removePrefix) {
            prefixOffset = removePrefix.length;
            p = p.filter(function (e) {
                return (e.caption || e.value || e).startsWith(removePrefix);
            });
            score += 300;
        }
        return p.map(function (e) {
            return {
                iconClass: " symbol-completion symbol-completion-color",
                message: "color",
                value: e.value || e,
                completer: exports.colorCompleter,
                color: e.color || (typeof e == "string" ? e : null),
                caption: (e.caption || e.value || e).substring(prefixOffset),
                score: score,
                // onRender: function(el,row,data){
                //     $(el).prepend("<div style='background:"+data.color+";width:1em;margin:0.1em;float:left;height:1em;border-radius:2px'></div>");
                // }
            };
        });
    }
    var Autocomplete = ace.require("ace/autocomplete").Autocomplete;
    exports.colorCompleter = {
        name: "Color completer",
        registered: false,
        insertMatch: function (editor, data) {
            var completions = editor.completer.completions;
            if (completions.filterText || this.filterPrefix) {
                var prefix = completions.filterText + this.filterPrefix;
                editor.execCommand(Autocomplete.$deletePrefix, prefix);
                var suffix = this.filterSuffixes[this.filterPrefix];
                if (suffix)
                    editor.execCommand(Autocomplete.$deleteSuffix, suffix);
            }
            editor.execCommand("insertstring", data.value);
        },
        filterPrefix: "",
        filterSuffixes: {
            "#": "",
            "rgba(": ")",
            "rgb(": ")",
        },
        getCompletions: function (editor, session, pos, prefix, callback) {
            //check mode
            var line = editor.session
                .getLine(pos.row)
                .slice(0, pos.column - prefix.length);
            if (
                prefixes.some(function (e) {
                    var result = matchLine(e, line);
                    if (result) {
                        if (this.filterSuffixes.hasOwnProperty(result[0]))
                            this.filterPrefix = result[0];
                        else this.filterPrefix = "";
                        return true;
                    }
                    return false;
                }, this)
            ) {
                callback(null, gatherColors(this.filterPrefix));
            } else callback(null);
        },
        getDocTooltip: function (item) {
            if (!item.docHTML && item.color) {
                item.docHTML =
                    "<span class='color-preview' style='background:" +
                    item.color +
                    "'></span>";
            }
        },
    };
    update();
});