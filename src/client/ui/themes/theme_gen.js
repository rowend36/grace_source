define(function (require, exports, module) {
    var template = require('text!./template_vs.css');
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
        var per = 100 - hsl[2];
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
        if (color[0] == '#') {
            color = color.slice(1);
        }
        if (color.length < 6) {
            color = color.replace(/./g, '$&$&');
        }
        var r = color.slice(0, 2);
        var g = color.slice(2, 4);
        var b = color.slice(4, 6);
        var a = color.slice(6, 8) || 'ff';
        return [
            parseInt(r, 16),
            parseInt(g, 16),
            parseInt(b, 16),
            parseInt(a, 16) / 255,
        ];
    }
    function printColor(color) {
        return (
            (color[3] !== 1 ? 'rgba(' : 'rgb(') +
            color
                .slice(0, color[3] === 1 ? 3 : 4)
                .map(Math.round)
                .join(',') +
            ')'
        );
    }

    function generateTokens(colors, name) {
        //Based on ace/tool/tmtheme.js
        var supportedScopes = {
            keyword: 'keyword',
            'keyword.operator': 'keyword.operator',
            'keyword.other.unit': 'keyword.other.unit',

            constant: 'constant',
            'constant.language': 'constant.language',
            'constant.library': 'constant.library',
            'constant.numeric': 'constant.numeric',
            'constant.character': 'constant.character',
            'constant.character.escape': 'constant.character.escape',
            'constant.character.entity': 'constant.character.entity',
            'constant.other': 'constant.other',

            support: 'support',
            'support.function': 'support.function',
            'support.function.dom': 'support.function.dom',
            'support.function.firebug': 'support.firebug',
            'support.function.constant': 'support.function.constant',
            'support.constant': 'support.constant',
            'support.constant.property-value':
                'support.constant.property-value',
            'support.class': 'support.class',
            'support.type': 'support.type',
            'support.other': 'support.other',

            function: 'function',
            'function.buildin': 'function.buildin',

            storage: 'storage',
            'storage.type': 'storage.type',

            invalid: 'invalid',
            'invalid.illegal': 'invalid.illegal',
            'invalid.deprecated': 'invalid.deprecated',

            string: 'string',
            'string.regexp': 'string.regexp',

            comment: 'comment',
            'comment.line': 'comment',
            'comment.block': 'comment',
            'comment.documentation': 'comment.doc',
            'comment.documentation.tag': 'comment.doc.tag',

            variable: 'variable',
            'variable.language': 'variable.language',
            'variable.parameter': 'variable.parameter',

            meta: 'meta',
            'meta.tag.sgml.doctype': 'xml-pe',
            'meta.tag': 'meta.tag',
            'meta.selector': 'meta.selector',

            'entity.other.attribute-name': 'entity.other.attribute-name',
            'entity.name.function': 'entity.name.function',
            'entity.name': 'entity.name',
            'entity.name.tag': 'entity.name.tag',

            'markup.heading': 'markup.heading',
            'markup.heading.1': 'markup.heading.1',
            'markup.heading.2': 'markup.heading.2',
            'markup.heading.3': 'markup.heading.3',
            'markup.heading.4': 'markup.heading.4',
            'markup.heading.5': 'markup.heading.5',
            'markup.heading.6': 'markup.heading.6',
            'markup.list': 'markup.list',

            'collab.user1': 'collab.user1',
        };
        /* Map missing rules to their fallbacks */
        var fallbackScopes = {
            keyword: 'meta',
            'support.type': 'storage.type',
            variable: 'entity.name.function',
            // identifier: 'variable',
            'entity.name.function': 'variable',
        };
        var languageId = /\.(?:js|php|css|scss|xml|java|cpp|c)$/;
        function toSupported(token) {
            return supportedScopes[token.replace(languageId, '')];
        }
        function toAce(token) {
            return 'ace_' + token;
        }

        function toRule(scope) {
            return '.' + name + ' .' + scope.split('.').map(toAce).join('.');
        }
        var needed = Object.keys(fallbackScopes);
        return colors
            .map(function (e) {
                var header;
                if (!e.scope) {
                    header = toRule('line');
                } else {
                    var scopes =
                        typeof e.scope == 'string' ? [e.scope] : e.scope;
                    scopes = scopes.map(toSupported).filter(Boolean);
                    for (var j = 0; j < needed.length; j++) {
                        var i = needed[j];
                        if (
                            scopes.indexOf(i) > -1 ||
                            (scopes.indexOf(fallbackScopes[i]) > -1 &&
                                scopes.push(i))
                        )
                            needed.splice(j--, 1);
                    }
                    if (scopes.length === 0) return;
                    header = scopes.map(toRule).join(',');
                }

                var body = '';
                var settings = e.settings;
                if (settings) {
                    if (settings.foreground) {
                        body += 'color:' + settings.foreground + ';';
                    }
                    if (settings.background) {
                        body += 'background-color:' + settings.background + ';';
                    }
                    if (settings.fontStyle != undefined) {
                        if (!settings.fontStyle) {
                            body +=
                                'font-weight:normal;font-style:normal;text-decoration:none;';
                        } else {
                            if (settings.fontStyle.indexOf('bold') > -1)
                                body += 'font-weight: bold;';
                            if (settings.fontStyle.indexOf('italic') > -1)
                                body += 'font-style: italic;';
                            if (settings.fontStyle.indexOf('underline') > -1)
                                body += 'text-decoration: underline;';
                        }
                    }
                    return header + '{' + body + '}';
                } else return '';
            })
            .join('\n');
    }
    exports.ThemeGen = {
        vs: function (json, id) {
            var defaults = {
                'editorRuler.foreground': '#e8e8e8',
                'editor.inactiveSelectionBackground': 'rgb(181, 213, 255)',
                'editor.selectionHighlightBackground':
                    'rgba(128, 128, 0, 0.07)',
                'colors.step': 'rgb(198, 219, 174)',
                'colors.fold': '#6b72e6',
                'editor.lineHighlightBackground': 'rgba(0, 0, 0, 0.07)',
                'editorWhitespace.foreground':
                    json.type === 'dark'
                        ? 'rgba(191, 191, 191, 0.5)'
                        : 'rgb(191, 191, 191)',
            };
            var colors = json.colors;
            var m = Object.keys(colors);
            for (var t in m) {
                //fix case issues
                colors[m[t].toLowerCase()] = colors[m[t]];
            }
            colors.none = 'none';
            colors.inherit = 'inherit';
            colors.transparent = 'transparent';
            if (!colors.foreground && colors['sideBar.foreground']) {
                colors.foreground =
                    json.type === 'dark'
                        ? colors['sideBar.foreground']
                        : '#' +
                          light(0.1, parseColor(colors['sideBar.foreground']))
                              .map(function (e, i) {
                                  e = Math.round(e);
                                  if (i === 3) {
                                      if (e === 1) return '';
                                      e *= 255;
                                  }
                                  return (e < 16 ? '0' : '') + e.toString(16);
                              })
                              .join('');
            }
            for (var i in defaults) {
                if (!colors[i]) colors[i] = defaults[i];
            }
            var regex = /^(.*)['"]\@([A-Za-z0-9_\-\+\|\.\#]+)['"];?/gm;
            var missingRules = [];

            var styles = template
                .replace(regex, function (match, prefix, type) {
                    var options = type.toLowerCase().split('|');
                    for (var i in options) {
                        var expr = options[i];
                        var lighten = 0,
                            fade = 0;
                        for (var j = 0; j < expr.length; j++) {
                            switch (expr[j]) {
                                case '-':
                                    lighten++;
                                    continue;
                                case '+':
                                    lighten--;
                                    continue;
                                case '*':
                                    fade++;
                                    continue;
                            }
                            break;
                        }
                        if (j > 0) expr = expr.substring(j);
                        if (colors[expr]) {
                            expr = colors[expr];
                            if (!lighten && !fade) return prefix + expr + ';';
                        }
                        if (expr[0] == '#') {
                            if (lighten) {
                                expr = parseColor(expr);
                                var pow = (lighten * lighten) / 100;
                                var func = lighten > 0 ? light : tint;
                                expr = func(pow, expr);
                                if (fade) expr[3] *= Math.pow(0.75, fade);
                                expr = printColor(expr);
                            }
                            return prefix + expr + ';';
                        }
                    }
                    missingRules.push(type.replace(/[\-\+\*]/g, ''));
                    return '';
                })
                .replace(/\btheme\-vs/g, 'theme-' + id)
                .replace(/\bace\-vs/g, 'ace-' + id + '-theme');
            if (Array.isArray(json.tokenColors)) {
                styles +=
                    '\n' +
                    generateTokens(json.tokenColors, 'ace-' + id + '-theme');
            }
            if (missingRules.length) {
                console.warn(
                    'The following rules are missing from ' +
                        (json.name || 'this') +
                        ' theme ' +
                        missingRules.sort().join('\n')
                );
            }
            var style = document.getElementById('vs_' + id);
            if (!style) {
                style = document.createElement('style');
                style.id = 'vs_' + id;
                style.innerHTML = styles;
                document.head.appendChild(style);
            } else style.innerHTML = styles;
        },
        light: light,
        tint: tint,
        parse: parseColor,
    };
});