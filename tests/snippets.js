(function(global) {
    global.Snippets = {
        "listGlobals": {
            exec: function(window) {
                var globals = Object.keys(window);
                return globals.slice(globals.indexOf("ontouchstart"));
            }
        },
        "detectGlobals": {
            exec: function(window, time) {
                time = time || 10000;
                var globals = localStorage.getItem('d-globals');
                if (!globals || !confirm('Use previously detected globals')) {
                    alert('Globals will be detected in ' + (time / 1000) + 's. Reload page after that');
                    setTimeout(function() {
                        globals = global.Snippets.listGlobals.exec(window);
                        localStorage.setItem('d-globals', JSON.stringify(globals));
                        alert('Globals saved');
                    }, time);
                    return;
                }
                globals = JSON.parse(globals);

                globals.forEach(function(a, i) {
                    if (window.hasOwnProperty(globals[i])) {
                        console.log(globals[i] + " already defined");
                    }
                    else {
                        Object.defineProperty(window, globals[i], {
                            get: function() {
                                return undefined;
                            },
                            set: function(val) {
                                console.log(globals[i] + " set at file\n", new Error().stack.split("\n").slice(2).join("\n"));
                                Object.defineProperty(window, globals[i], {
                                    value: val,
                                    configurable: true,
                                    writable: true
                                });
                            },
                            configurable: true,
                        });
                    }
                });
            }
        },
        "listCssRules": {
            exec: function(window, filter) {
                function parseStyle(style, rule) {
                    if (!style) {
                        console.log(rule);
                        return;
                    }
                    var t = {};
                    for (var i = 0; i < style.length; i++) {
                        t[style[i]] = style[style[i]];
                    }
                    return t;
                }

                function parseRules(rules) {
                    var css = [];
                    for (var i = 0; i < rules.length; i++) {
                        var a = {
                            selector: rules[i].selectorText,
                        };
                        if (rules[i].media) {
                            a.media = {
                                media: rules[i].media,
                                condition: rules[i].conditionText,
                                rules: parseRules(rules[i].cssRules)
                            };
                        }
                        else if (rules[i].cssRules) {
                            a.rules = parseRules(rules[i].cssRules);
                        }
                        else a.style = parseStyle(rules[i].style, rules[i]);
                        css.push(a);
                    }
                    return css;
                }
                var styles = document.querySelectorAll("style,link");
                var sheets = {};
                for (var i = 0; i < styles.length; i++) {
                    if (!styles[i].sheet) continue;
                    var name = styles[i].href || styles[i].id || "style-" + i;
                    if (filter && name.indexOf(filter) < 0) continue;
                    var a = parseRules(styles[i].sheet.rules);
                    sheets[name] = a;
                }
                return sheets;
            }
        },
        getUnusedCss: {
            exec: function(window, name) {
                var sheets = Snippets.listCssRules.exec(window, name);
                var text = [];
        
                
                var slimmed;
                function slim(t,i) {
                    if (!t.style) {
                    }
                    else {
                        var filterStyle = t.style;
                        var selector = t.selector;
                        var el = document.querySelector(selector);
                        if(!el){
                            text.push(selector);
                        }
                    }
                }
                for (var i in sheets) {
                    sheets[i].forEach(slim);
                }
                return text;
            }
        },
        "listClasses": {
            exec: function(window) {
                var els = document.querySelectorAll("*");
                var result = {};
                result["Total elements"] = els.length;
                var m = result.AggregateClasses = {};
                for (var i = 0; i < els.length; i++) {
                    var t = els[i].className.replace(/\s+/g, " ").replace(/^\s|\s$/g, "");
                    if (!t) {
                        t = els[i].tagName;
                    }
                    t = t.split(" ");
                    for (var c in t) {
                        if (result[t[c]]) {
                            result[t[c]]++;
                        }
                        else result[t[c]] = 1;
                    }
                    var aggregate = "." + (t.sort().join("."));
                    if (m[aggregate]) {
                        m[aggregate]++;
                    }
                    else m[aggregate] = 1;
                }
                return result;
            }
        }
    };
})(window);