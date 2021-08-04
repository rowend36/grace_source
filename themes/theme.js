_Define(function(global) {
    //Copied from "https://github.com/Qix-/color-convert/issues"

    function rgb2hsl(rgb) {
        var r = rgb[0] / 255;
        var g = rgb[1] / 255;
        var b = rgb[2] / 255;
        var a = rgb[3] || 1;
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        var delta = max - min;
        var h;
        var s;
        var l;

        if (max === min) {
            h = 0;
        } else if (r === max) {
            h = (g - b) / delta;
        } else if (g === max) {
            h = 2 + (b - r) / delta;
        } else if (b === max) {
            h = 4 + (r - g) / delta;
        }

        h = Math.min(h * 60, 360);

        if (h < 0) {
            h += 360;
        }

        l = (min + max) / 2;

        if (max === min) {
            s = 0;
        } else if (l <= 0.5) {
            s = delta / (max + min);
        } else {
            s = delta / (2 - max - min);
        }

        return [h, s * 100, l * 100, a];
    }

    function hsl2rgb(hsl) {
        var h = hsl[0] / 360;
        var s = hsl[1] / 100;
        var l = hsl[2] / 100;
        var a = hsl[3] || 1;
        var t1;
        var t2;
        var t3;
        var rgb;
        var val;

        if (s === 0) {
            val = l * 255;
            return [val, val, val, a];
        }

        if (l < 0.5) {
            t2 = l * (1 + s);
        } else {
            t2 = l + s - l * s;
        }

        t1 = 2 * l - t2;

        rgb = [0, 0, 0, a];
        for (var i = 0; i < 3; i++) {
            t3 = h + 1 / 3 * -(i - 1);
            if (t3 < 0) {
                t3++;
            }
            if (t3 > 1) {
                t3--;
            }

            if (6 * t3 < 1) {
                val = t1 + (t2 - t1) * 6 * t3;
            } else if (2 * t3 < 1) {
                val = t2;
            } else if (3 * t3 < 2) {
                val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
            } else {
                val = t1;
            }

            rgb[i] = val * 255;
        }
        return rgb;
    }

    function light(percent, color) {
        var hsl = (color.hsl || (color.hsl = rgb2hsl(color))).slice(0);
        var per = 255 - hsl[2];
        hsl[2] += per * percent;
        return hsl2rgb(hsl);
    }

    function tint(percent, color) {
        var hsl = (color.hsl || (color.hsl = rgb2hsl(color))).slice(0);
        var per = -hsl[2];
        hsl[2] += per * percent;
        return hsl2rgb(hsl);
    }

    function parseColor(color) {
        if (color[0] == "#") {
            color = color.slice(1);
        }
        if (color.length < 6) {
            color = color.replace(/./g, "$&$&");
        }
        var r = color.slice(0, 2);
        var g = color.slice(2, 4);
        var b = color.slice(4, 6);
        var a = color.slice(6, 8) || "ff";
        return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16) / 255];
    }

    function generateTokens(colors, name) {
        function toAce(token) {
            return "ace_" + token;
        }

        function toRule(scope) {
            return "." + name + " .ace_editor " + "." + scope.split(".").map(toAce).join(".");
        }
        return colors.map(function(e) {
            var header;
            if (!e.scope) {
                header = toRule("text");
            } else if (typeof e.scope == "string") {
                header = toRule(e.scope);
            } else header = e.scope.map(toRule).join(",");
            var body = "";
            var settings = e.settings;
            if (settings) {
                if (settings.foreground) {
                    body += "color:" + settings.foreground + ";";
                }
                if (settings.background) {
                    body += "background-color:" + settings.background + ";";
                }
                if (settings.fontStyle != undefined) {
                    if (!settings.fontStyle) {
                        body += "font-weight:normal;font-style:normal;text-decoration:none;";
                    } else {
                        if (settings.fontStyle.indexOf('bold') > -1)
                            body += "font-weight: bold;";
                        if (settings.fontStyle.indexOf('italic') > -1)
                            body += "font-style: italic;";
                        if (settings.fontStyle.indexOf('underline') > -1)
                            body += "text-decoration: underline;";
                    }
                }
                return header + "{" + body + "}";
            } else return "";
        }).join("\n");
    }
    var Imports = global.Imports;
    global.ThemeGen = {
        vs: Imports.define([{
            resource: "./themes/template_vs.css",
        }], null, function(json, id) {
            var colors = json.colors;
            var m = Object.keys(colors);
            for (var t in m) {
                colors[m[t].toLowerCase()] = colors[m[t]];
            }
            colors.none = 'none';
            colors.inherit = 'inherit';
            colors.transparent = 'transparent';
            var template = global["./themes/template_vs.css"];
            var regex = /\$([A-Za-z0-9_\-\+\|\.\#]+)/gm;
            var missingRules = [];

            var styles = template.replace(regex, function(match, type) {
                var options = type.toLowerCase().split("|");
                for (var i in options) {
                    var expr = options[i];
                    var lighten = 0;
                    while (expr[0] == "-") {
                        lighten++;
                        expr = expr.substring(1);
                    }
                    while (expr[0] == "+") {
                        lighten--;
                        expr = expr.substring(1);
                    }
                    if (colors[expr]) {
                        expr = colors[expr];
                        if (!lighten) return expr;
                    }
                    if (expr[0] == "#") {
                        if (lighten) {
                            expr = parseColor(expr);
                            var pow = (lighten * lighten) / 100;
                            var func = lighten > 0 ? light : tint;
                            expr = func(pow, expr);
                            expr = (expr[3] !== 1 ? "rgba(" : "rgb(") + expr.join(",") +
                                ')';
                        }
                        return expr;
                    }
                }
                missingRules.push(type);
                return "**css ignores unknown values**";
            }).replace(/theme-vs/g, "theme-" + id);
            if (Array.isArray(json.tokenColors)) {
                styles += "\n" + generateTokens(json.tokenColors, "theme-" + id);
            }
            if (missingRules.length) {
                console.warn("The following rules are missing from " + (json.name || "this") +
                    " theme " + missingRules.sort().join("\n"));
            }
            var style = document.getElementById("vs_" + id);
            if (!style) {
                style = document.createElement('style');
                style.id = "vs_" + id;
                document.head.appendChild(style);
            }
            style.innerHTML = styles;
        }),
        light: light,
        tint: tint,
        parse: parseColor
    };
});

_Define(function(global) {
    /*Theming - Spent a lot of time on this.*/
    "use strict";
    var configEvents = global.ConfigEvents;
    var appEvents = global.AppEvents;
    var JSONExt = global.JSONExt;
    var ThemeGen = global.ThemeGen;
    var appConfig = global.registerAll({
        applicationTheme: "classic",
        appFontSize: "normal",
        customThemes: [],
        singleTabLayout: false,
    });

    var themes = ["auto", "classic"];

    global.registerValues({
        applicationTheme: {
            doc: "Choose UI theme",
            values: themes,
        },
        appFontSize: {
            doc: "Font size for UI",
            values: ["small", "normal", "big"]
        },
        customThemes: { //Until we can delete themes
            type: [{
                "name": "string",
                "filepath": "filename",
                "isDark": "?boolean",
                "server": "?string"
            }]
        }
    });
    var getEditor = global.getEditor;
    var getSettingsEditor = global.Editors.getSettingsEditor;
    var configureArr = global.configureArr;


    function onChange(ev) {
        switch (ev.config) {
            case "applicationTheme":
                if (ev.newValue != "auto" && ev.newValue !== "classic") {
                    for (var i in appConfig.customThemes) {
                        if (appConfig.customThemes[i].name == i) {
                            getSettingsEditor().setOption("theme", _id(appConfig.customThemes[i].name));
                            return;
                        }
                    }
                    global.Notify.error('Unknown theme ' + ev.newValue);
                    ev.preventDefault();
                } else updateTheme($(".editor-primary"), true);
                break;
            case "customThemes":
                var themes = appConfig.customThemes;
                themes.length = 2;
                appConfig.customThemes = [];
                themes.forEach(addTheme);
                themes.push.apply(themes, ev.newValue.map(function(e) {
                    return e.name;
                }));
                updateList();
                break;
            case "appFontSize":
                switch (ev.newValue) {
                    case "small":
                    case "normal":
                    case "big":
                        clearClass($(document.body.parentElement), /font$/);
                        document.body.parentElement.className +=
                            " " + ev.newValue + "font";
                        break;
                    default:
                        ev.preventDefault();
                }
                break;
            case "singleTabLayout":
                global.DocsTab.setSingleTabs(ev.newValue);
                break;
        }
    }
    configEvents.on("application", onChange);
    //App Theming
    var removeSplashScreen = global.Utils.delay(function() {
        document.body.parentElement.className +=
            " " + appConfig.appFontSize + "font";
        $(".splash-screen").animate({
            paddingLeft: 200,
            opacity: 0
        }, 500, 'linear', function() {
            $(".splash-screen").detach();
        });
        removeSplashScreen = null;
    }, 100);
    //Themes that can be used with a tweak of contrast/tint.
    //Only the best 10/23 were chosen
    var autoTheme = {
        "ace-dracula": "theme-dark-bg",
        "ace-idle-fingers": "theme-dark-bg",
        "ace-tomorrow-night-blue": "theme-dark-bg",
        "ace-solarized-dark": "theme-dark-bg theme-contrast",
        "ace-nord-dark": "theme-dark-bg theme-contrast",
        "ace-pastel-on-dark": "theme-contrast",
        "ace-cobalt": "theme-ace-cobalt",
        "ace-gruvbox": "theme-ace-gruvbox",
        "ace-gob": "theme-ace-gob",
        "ace-tomorrow-night": "theme-ace-tomorrow-night",
    };
    var themelist = ace.require("ace/ext/themelist");
    var themeData = {
        className: "ace-tm",
        aceTheme: {},
    };
    global.setTheme = function(ace_theme) {
        themeData = {
            aceTheme: ace_theme,
            className: ace_theme.cssClass,
            isDark: ace_theme.isDark,
        };
        appEvents.trigger("theme-change", {
            theme: themeData,
        });
        var els = $(".editor-primary");
        updateTheme(els, true);
    };

    function clearClass(els, regex) {
        els.each(function() {
            this.className = this.className
                .split(" ")
                .filter(function(e) {
                    return !regex.test(e);
                })
                .join(" ");
        });
    }

    function updateTheme(els, added) {
        if (!added) {
            els.addClass("editor-primary");
        }
        var ev = themeData;
        var currentTheme = appConfig.applicationTheme;
        clearClass(els, /theme|^ace/);
        if (themeData.aceTheme.isUITheme) {
            if (ev.isDark) {
                els.addClass("theme-dark");
            }
            els.addClass(themeData.aceTheme.rootClassName);
        } else if (currentTheme == "auto" && autoTheme[ev.className]) {
            els.addClass(ev.className);
            els.addClass("theme-dark");
            els.addClass("theme-auto");
            els.addClass(autoTheme[ev.className]);
        }
        /*fallback to classic*/
        else {
            clearClass(els, /theme|^ace/);
            if (ev.isDark) {
                els.addClass("theme-dark");
                els.addClass("app-theme-dark");
            } else els.addClass("app-theme-light");
        }
    }

    function addTheme(data, theme) {
        if (typeof theme !== "object") theme = null;
        for (var i in appConfig.customThemes) {
            if (appConfig.customThemes[i].name == data.name) {
                appConfig.customThemes[i] = data;
                break;
            }
        }
        if (appConfig.customThemes.indexOf(data) < 0) {
            appConfig.customThemes.push(data);
        }
        if (themes.indexOf(data.name) < 0)
            themes.push(data.name);

        var id = _id(data.name);
        /*Shouldn't really bother trying to keep this in sync*/
        var themeData = themelist.themesByName[data.name];
        if (themelist.themes.indexOf(themeData) > -1) {
            themelist.themes.splice(themelist.themes.indexOf(themeData), 1);
        }
        themeData = {
            theme: id,
            name: data.name,
            isDark: data.isDark,
            caption: data.name,
        };
        themelist.themesByName[data.name] = themeData;
        themelist.themes.push(themeData);
        ace.define.modules[id] = null;
        //not sure how safe this is
        global.libConfig.$loading[id] = null;
        ace.define(id, [], function(req, exports) {
            try {
                exports.cssClass = "ace_vs_theme";
                exports.cssText = "";
                exports.isUITheme = true;
                exports.isDark = data.isDark;
                exports.rootClassName = "theme-" + id;
                if (theme) {
                    ThemeGen.vs(theme, id);
                } else {
                    appEvents.on("app-loaded", function() {
                        removeSplashScreen && removeSplashScreen.cancel();
                        var server = FileUtils.getFileServer(data.server, true);
                        FileUtils.getDoc(data.filepath, server,
                            function(res,
                                err) {
                                removeSplashScreen && removeSplashScreen();
                                try {
                                    if (!err) {
                                        var p = JSONExt.parse(res);
                                        ThemeGen.vs(p, id);
                                        return;
                                    }
                                } catch (e) {
                                    err = e;
                                }
                                global.Notify.error('Failed to load theme ' + data.name +
                                    ": " + (
                                        err.code || err.toString()));
                                return getSettingsEditor().setOption("theme",
                                    "ace/theme/cobalt");
                            }, true);
                    });
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    function _id(t) {
        return String(t).replace(/ /g, "_").replace(/\W/g, "-");
    }
    var FileUtils = global.FileUtils;
    var MainMenu = global.MainMenu;
    MainMenu.extendOption("load-settings", {
        subTree: {
            "import-theme": {
                caption: "Import theme",
                icon: "file_download",
                onclick: function() {
                    FileUtils.pickFile("Select theme file", function(ev) {
                        ev.preventDefault();
                        FileUtils.getDocFromEvent(ev, function(val, err) {
                            if (!val || err) {
                                return global.Notify.error('Error loading file');
                            }
                            try {
                                //Verify theme syntax
                                var theme = JSONExt.parse(val);
                                var data = {
                                    filepath: ev.filepath,
                                    name: theme.name ? theme.name : ev.filename
                                        .replace(/([^\.]+)\..*/, "$1"),
                                    isDark: theme.type == 'dark'
                                };
                                if (!/dark|light/i.test(data.name)) {
                                    data.name += theme
                                        .type == 'dark' ? ' Dark' : ' Light';
                                }
                                if (ev.browser.fileServer !== FileUtils
                                    .defaultServer) {
                                    data.server = ev.browser.fileServer.id;
                                }
                                addTheme(data, theme);
                                configureArr("customThemes", appConfig
                                    .customThemes);
                                updateList();
                                global.Notify.ask("Apply theme now?", function() {
                                    getSettingsEditor().setOption("theme",
                                        _id(data.name));
                                });
                            } catch (e) {
                                console.log(e);
                                return global.Notify.error('Error parsing ' + ev
                                    .filepath);
                            }
                        }, false, true);
                    });
                }
            }
        }
    });

    function updateList() {
        if (global.SettingsPanel) {
            var themeOption = global.SettingsPanel
                .optionGroups.Appearance.Theme;
            var themes = {
                Bright: [],
                Dark: []
            };
            themelist.themes.forEach(function(x) {
                themes[x.isDark ? "Dark" : "Bright"]
                    .push({
                        caption: x.caption,
                        value: x.theme
                    });
            });
            themeOption.items = themes;
        }
    }

    appEvents.once('app-loaded', function() {
        removeSplashScreen();
        global.setTheme(getEditor().renderer.theme);
    });
    //configure an element to use application theme class
    global.watchTheme = updateTheme;
    var prevThemes = appConfig.customThemes;
    appConfig.customThemes = [];
    prevThemes.forEach(addTheme);
    prevThemes = null;
}); /*_EndDefine*/
_Define(function(global) {
    //Bunch of useful stylings
    global.styleCheckbox = function(el) {
        el = el
            .find("[type=checkbox]")
            .addClass("checkbox");
        for (var i = 0; i < el.length; i++) {
            var a = el.eq(i);
            //The styling uses the before element of next span
            if (!a.next().is("span")) {
                a.after("<span></span>");
            }
            if (!a.next().is(".checkbox-track,.checkbox-filled-in")) {
                a.next().addClass("checkbox-track");
            }

        }
        el.next().addClass('lever').click(function(e) {
            $(this).prev().click();
            e.stopPropagation();
            e.preventDefault();
        });
    };
    var go = function(e) {
        var ENTER = 13;
        switch (e.keyCode) {
            case ENTER:
                $(this).trigger("go", e);
                break;
        }
    };

    //behaves like a form sort of
    global.createSearch = function(input, button, onsearch) {
        $(button).on('click', onsearch);
        $(input).on('go', onsearch);
        $(input).on('keypress', go);
    };
    //create a table representing an object
    global.tabulate = function table(data) {
        var str = "<table>";
        for (var i in data) {
            str +=
                "<tr><td>" +
                i +
                "</td><td>" +
                (data[i] && typeof data[i] == "object" ?
                    table(data[i]) :
                    data[i]) +
                "</td></tr>";
        }
        if (data && !i)
            str += data.toString ? data.toString() : "Object";
        return str + "</table>";
    };
    //filenames - needed this ever since chrome started ignoring css rtl
    global.styleClip = function(el) {
        el = $(el);
        var all = el.filter(".clipper");
        all.add(el.find(".clipper")).each(function(i, clipper) {
            var text = clipper.innerHTML;
            clipper.innerHTML = "";
            var chunks = [text];
            var t = chunks.length - 1;
            chunks.reverse().forEach(function(e, i) {
                var span = document.createElement("span");
                span.className = "clipper-text";
                span.innerText = (i < t ? "/" : "") + e;
                clipper.appendChild(span);
            });
        });
    };
});