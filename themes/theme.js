/*Supported colors
activityBar.BACKGROUND
activityBar.border
activityBar.FOREGROUND
background
button.background
button.background
button.foreground
button.hoverBackground
contrastBorder
*dropdown.background
*dropdown.foreground
editor.background
editor.foreground
editor.lineHighlightBackground
editorGutter.background
editorSuggestWidget.background
editorSuggestWidget.foreground
editorSuggestWidget.highlightForeground
editorSuggestWidget.selectedBackground
errorForeground
foreground
input.background
input.border
input.foreground
input.placeholderForeground
list.activeSelectionBackground
list.focusBackground
list.focusForeground
list.hoverBackground
list.hoverForeground
panel.background
panel.border
scrollbarSlider.activeBackground
scrollbarSlider.background
scrollbarSlider.hoverBackground
*list.dropdownTargetBackground
sideBar.background
sideBar.border
sideBar.foreground
sideBarSectionHeader.background
sideBarSectionHeader.foreground
statusBar.background
statusBarItem.prominentBackground
tab.activeBackground
tab.activeBorderTop
tab.activeForeground
tab.inactiveBackground
tab.inactiveForeground
textLink.activeForeground
textLink.foreground
*/
_Define(function(global) {
    function light(percent, color) {
        return color * (1 - percent) + percent * 255;
    }

    function tint(percent, color) {
        return color * (1 - percent);
    }

    function gray(percent, color) {
        return color * (1 - percent) + percent * 128;
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
        return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)];
    }

    function generatePalette(color, func) {
        var all = [];
        //0-9 linear spaced shades
        for (var i = -1; i < 9;) {
            i++;
            all.push([func(i / 10, color[0]), func(i / 10, color[1]), func(i / 10, color[2])]);
        }
        //10 and 11 exponentially smaller increments
        for (; i < 12;) {
            i++;
            var scale = 1 - 0.1 * Math.pow(0.5, i - 9);
            all.push([func(scale, color[0]), func(scale, color[1]), func(scale, color[2])]);
        }
        //13 end
        all.push([func(1, color[0]), func(1, color[1]), func(1, color[2])]);
        return all;
    }
    var style = document.createElement('style');
    document.head.appendChild(style);
    style.id = "theme";
    style.setAttribute("type", "text/css");
    var lastArgs = null;
    var sum = function(str) {
        //todo use checksum
        return str.substring(0, 10) + str.length;
    };
    var checkCache = function(args) {
        var check = sum(JSON.stringify(args));
        if (lastArgs == check) {
            return true;
        }
        lastArgs = check;
        return false;
    };

    function generateTokens(colors) {
        function toAce(token) {
            return "ace_" + token;
        }

        function toRule(scope) {
            return ".theme-vs .ace_editor " + "."+scope.split(".").map(toAce).join(".");
        }
        return colors.map(function(e) {
            var header;
            if (!e.scope) {
                header = toRule("text");
            } else if(typeof e.scope=="string"){
                header = toRule(e.scope);
            }
            else header = e.scope.map(toRule).join(",");
            var body = "";
            var settings = e.settings;
            if(settings){
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
            }
            else return "";
        }).join("\n");
    }
    global.ThemeGen = {
        mono: function(color) {
            if (checkCache(["mono", color])) return;
            color = parseColor(color);
            var types = {
                "GRAY": generatePalette(color, gray),
                "DARK": generatePalette(color, tint),
                "LIGHT": generatePalette(color, light)
            };
            var template = global["themes/template_mono.css"];
            style.innerHTML = template.replace(/(DARK|GRAY|LIGHT)_(\d+)/g, function(match, type, num) {
                return "rgb(" + types[type][num].join(",") + ")";
            });
        },
        vs: function(json, allowTokens) {
            if (checkCache(["vs", json])) return;
            var colors = json.colors;
            var m = Object.keys(colors);
            for (var t in m) {
                colors[m[t].toLowerCase()] = colors[m[t]];
            }
            colors.none = 'none';
            colors.inherit = 'inherit';
            var template = global["themes/template_vs.css"];
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
                            var func = lighten > 0 ? light.bind(null, pow) : tint.bind(null, pow);
                            expr[0] = func(expr[0]);
                            expr[1] = func(expr[1]);
                            expr[2] = func(expr[2]);
                            expr = "rgb(" + expr.join(",") + ')';
                        }
                        return expr;
                    }
                }
                missingRules.push(type);
                return "**css ignores unknown values**";
            });
            if (allowTokens != false && Array.isArray(json.tokenColors)) {
                styles += "\n" + generateTokens(json.tokenColors);
            }
            style.innerHTML = styles;
            if (missingRules.length) {
                console.warn("The following rules are missing from " +(json.name||"this")+" theme " + missingRules.sort().join("\n"));
            }
        },
        highlight: function(colors) {
            if (checkCache(["colors", colors])) return;
            var template = global["themes/template_highlight.css"];
            var regex = new RegExp("\\b(?:" + Object.keys(colors).join("|").toUpperCase() + ")\\b", "g");
            style.innerHTML = template.replace(regex, function(type) {
                return colors[type.toLowerCase()];
            });
        }
    };
});