define(function (require, exports, module) {
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
            t3 = h + (1 / 3) * -(i - 1);
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
        return [
            parseInt(r, 16),
            parseInt(g, 16),
            parseInt(b, 16),
            parseInt(a, 16) / 255,
        ];
    }

    function generateTokens(colors, name) {
        function toAce(token) {
            return "ace_" + token;
        }

        function toRule(scope) {
            return (
                "." +
                name +
                " ." +
                scope.split(".").map(toAce).join(".")
            );
        }
        return colors
            .map(function (e) {
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
                            body +=
                                "font-weight:normal;font-style:normal;text-decoration:none;";
                        } else {
                            if (settings.fontStyle.indexOf("bold") > -1)
                                body += "font-weight: bold;";
                            if (settings.fontStyle.indexOf("italic") > -1)
                                body += "font-style: italic;";
                            if (settings.fontStyle.indexOf("underline") > -1)
                                body += "text-decoration: underline;";
                        }
                    }
                    return header + "{" + body + "}";
                } else return "";
            })
            .join("\n");
    }
    exports.ThemeGen = {
        vs: function (json, id) {
            require(["text!./template_vs.css"], function (template) {
                var colors = json.colors;
                var m = Object.keys(colors);
                for (var t in m) {
                    colors[m[t].toLowerCase()] = colors[m[t]];
                }
                colors.none = "none";
                colors.inherit = "inherit";
                colors.transparent = "transparent";
                var regex = /['"]\@([A-Za-z0-9_\-\+\|\.\#]+)['"]/gm;
                var missingRules = [];

                var styles = template
                    .replace(regex, function (match, type) {
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
                                    expr =
                                        (expr[3] !== 1 ? "rgba(" : "rgb(") +
                                        expr.join(",") +
                                        ")";
                                }
                                return expr;
                            }
                        }
                        missingRules.push(type);
                        return "**css ignores unknown values**";
                    })
                    .replace(/theme-vs/g, "theme-" + id)
                    .replace(/ace\-vs\-theme/g, "ace-" + id + "-theme");
                if (Array.isArray(json.tokenColors)) {
                    styles +=
                        "\n" + generateTokens(json.tokenColors, "ace-" + id + "-theme");
                }
                if (missingRules.length) {
                    console.warn(
                        "The following rules are missing from " +
                            (json.name || "this") +
                            " theme " +
                            missingRules.sort().join("\n")
                    );
                }
                var style = document.getElementById("vs_" + id);
                if (!style) {
                    style = document.createElement("style");
                    style.id = "vs_" + id;
                    document.head.appendChild(style);
                }
                style.innerHTML = styles;
            });
        },
        light: light,
        tint: tint,
        parse: parseColor,
    };
});