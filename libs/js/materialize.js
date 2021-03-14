/*!
 * Materialize v1.0.0-rc.1 (http://materializecss.com)
 * Copyright 2014-2017 Materialize
 * MIT License (https://raw.githubusercontent.com/Dogfalo/materialize/master/LICENSE)
 */

var M = {};
(function(M) {
    // AMD
    if (typeof define === 'function' && define.amd) {
        define('M', [], function() {
            return M;
        });

        // Common JS
    } else if (typeof exports !== 'undefined' && !exports.nodeType) {
        if (typeof module !== 'undefined' && !module.nodeType && module.exports) {
            exports = module.exports = M;
        }
        exports.default = M;
    } else {
        window.M = M;
    }
})(M);
var $jscomp = {
    scope: {}
};
$jscomp.defineProperty = "function" == typeof Object.defineProperties ? Object.defineProperty : function(e, r, p) {
    if (p.get || p.set) throw new TypeError("ES3 does not support getters and setters.");
    e != Array.prototype && e != Object.prototype && (e[r] = p.value);
};
$jscomp.getGlobal = function(e) {
    return "undefined" != typeof window && window === e ? e : "undefined" != typeof global && null != global ? global : e;
};
$jscomp.global = $jscomp.getGlobal(this);
$jscomp.SYMBOL_PREFIX = "jscomp_symbol_";
$jscomp.initSymbol = function() {
    $jscomp.initSymbol = function() {};
    $jscomp.global.Symbol || ($jscomp.global.Symbol = $jscomp.Symbol);
};
$jscomp.symbolCounter_ = 0;
$jscomp.Symbol = function(e) {
    return $jscomp.SYMBOL_PREFIX + (e || "") + $jscomp.symbolCounter_++;
};
$jscomp.initSymbolIterator = function() {
    $jscomp.initSymbol();
    var e = $jscomp.global.Symbol.iterator;
    e || (e = $jscomp.global.Symbol.iterator = $jscomp.global.Symbol("iterator"));
    "function" != typeof Array.prototype[e] && $jscomp.defineProperty(Array.prototype, e, {
        configurable: !0,
        writable: !0,
        value: function() {
            return $jscomp.arrayIterator(this);
        }
    });
    $jscomp.initSymbolIterator = function() {};
};
$jscomp.arrayIterator = function(e) {
    var r = 0;
    return $jscomp.iteratorPrototype(function() {
        return r < e.length ? {
            done: !1,
            value: e[r++]
        } : {
            done: !0
        };
    });
};
$jscomp.iteratorPrototype = function(e) {
    $jscomp.initSymbolIterator();
    e = {
        next: e
    };
    e[$jscomp.global.Symbol.iterator] = function() {
        return this;
    };
    return e;
};
$jscomp.array = $jscomp.array || {};
$jscomp.iteratorFromArray = function(e, r) {
    $jscomp.initSymbolIterator();
    e instanceof String && (e += "");
    var p = 0,
        m = {
            next: function() {
                if (p < e.length) {
                    var u = p++;
                    return {
                        value: r(u, e[u]),
                        done: !1
                    };
                }
                m.next = function() {
                    return {
                        done: !0,
                        value: void 0
                    };
                };
                return m.next();
            }
        };
    m[Symbol.iterator] = function() {
        return m;
    };
    return m;
};
$jscomp.polyfill = function(e, r, p, m) {
    if (r) {
        p = $jscomp.global;
        e = e.split(".");
        for (m = 0; m < e.length - 1; m++) {
            var u = e[m];
            u in p || (p[u] = {});
            p = p[u];
        }
        e = e[e.length - 1];
        m = p[e];
        r = r(m);
        r != m && null != r && $jscomp.defineProperty(p, e, {
            configurable: !0,
            writable: !0,
            value: r
        });
    }
};
$jscomp.polyfill("Array.prototype.keys", function(e) {
    return e ? e : function() {
        return $jscomp.iteratorFromArray(this, function(e) {
            return e;
        });
    };
}, "es6-impl", "es3");
var $jscomp$this = this;

//M.anime
(function(r) {
    M.anime = r();
})(function() {
    function e(a) {
        if (!h.col(a)) try {
            return document.querySelectorAll(a);
        }
        catch (c) {}
    }

    function r(a, c) {
        for (var d = a.length, b = 2 <= arguments.length ? arguments[1] : void 0, f = [], n = 0; n < d; n++) {
            if (n in a) {
                var k = a[n];
                c.call(b, k, n, a) && f.push(k);
            }
        }
        return f;
    }

    function p(a) {
        return a.reduce(function(a, d) {
            return a.concat(h.arr(d) ? p(d) : d);
        }, []);
    }

    function m(a) {
        if (h.arr(a)) return a;
        h.str(a) && (a = e(a) || a);
        return a instanceof NodeList || a instanceof HTMLCollection ? [].slice.call(a) : [a];
    }

    function u(a, c) {
        return a.some(function(a) {
            return a === c;
        });
    }

    function C(a) {
        var c = {},
            d;
        for (d in a) {
            c[d] = a[d];
        }
        return c;
    }

    function D(a, c) {
        var d = C(a),
            b;
        for (b in a) {
            d[b] = c.hasOwnProperty(b) ? c[b] : a[b];
        }
        return d;
    }

    function z(a, c) {
        var d = C(a),
            b;
        for (b in c) {
            d[b] = h.und(a[b]) ? c[b] : a[b];
        }
        return d;
    }

    function T(a) {
        a = a.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, function(a, c, d, k) {
            return c + c + d + d + k + k;
        });
        var c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(a);
        a = parseInt(c[1], 16);
        var d = parseInt(c[2], 16),
            c = parseInt(c[3], 16);
        return "rgba(" + a + "," + d + "," + c + ",1)";
    }

    function U(a) {
        function c(a, c, b) {
            0 > b && (b += 1);
            1 < b && --b;
            return b < 1 / 6 ? a + 6 * (c - a) * b : .5 > b ? c : b < 2 / 3 ? a + (c - a) * (2 / 3 - b) * 6 : a;
        }
        var d = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(a) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(a);
        a = parseInt(d[1]) / 360;
        var b = parseInt(d[2]) / 100,
            f = parseInt(d[3]) / 100,
            d = d[4] || 1;
        if (0 == b) f = b = a = f;
        else {
            var n = .5 > f ? f * (1 + b) : f + b - f * b,
                k = 2 * f - n,
                f = c(k, n, a + 1 / 3),
                b = c(k, n, a);
            a = c(k, n, a - 1 / 3);
        }
        return "rgba(" + 255 * f + "," + 255 * b + "," + 255 * a + "," + d + ")";
    }

    function y(a) {
        if (a = /([\+\-]?[0-9#\.]+)(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(a)) return a[2];
    }

    function V(a) {
        if (-1 < a.indexOf("translate") || "perspective" === a) return "px";
        if (-1 < a.indexOf("rotate") || -1 < a.indexOf("skew")) return "deg";
    }

    function I(a, c) {
        return h.fnc(a) ? a(c.target, c.id, c.total) : a;
    }

    function E(a, c) {
        if (c in a.style) return getComputedStyle(a).getPropertyValue(c.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()) || "0";
    }

    function J(a, c) {
        if (h.dom(a) && u(W, c)) return "transform";
        if (h.dom(a) && (a.getAttribute(c) || h.svg(a) && a[c])) return "attribute";
        if (h.dom(a) && "transform" !== c && E(a, c)) return "css";
        if (null != a[c]) return "object";
    }

    function X(a, c) {
        var d = V(c),
            d = -1 < c.indexOf("scale") ? 1 : 0 + d;
        a = a.style.transform;
        if (!a) return d;
        for (var b = [], f = [], n = [], k = /(\w+)\((.+?)\)/g; b = k.exec(a);) {
            f.push(b[1]), n.push(b[2]);
        }
        a = r(n, function(a, b) {
            return f[b] === c;
        });
        return a.length ? a[0] : d;
    }

    function K(a, c) {
        switch (J(a, c)) {
            case "transform":
                return X(a, c);
            case "css":
                return E(a, c);
            case "attribute":
                return a.getAttribute(c);
        }
        return a[c] || 0;
    }

    function L(a, c) {
        var d = /^(\*=|\+=|-=)/.exec(a);
        if (!d) return a;
        var b = y(a) || 0;
        c = parseFloat(c);
        a = parseFloat(a.replace(d[0], ""));
        switch (d[0][0]) {
            case "+":
                return c + a + b;
            case "-":
                return c - a + b;
            case "*":
                return c * a + b;
        }
    }

    function F(a, c) {
        return Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
    }

    function M(a) {
        a = a.points;
        for (var c = 0, d, b = 0; b < a.numberOfItems; b++) {
            var f = a.getItem(b);
            0 < b && (c += F(d, f));
            d = f;
        }
        return c;
    }

    function N(a) {
        if (a.getTotalLength) return a.getTotalLength();
        switch (a.tagName.toLowerCase()) {
            case "circle":
                return 2 * Math.PI * a.getAttribute("r");
            case "rect":
                return 2 * a.getAttribute("width") + 2 * a.getAttribute("height");
            case "line":
                return F({
                    x: a.getAttribute("x1"),
                    y: a.getAttribute("y1")
                }, {
                    x: a.getAttribute("x2"),
                    y: a.getAttribute("y2")
                });
            case "polyline":
                return M(a);
            case "polygon":
                var c = a.points;
                return M(a) + F(c.getItem(c.numberOfItems - 1), c.getItem(0));
        }
    }

    function Y(a, c) {
        function d(b) {
            b = void 0 === b ? 0 : b;
            return a.el.getPointAtLength(1 <= c + b ? c + b : 0);
        }
        var b = d(),
            f = d(-1),
            n = d(1);
        switch (a.property) {
            case "x":
                return b.x;
            case "y":
                return b.y;
            case "angle":
                return 180 * Math.atan2(n.y - f.y, n.x - f.x) / Math.PI;
        }
    }

    function O(a, c) {
        var d = /-?\d*\.?\d+/g,
            b;
        b = h.pth(a) ? a.totalLength : a;
        if (h.col(b)) {
            if (h.rgb(b)) {
                var f = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(b);
                b = f ? "rgba(" + f[1] + ",1)" : b;
            } else b = h.hex(b) ? T(b) : h.hsl(b) ? U(b) : void 0;
        } else f = (f = y(b)) ? b.substr(0, b.length - f.length) : b, b = c && !/\s/g.test(b) ? f + c : f;
        b += "";
        return {
            original: b,
            numbers: b.match(d) ? b.match(d).map(Number) : [0],
            strings: h.str(a) || c ? b.split(d) : []
        };
    }

    function P(a) {
        a = a ? p(h.arr(a) ? a.map(m) : m(a)) : [];
        return r(a, function(a, d, b) {
            return b.indexOf(a) === d;
        });
    }

    function Z(a) {
        var c = P(a);
        return c.map(function(a, b) {
            return {
                target: a,
                id: b,
                total: c.length
            };
        });
    }

    function aa(a, c) {
        var d = C(c);
        if (h.arr(a)) {
            var b = a.length;
            2 !== b || h.obj(a[0]) ? h.fnc(c.duration) || (d.duration = c.duration / b) : a = {
                value: a
            };
        }
        return m(a).map(function(a, b) {
            b = b ? 0 : c.delay;
            a = h.obj(a) && !h.pth(a) ? a : {
                value: a
            };
            h.und(a.delay) && (a.delay = b);
            return a;
        }).map(function(a) {
            return z(a, d);
        });
    }

    function ba(a, c) {
        var d = {},
            b;
        for (b in a) {
            var f = I(a[b], c);
            h.arr(f) && (f = f.map(function(a) {
                return I(a, c);
            }), 1 === f.length && (f = f[0]));
            d[b] = f;
        }
        d.duration = parseFloat(d.duration);
        d.delay = parseFloat(d.delay);
        return d;
    }

    function ca(a) {
        return h.arr(a) ? A.apply(this, a) : Q[a];
    }

    function da(a, c) {
        var d;
        return a.tweens.map(function(b) {
            b = ba(b, c);
            var f = b.value,
                e = K(c.target, a.name),
                k = d ? d.to.original : e,
                k = h.arr(f) ? f[0] : k,
                w = L(h.arr(f) ? f[1] : f, k),
                e = y(w) || y(k) || y(e);
            b.from = O(k, e);
            b.to = O(w, e);
            b.start = d ? d.end : a.offset;
            b.end = b.start + b.delay + b.duration;
            b.easing = ca(b.easing);
            b.elasticity = (1E3 - Math.min(Math.max(b.elasticity, 1), 999)) / 1E3;
            b.isPath = h.pth(f);
            b.isColor = h.col(b.from.original);
            b.isColor && (b.round = 1);
            return d = b;
        });
    }

    function ea(a, c) {
        return r(p(a.map(function(a) {
            return c.map(function(b) {
                var c = J(a.target, b.name);
                if (c) {
                    var d = da(b, a);
                    b = {
                        type: c,
                        property: b.name,
                        animatable: a,
                        tweens: d,
                        duration: d[d.length - 1].end,
                        delay: d[0].delay
                    };
                } else b = void 0;
                return b;
            });
        })), function(a) {
            return !h.und(a);
        });
    }

    function R(a, c, d, b) {
        var f = "delay" === a;
        return c.length ? (f ? Math.min : Math.max).apply(Math, c.map(function(b) {
            return b[a];
        })) : f ? b.delay : d.offset + b.delay + b.duration;
    }

    function fa(a) {
        var c = D(ga, a),
            d = D(S, a),
            b = Z(a.targets),
            f = [],
            e = z(c, d),
            k;
        for (k in a) {
            e.hasOwnProperty(k) || "targets" === k || f.push({
                name: k,
                offset: e.offset,
                tweens: aa(a[k], d)
            });
        }
        a = ea(b, f);
        return z(c, {
            children: [],
            animatables: b,
            animations: a,
            duration: R("duration", a, c, d),
            delay: R("delay", a, c, d)
        });
    }

    function q(a) {
        function c() {
            return window.Promise && new Promise(function(a) {
                return p = a;
            });
        }

        function d(a) {
            return g.reversed ? g.duration - a : a;
        }

        function b(a) {
            for (var b = 0, c = {}, d = g.animations, f = d.length; b < f;) {
                var e = d[b],
                    k = e.animatable,
                    h = e.tweens,
                    n = h.length - 1,
                    l = h[n];
                n && (l = r(h, function(b) {
                    return a < b.end;
                })[0] || l);
                for (var h = Math.min(Math.max(a - l.start - l.delay, 0), l.duration) / l.duration, w = isNaN(h) ? 1 : l.easing(h, l.elasticity), h = l.to.strings, p = l.round, n = [], m = void 0, m = l.to.numbers.length, t = 0; t < m; t++) {
                    var x = void 0,
                        x = l.to.numbers[t],
                        q = l.from.numbers[t],
                        x = l.isPath ? Y(l.value, w * x) : q + w * (x - q);
                    p && (l.isColor && 2 < t || (x = Math.round(x * p) / p));
                    n.push(x);
                }
                if (l = h.length)
                    for (m = h[0], w = 0; w < l; w++) {
                        p = h[w + 1], t = n[w], isNaN(t) || (m = p ? m + (t + p) : m + (t + " "));
                    }
                else m = n[0];
                ha[e.type](k.target, e.property, m, c, k.id);
                e.currentValue = m;
                b++;
            }
            if (b = Object.keys(c).length)
                for (d = 0; d < b; d++) {
                    H || (H = E(document.body, "transform") ? "transform" : "-webkit-transform"), g.animatables[d].target.style[H] = c[d].join(" ");
                }
            g.currentTime = a;
            g.progress = a / g.duration * 100;
        }

        function f(a) {
            if (g[a]) g[a](g);
        }

        function e() {
            g.remaining && !0 !== g.remaining && g.remaining--;
        }

        function k(a) {
            var k = g.duration,
                n = g.offset,
                w = n + g.delay,
                r = g.currentTime,
                x = g.reversed,
                q = d(a);
            if (g.children.length) {
                var u = g.children,
                    v = u.length;
                if (q >= g.currentTime)
                    for (var G = 0; G < v; G++) {
                        u[G].seek(q);
                    }
                else
                    for (; v--;) {
                        u[v].seek(q);
                    }
            }
            if (q >= w || !k) g.began || (g.began = !0, f("begin")), f("run");
            if (q > n && q < k) b(q);
            else if (q <= n && 0 !== r && (b(0), x && e()), q >= k && r !== k || !k) b(k), x || e();
            f("update");
            a >= k && (g.remaining ? (t = h, "alternate" === g.direction && (g.reversed = !g.reversed)) : (g.pause(), g.completed || (g.completed = !0, f("complete"), "Promise" in window && (p(), m = c()))), l = 0);
        }
        a = void 0 === a ? {} : a;
        var h,
            t,
            l = 0,
            p = null,
            m = c(),
            g = fa(a);
        g.reset = function() {
            var a = g.direction,
                c = g.loop;
            g.currentTime = 0;
            g.progress = 0;
            g.paused = !0;
            g.began = !1;
            g.completed = !1;
            g.reversed = "reverse" === a;
            g.remaining = "alternate" === a && 1 === c ? 2 : c;
            b(0);
            for (a = g.children.length; a--;) {
                g.children[a].reset();
            }
        };
        g.tick = function(a) {
            h = a;
            t || (t = h);
            k((l + h - t) * q.speed);
        };
        g.seek = function(a) {
            k(d(a));
        };
        g.pause = function() {
            var a = v.indexOf(g); - 1 < a && v.splice(a, 1);
            g.paused = !0;
        };
        g.play = function() {
            g.paused && (g.paused = !1, t = 0, l = d(g.currentTime), v.push(g), B || ia());
        };
        g.reverse = function() {
            g.reversed = !g.reversed;
            t = 0;
            l = d(g.currentTime);
        };
        g.restart = function() {
            g.pause();
            g.reset();
            g.play();
        };
        g.finished = m;
        g.reset();
        g.autoplay && g.play();
        return g;
    }
    var ga = {
            update: void 0,
            begin: void 0,
            run: void 0,
            complete: void 0,
            loop: 1,
            direction: "normal",
            autoplay: !0,
            offset: 0
        },
        S = {
            duration: 1E3,
            delay: 0,
            easing: "easeOutElastic",
            elasticity: 500,
            round: 0
        },
        W = "translateX translateY translateZ rotate rotateX rotateY rotateZ scale scaleX scaleY scaleZ skewX skewY perspective".split(" "),
        H,
        h = {
            arr: function(a) {
                return Array.isArray(a);
            },
            obj: function(a) {
                return -1 < Object.prototype.toString.call(a).indexOf("Object");
            },
            pth: function(a) {
                return h.obj(a) && a.hasOwnProperty("totalLength");
            },
            svg: function(a) {
                return a instanceof SVGElement;
            },
            dom: function(a) {
                return a.nodeType || h.svg(a);
            },
            str: function(a) {
                return "string" === typeof a;
            },
            fnc: function(a) {
                return "function" === typeof a;
            },
            und: function(a) {
                return "undefined" === typeof a;
            },
            hex: function(a) {
                return (/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a));
            },
            rgb: function(a) {
                return (/^rgb/.test(a));
            },
            hsl: function(a) {
                return (/^hsl/.test(a));
            },
            col: function(a) {
                return h.hex(a) || h.rgb(a) || h.hsl(a);
            }
        },
        A = function() {
            function a(a, d, b) {
                return (((1 - 3 * b + 3 * d) * a + (3 * b - 6 * d)) * a + 3 * d) * a;
            }
            return function(c, d, b, f) {
                if (0 <= c && 1 >= c && 0 <= b && 1 >= b) {
                    var e = new Float32Array(11);
                    if (c !== d || b !== f)
                        for (var k = 0; 11 > k; ++k) {
                            e[k] = a(.1 * k, c, b);
                        }
                    return function(k) {
                        if (c === d && b === f) return k;
                        if (0 === k) return 0;
                        if (1 === k) return 1;
                        for (var h = 0, l = 1; 10 !== l && e[l] <= k; ++l) {
                            h += .1;
                        }--l;
                        var l = h + (k - e[l]) / (e[l + 1] - e[l]) * .1,
                            n = 3 * (1 - 3 * b + 3 * c) * l * l + 2 * (3 * b - 6 * c) * l + 3 * c;
                        if (.001 <= n) {
                            for (h = 0; 4 > h; ++h) {
                                n = 3 * (1 - 3 * b + 3 * c) * l * l + 2 * (3 * b - 6 * c) * l + 3 * c;
                                if (0 === n) break;
                                var m = a(l, c, b) - k,
                                    l = l - m / n;
                            }
                            k = l;
                        } else if (0 === n) k = l;
                        else {
                            var l = h,
                                h = h + .1,
                                g = 0;
                            do {
                                m = l + (h - l) / 2, n = a(m, c, b) - k, 0 < n ? h = m : l = m;
                            } while (1e-7 < Math.abs(n) && 10 > ++g);
                            k = m;
                        }
                        return a(k, d, f);
                    };
                }
            };
        }(),
        Q = function() {
            function a(a, b) {
                return 0 === a || 1 === a ? a : -Math.pow(2, 10 * (a - 1)) * Math.sin(2 * (a - 1 - b / (2 * Math.PI) * Math.asin(1)) * Math.PI / b);
            }
            var c = "Quad Cubic Quart Quint Sine Expo Circ Back Elastic".split(" "),
                d = {
                    In: [
                        [.55, .085, .68, .53],
                        [.55, .055, .675, .19],
                        [.895, .03, .685, .22],
                        [.755, .05, .855, .06],
                        [.47, 0, .745, .715],
                        [.95, .05, .795, .035],
                        [.6, .04, .98, .335],
                        [.6, -.28, .735, .045], a
                    ],
                    Out: [
                        [.25, .46, .45, .94],
                        [.215, .61, .355, 1],
                        [.165, .84, .44, 1],
                        [.23, 1, .32, 1],
                        [.39, .575, .565, 1],
                        [.19, 1, .22, 1],
                        [.075, .82, .165, 1],
                        [.175, .885, .32, 1.275],
                        function(b, c) {
                            return 1 - a(1 - b, c);
                        }
                    ],
                    InOut: [
                        [.455, .03, .515, .955],
                        [.645, .045, .355, 1],
                        [.77, 0, .175, 1],
                        [.86, 0, .07, 1],
                        [.445, .05, .55, .95],
                        [1, 0, 0, 1],
                        [.785, .135, .15, .86],
                        [.68, -.55, .265, 1.55],
                        function(b, c) {
                            return .5 > b ? a(2 * b, c) / 2 : 1 - a(-2 * b + 2, c) / 2;
                        }
                    ]
                },
                b = {
                    linear: A(.25, .25, .75, .75)
                },
                f = {},
                e;
            for (e in d) {
                f.type = e, d[f.type].forEach(function(a) {
                    return function(d, f) {
                        b["ease" + a.type + c[f]] = h.fnc(d) ? d : A.apply($jscomp$this, d);
                    };
                }(f)), f = {
                    type: f.type
                };
            }
            return b;
        }(),
        ha = {
            css: function(a, c, d) {
                return a.style[c] = d;
            },
            attribute: function(a, c, d) {
                return a.setAttribute(c, d);
            },
            object: function(a, c, d) {
                return a[c] = d;
            },
            transform: function(a, c, d, b, f) {
                b[f] || (b[f] = []);
                b[f].push(c + "(" + d + ")");
            }
        },
        v = [],
        B = 0,
        ia = function() {
            function a() {
                B = requestAnimationFrame(c);
            }

            function c(c) {
                var b = v.length;
                if (b) {
                    for (var d = 0; d < b;) {
                        v[d] && v[d].tick(c), d++;
                    }
                    a();
                } else cancelAnimationFrame(B), B = 0;
            }
            return a;
        }();
    q.version = "2.2.0";
    q.speed = 1;
    q.running = v;
    q.remove = function(a) {
        a = P(a);
        for (var c = v.length; c--;) {
            for (var d = v[c], b = d.animations, f = b.length; f--;) {
                u(a, b[f].animatable.target) && (b.splice(f, 1), b.length || d.pause());
            }
        }
    };
    q.getValue = K;
    q.path = function(a, c) {
        var d = h.str(a) ? e(a)[0] : a,
            b = c || 100;
        return function(a) {
            return {
                el: d,
                property: a,
                totalLength: N(d) * (b / 100)
            };
        };
    };
    q.setDashoffset = function(a) {
        var c = N(a);
        a.setAttribute("stroke-dasharray", c);
        return c;
    };
    q.bezier = A;
    q.easings = Q;
    q.timeline = function(a) {
        var c = q(a);
        c.pause();
        c.duration = 0;
        c.add = function(d) {
            c.children.forEach(function(a) {
                a.began = !0;
                a.completed = !0;
            });
            m(d).forEach(function(b) {
                var d = z(b, D(S, a || {}));
                d.targets = d.targets || a.targets;
                b = c.duration;
                var e = d.offset;
                d.autoplay = !1;
                d.direction = c.direction;
                d.offset = h.und(e) ? b : L(e, b);
                c.began = !0;
                c.completed = !0;
                c.seek(d.offset);
                d = q(d);
                d.began = !0;
                d.completed = !0;
                d.duration > b && (c.duration = d.duration);
                c.children.push(d);
            });
            c.seek(0);
            c.reset();
            c.autoplay && c.restart();
            return c;
        };
        return c;
    };
    q.random = function(a, c) {
        return Math.floor(Math.random() * (c - a + 1)) + a;
    };
    return q;
});

//Waves
(function(window) {
    'use strict';

    var Waves = Waves || {};
    var $$ = document.querySelectorAll.bind(document);

    // Find exact position of element
    function isWindow(obj) {
        return obj !== null && obj === obj.window;
    }

    function getWindow(elem) {
        return isWindow(elem) ? elem : elem.nodeType === 9 && elem.defaultView;
    }

    function offset(elem) {
        var docElem,
            win,
            box = {
                top: 0,
                left: 0
            },
            doc = elem && elem.ownerDocument;

        docElem = doc.documentElement;

        if (typeof elem.getBoundingClientRect !== typeof undefined) {
            box = elem.getBoundingClientRect();
        }
        win = getWindow(doc);
        return {
            top: box.top + win.pageYOffset - docElem.clientTop,
            left: box.left + win.pageXOffset - docElem.clientLeft
        };
    }

    function convertStyle(obj) {
        var style = '';

        for (var a in obj) {
            if (obj.hasOwnProperty(a)) {
                style += a + ':' + obj[a] + ';';
            }
        }

        return style;
    }

    var Effect = {

        // Effect delay
        duration: 750,

        show: function(e, element) {

            // Disable right click
            if (e.button === 2) {
                return false;
            }

            var el = element || this;

            // Create ripple
            var ripple = document.createElement('div');
            ripple.className = 'waves-ripple';
            el.appendChild(ripple);

            // Get click coordinate and element witdh
            var pos = offset(el);
            var relativeY = e.pageY - pos.top;
            var relativeX = e.pageX - pos.left;
            var scale = 'scale(' + el.clientWidth / 100 * 10 + ')';

            // Support for touch devices
            if ('touches' in e) {
                relativeY = e.touches[0].pageY - pos.top;
                relativeX = e.touches[0].pageX - pos.left;
            }

            // Attach data to element
            ripple.setAttribute('data-hold', Date.now());
            ripple.setAttribute('data-scale', scale);
            ripple.setAttribute('data-x', relativeX);
            ripple.setAttribute('data-y', relativeY);

            // Set ripple position
            var rippleStyle = {
                'top': relativeY + 'px',
                'left': relativeX + 'px'
            };

            ripple.className = ripple.className + ' waves-notransition';
            ripple.setAttribute('style', convertStyle(rippleStyle));
            ripple.className = ripple.className.replace('waves-notransition', '');

            // Scale the ripple
            rippleStyle['-webkit-transform'] = scale;
            rippleStyle['-moz-transform'] = scale;
            rippleStyle['-ms-transform'] = scale;
            rippleStyle['-o-transform'] = scale;
            rippleStyle.transform = scale;
            rippleStyle.opacity = '1';

            rippleStyle['-webkit-transition-duration'] = Effect.duration + 'ms';
            rippleStyle['-moz-transition-duration'] = Effect.duration + 'ms';
            rippleStyle['-o-transition-duration'] = Effect.duration + 'ms';
            rippleStyle['transition-duration'] = Effect.duration + 'ms';

            rippleStyle['-webkit-transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
            rippleStyle['-moz-transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
            rippleStyle['-o-transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
            rippleStyle['transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';

            ripple.setAttribute('style', convertStyle(rippleStyle));
        },

        hide: function(e) {
            TouchHandler.touchup(e);

            var el = this;
            var width = el.clientWidth * 1.4;

            // Get first ripple
            var ripple = null;
            var ripples = el.getElementsByClassName('waves-ripple');
            if (ripples.length > 0) {
                ripple = ripples[ripples.length - 1];
            } else {
                return false;
            }

            var relativeX = ripple.getAttribute('data-x');
            var relativeY = ripple.getAttribute('data-y');
            var scale = ripple.getAttribute('data-scale');

            // Get delay beetween mousedown and mouse leave
            var diff = Date.now() - Number(ripple.getAttribute('data-hold'));
            var delay = 350 - diff;

            if (delay < 0) {
                delay = 0;
            }

            // Fade out ripple after delay
            setTimeout(function() {
                var style = {
                    'top': relativeY + 'px',
                    'left': relativeX + 'px',
                    'opacity': '0',

                    // Duration
                    '-webkit-transition-duration': Effect.duration + 'ms',
                    '-moz-transition-duration': Effect.duration + 'ms',
                    '-o-transition-duration': Effect.duration + 'ms',
                    'transition-duration': Effect.duration + 'ms',
                    '-webkit-transform': scale,
                    '-moz-transform': scale,
                    '-ms-transform': scale,
                    '-o-transform': scale,
                    'transform': scale
                };

                ripple.setAttribute('style', convertStyle(style));

                setTimeout(function() {
                    try {
                        el.removeChild(ripple);
                    } catch (e) {
                        return false;
                    }
                }, Effect.duration);
            }, delay);
        },

        // Little hack to make <input> can perform waves effect
        wrapInput: function(elements) {
            for (var a = 0; a < elements.length; a++) {
                var el = elements[a];

                if (el.tagName.toLowerCase() === 'input') {
                    var parent = el.parentNode;

                    // If input already have parent just pass through
                    if (parent.tagName.toLowerCase() === 'i' && parent.className.indexOf('waves-effect') !== -1) {
                        continue;
                    }

                    // Put element class and style to the specified parent
                    var wrapper = document.createElement('i');
                    wrapper.className = el.className + ' waves-input-wrapper';

                    var elementStyle = el.getAttribute('style');

                    if (!elementStyle) {
                        elementStyle = '';
                    }

                    wrapper.setAttribute('style', elementStyle);

                    el.className = 'waves-button-input';
                    el.removeAttribute('style');

                    // Put element as child
                    parent.replaceChild(wrapper, el);
                    wrapper.appendChild(el);
                }
            }
        }
    };

    /**
     * Disable mousedown event for 500ms during and after touch
     */
    var TouchHandler = {
        /* uses an integer rather than bool so there's no issues with
         * needing to clear timeouts if another touch event occurred
         * within the 500ms. Cannot mouseup between touchstart and
         * touchend, nor in the 500ms after touchend. */
        touches: 0,
        allowEvent: function(e) {
            var allow = true;

            if (e.type === 'touchstart') {
                TouchHandler.touches += 1; //push
            } else if (e.type === 'touchend' || e.type === 'touchcancel') {
                setTimeout(function() {
                    if (TouchHandler.touches > 0) {
                        TouchHandler.touches -= 1; //pop after 500ms
                    }
                }, 500);
            } else if (e.type === 'mousedown' && TouchHandler.touches > 0) {
                allow = false;
            }

            return allow;
        },
        touchup: function(e) {
            TouchHandler.allowEvent(e);
        }
    };

    /**
     * Delegated click handler for .waves-effect element.
     * returns null when .waves-effect element not in "click tree"
     */
    function getWavesEffectElement(e) {
        if (TouchHandler.allowEvent(e) === false) {
            return null;
        }

        var element = null;
        var target = e.target || e.srcElement;

        while (target.parentNode !== null) {
            if (!(target instanceof SVGElement) && target.className.indexOf('waves-effect') !== -1) {
                element = target;
                break;
            }
            target = target.parentNode;
        }
        return element;
    }

    /**
     * Bubble the click and show effect if .waves-effect elem was found
     */
    function showEffect(e) {
        var element = getWavesEffectElement(e);

        if (element !== null) {
            Effect.show(e, element);

            if ('ontouchstart' in window) {
                element.addEventListener('touchend', Effect.hide, false);
                element.addEventListener('touchcancel', Effect.hide, false);
            }

            element.addEventListener('mouseup', Effect.hide, false);
            element.addEventListener('mouseleave', Effect.hide, false);
            element.addEventListener('dragend', Effect.hide, false);
        }
    }

    Waves.displayEffect = function(options) {
        options = options || {};

        if ('duration' in options) {
            Effect.duration = options.duration;
        }

        //Wrap input inside <i> tag
        Effect.wrapInput($$('.waves-effect'));

        if ('ontouchstart' in window) {
            document.body.addEventListener('touchstart', showEffect, false);
        }

        document.body.addEventListener('mousedown', showEffect, false);
    };

    /**
     * Attach Waves to an input element (or any element which doesn't
     * bubble mouseup/mousedown events).
     *   Intended to be used with dynamically loaded forms/inputs, or
     * where the user doesn't want a delegated click handler.
     */
    Waves.attach = function(element) {
        //FUTURE: automatically add waves classes and allow users
        // to specify them with an options param? Eg. light/classic/button
        if (element.tagName.toLowerCase() === 'input') {
            Effect.wrapInput([element]);
            element = element.parentNode;
        }

        if ('ontouchstart' in window) {
            element.addEventListener('touchstart', showEffect, false);
        }

        element.addEventListener('mousedown', showEffect, false);
    };

    window.Waves = Waves;

    document.addEventListener('DOMContentLoaded', function() {
        Waves.displayEffect();
    }, false);
})(window);

(function() {
    M.jQueryLoaded = !!window.jQuery;

    var _get = function get(object, property, receiver) {
        if (object === null) object = Function.prototype;
        var desc = Object.getOwnPropertyDescriptor(object, property);
        if (desc === undefined) {
            var parent = Object.getPrototypeOf(object);
            if (parent === null) {
                return undefined;
            } else {
                return get(parent, property, receiver);
            }
        } else if ("value" in desc) {
            return desc.value;
        } else {
            var getter = desc.get;
            if (getter === undefined) {
                return undefined;
            }
            return getter.call(receiver);
        }
    };

    var _createClass = function() {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }
        return function(Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }
        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }
        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }
    var cash = jQuery;

    var Component = function() {
        /**
         * Generic constructor for all components
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Component(classDef, el, options) {
            _classCallCheck(this, Component);

            // Display error if el is valid HTML Element
            if (!(el instanceof Element)) {
                console.error(Error(el + ' is not an HTML Element'));
            }

            // If exists, destroy and reinitialize in child
            var ins = classDef.getInstance(el);
            if (!!ins) {
                ins.destroy();
            }

            this.el = el;
            this.$el = cash(el);
        }

        /**
         * Initializes components
         * @param {class} classDef
         * @param {Element | NodeList | jQuery} els
         * @param {Object} options
         */


        _createClass(Component, null, [{
            key: "init",
            value: function init(classDef, els, options) {
                var instances = null;
                if (els instanceof Element) {
                    instances = new classDef(els, options);
                } else if (!!els && (els.jquery || els.cash || els instanceof NodeList)) {
                    var instancesArr = [];
                    for (var i = 0; i < els.length; i++) {
                        instancesArr.push(new classDef(els[i], options));
                    }
                    instances = instancesArr;
                }

                return instances;
            }
        }]);

        return Component;
    }();


    M.keys = {
        TAB: 9,
        ENTER: 13,
        ESC: 27,
        ARROW_UP: 38,
        ARROW_DOWN: 40
    };

    /**
     * Initialize jQuery wrapper for plugin
     * @param {Class} plugin  javascript class
     * @param {string} pluginName  jQuery plugin name
     * @param {string} classRef  Class reference name
     */
    M.initializeJqueryWrapper = function(plugin, pluginName, classRef) {
        jQuery.fn[pluginName] = function(methodOrOptions) {
            // Call plugin method if valid method name is passed in
            if (plugin.prototype[methodOrOptions]) {
                var params = Array.prototype.slice.call(arguments, 1);

                // Getter methods
                if (methodOrOptions.slice(0, 3) === 'get') {
                    var instance = this.first()[0][classRef];
                    return instance[methodOrOptions].apply(instance, params);
                }

                // Void methods
                return this.each(function() {
                    var instance = this[classRef];
                    instance[methodOrOptions].apply(instance, params);
                });

                // Initialize plugin if options or no argument is passed in
            } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
                plugin.init(this, arguments[0]);
                return this;
            }

            // Return error if an unrecognized  method name is passed in
            jQuery.error("Method " + methodOrOptions + " does not exist on jQuery." + pluginName);
        };
    };


    // Unique Random ID
    M.guid = function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return function() {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };
    }();

    /**
     * Escapes hash from special characters
     * @param {string} hash  String returned from this.hash
     * @returns {string}
     */
    M.escapeHash = function(hash) {
        return hash.replace(/(:|\.|\[|\]|,|=|\/)/g, '\\$1');
    };

    /**
     * @typedef {Object} Edges
     * @property {Boolean} top  If the top edge was exceeded
     * @property {Boolean} right  If the right edge was exceeded
     * @property {Boolean} bottom  If the bottom edge was exceeded
     * @property {Boolean} left  If the left edge was exceeded
     */

    /**
     * @typedef {Object} Bounding
     * @property {Number} left  left offset coordinate
     * @property {Number} top  top offset coordinate
     * @property {Number} width
     * @property {Number} height
     */

    /**
     * Escapes hash from special characters
     * @param {Element} container  Container element that acts as the boundary
     * @param {Bounding} bounding  element bounding that is being checked
     * @param {Number} offset  offset from edge that counts as exceeding
     * @returns {Edges}
     */
    M.checkWithinContainer = function(container, bounding, offset) {
        var edges = {
            top: false,
            right: false,
            bottom: false,
            left: false
        };

        var containerRect = container.getBoundingClientRect();
        // If body element is smaller than viewport, use viewport height instead.
        var containerBottom = container === document.body ? Math.max(containerRect.bottom, window.innerHeight) : containerRect.bottom;

        var scrollLeft = container.scrollLeft;
        var scrollTop = container.scrollTop;

        var scrolledX = bounding.left - scrollLeft;
        var scrolledY = bounding.top - scrollTop;

        // Check for container and viewport for each edge
        if (scrolledX < containerRect.left + offset || scrolledX < offset) {
            edges.left = true;
        }

        if (scrolledX + bounding.width > containerRect.right - offset || scrolledX + bounding.width > window.innerWidth - offset) {
            edges.right = true;
        }

        if (scrolledY < containerRect.top + offset || scrolledY < offset) {
            edges.top = true;
        }

        if (scrolledY + bounding.height > containerBottom - offset || scrolledY + bounding.height > window.innerHeight - offset) {
            edges.bottom = true;
        }

        return edges;
    };

    M.checkPossibleAlignments = function(el, container, bounding, offset) {
        var canAlign = {
            top: true,
            right: true,
            bottom: true,
            left: true,
            spaceOnTop: null,
            spaceOnRight: null,
            spaceOnBottom: null,
            spaceOnLeft: null
        };

        var containerAllowsOverflow = getComputedStyle(container).overflow === 'visible';
        var containerRect = container.getBoundingClientRect();
        var containerHeight = Math.min(containerRect.height, window.innerHeight);
        var containerWidth = Math.min(containerRect.width, window.innerWidth);
        var elOffsetRect = el.getBoundingClientRect();

        var scrollLeft = container.scrollLeft;
        var scrollTop = container.scrollTop;

        var scrolledX = bounding.left - scrollLeft;
        var scrolledYTopEdge = bounding.top - scrollTop;
        var scrolledYBottomEdge = bounding.top + elOffsetRect.height - scrollTop;

        // Check for container and viewport for left
        canAlign.spaceOnRight = !containerAllowsOverflow ? containerWidth - (scrolledX + bounding.width) : window.innerWidth - (elOffsetRect.left + bounding.width);
        if (canAlign.spaceOnRight < 0) {
            canAlign.left = false;
        }

        // Check for container and viewport for Right
        canAlign.spaceOnLeft = !containerAllowsOverflow ? scrolledX - bounding.width + elOffsetRect.width : elOffsetRect.right - bounding.width;
        if (canAlign.spaceOnLeft < 0) {
            canAlign.right = false;
        }

        // Check for container and viewport for Top
        canAlign.spaceOnBottom = !containerAllowsOverflow ? containerHeight - (scrolledYTopEdge + bounding.height + offset) : window.innerHeight - (elOffsetRect.top + bounding.height + offset);
        if (canAlign.spaceOnBottom < 0) {
            canAlign.top = false;
        }

        // Check for container and viewport for Bottom
        canAlign.spaceOnTop = !containerAllowsOverflow ? scrolledYBottomEdge - (bounding.height - offset) : elOffsetRect.bottom - (bounding.height + offset);
        if (canAlign.spaceOnTop < 0) {
            canAlign.bottom = false;
        }

        return canAlign;
    };


    /**
     * Gets id of component from a trigger
     * @param {Element} trigger  trigger
     * @returns {string}
     */
    M.getIdFromTrigger = function(trigger) {
        var id = trigger.getAttribute('data-target');
        if (!id) {
            id = trigger.getAttribute('href');
            if (id) {
                id = id.slice(1);
            } else {
                id = '';
            }
        }
        return id;
    };

    /**
     * Multi browser support for document scroll top
     * @returns {Number}
     */
    M.getDocumentScrollTop = function() {
        return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    /**
     * Multi browser support for document scroll left
     * @returns {Number}
     */
    M.getDocumentScrollLeft = function() {
        return window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    };

    /**
     * @typedef {Object} Edges
     * @property {Boolean} top  If the top edge was exceeded
     * @property {Boolean} right  If the right edge was exceeded
     * @property {Boolean} bottom  If the bottom edge was exceeded
     * @property {Boolean} left  If the left edge was exceeded
     */

    /**
     * @typedef {Object} Bounding
     * @property {Number} left  left offset coordinate
     * @property {Number} top  top offset coordinate
     * @property {Number} width
     * @property {Number} height
     */

    /**
     * Get time in ms
     * @license https://raw.github.com/jashkenas/underscore/master/LICENSE
     * @type {function}
     * @return {number}
     */
    var getTime = Date.now || function() {
        return new Date().getTime();
    };

    /**
     * Returns a function, that, when invoked, will only be triggered at most once
     * during a given window of time. Normally, the throttled function will run
     * as much as it can, without ever going more than once per `wait` duration;
     * but if you'd like to disable the execution on the leading edge, pass
     * `{leading: false}`. To disable execution on the trailing edge, ditto.
     * @license https://raw.github.com/jashkenas/underscore/master/LICENSE
     * @param {function} func
     * @param {number} wait
     * @param {Object=} options
     * @returns {Function}
     */
    M.throttle = function(func, wait, options) {
        var context = void 0,
            args = void 0,
            result = void 0;
        var timeout = null;
        var previous = 0;
        options || (options = {});
        var later = function() {
            previous = options.leading === false ? 0 : getTime();
            timeout = null;
            result = func.apply(context, args);
            context = args = null;
        };
        return function() {
            var now = getTime();
            if (!previous && options.leading === false) previous = now;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0) {
                clearTimeout(timeout);
                timeout = null;
                previous = now;
                result = func.apply(context, args);
                context = args = null;
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    };;
    /*
     v2.2.0
     2017 Julian Garnier
     Released under the MIT license
     */


    //Modal
    ;
    (function($, anim) {
        'use strict';

        var _defaults = {
            opacity: 0.5,
            inDuration: 100,
            outDuration: 50,
            onOpenStart: null,
            onOpenEnd: null,
            onCloseStart: null,
            onCloseEnd: null,
            preventScrolling: true,
            dismissible: true,
            startingTop: '4%',
            endingTop: '10%'
        };

        /**
         * @class
         *
         */

        var Modal = function(_Component3) {
            _inherits(Modal, _Component3);

            /**
             * Construct Modal instance and set up overlay
             * @constructor
             * @param {Element} el
             * @param {Object} options
             */
            function Modal(el, options) {
                _classCallCheck(this, Modal);

                var _this12 = _possibleConstructorReturn(this, (Modal.__proto__ || Object.getPrototypeOf(Modal)).call(this, Modal, el, options));

                _this12.el.M_Modal = _this12;

                /**
                 * Options for the modal
                 * @member Modal#options
                 * @prop {Number} [opacity=0.5] - Opacity of the modal overlay
                 * @prop {Number} [inDuration=250] - Length in ms of enter transition
                 * @prop {Number} [outDuration=250] - Length in ms of exit transition
                 * @prop {Function} onOpenStart - Callback function called before modal is opened
                 * @prop {Function} onOpenEnd - Callback function called after modal is opened
                 * @prop {Function} onCloseStart - Callback function called before modal is closed
                 * @prop {Function} onCloseEnd - Callback function called after modal is closed
                 * @prop {Boolean} [dismissible=true] - Allow modal to be dismissed by keyboard or overlay click
                 * @prop {String} [startingTop='4%'] - startingTop
                 * @prop {String} [endingTop='10%'] - endingTop
                 */
                _this12.options = $.extend({}, Modal.defaults, options);

                /**
                 * Describes open/close state of modal
                 * @type {Boolean}
                 */
                _this12.isOpen = false;

                _this12.id = _this12.$el.attr('id');
                _this12._openingTrigger = undefined;
                _this12.$overlay = $('<div class="modal-overlay"></div>');
                _this12.el.tabIndex = 0;
                _this12._nthModalOpened = 0;

                Modal._count++;
                _this12._setupEventHandlers();
                return _this12;
            }

            _createClass(Modal, [{
                key: "destroy",


                /**
                 * Teardown component
                 */
                value: function destroy() {
                    Modal._count--;
                    this._removeEventHandlers();
                    this.el.removeAttribute('style');
                    this.$overlay.remove();
                    this.el.M_Modal = undefined;
                }

                /**
                 * Setup Event Handlers
                 */

            }, {
                key: "_setupEventHandlers",
                value: function _setupEventHandlers() {
                    this._handleOverlayClickBound = this._handleOverlayClick.bind(this);
                    this._handleModalCloseClickBound = this._handleModalCloseClick.bind(this);

                    if (Modal._count === 1) {
                        document.body.addEventListener('click', this._handleTriggerClick);
                    }
                    this.$overlay[0].addEventListener('click', this._handleOverlayClickBound);
                    this.el.addEventListener('click', this._handleModalCloseClickBound);
                }

                /**
                 * Remove Event Handlers
                 */

            }, {
                key: "_removeEventHandlers",
                value: function _removeEventHandlers() {
                    if (Modal._count === 0) {
                        document.body.removeEventListener('click', this._handleTriggerClick);
                    }
                    this.$overlay[0].removeEventListener('click', this._handleOverlayClickBound);
                    this.el.removeEventListener('click', this._handleModalCloseClickBound);
                }

                /**
                 * Handle Trigger Click
                 * @param {Event} e
                 */

            }, {
                key: "_handleTriggerClick",
                value: function _handleTriggerClick(e) {
                    var $trigger = $(e.target).closest('.modal-trigger');
                    if ($trigger.length) {
                        var modalId = M.getIdFromTrigger($trigger[0]);
                        var modalInstance = document.getElementById(modalId).M_Modal;
                        if (modalInstance) {
                            modalInstance.open($trigger);
                        }
                        e.preventDefault();
                    }
                }

                /**
                 * Handle Overlay Click
                 */

            }, {
                key: "_handleOverlayClick",
                value: function _handleOverlayClick() {
                    if (this.options.dismissible) {
                        this.close();
                    }
                }

                /**
                 * Handle Modal Close Click
                 * @param {Event} e
                 */

            }, {
                key: "_handleModalCloseClick",
                value: function _handleModalCloseClick(e) {
                    var $closeTrigger = $(e.target).closest('.modal-close');
                    if ($closeTrigger.length) {
                        this.close();
                    }
                }

                /**
                 * Handle Keydown
                 * @param {Event} e
                 */

            }, {
                key: "_handleKeydown",
                value: function _handleKeydown(e) {
                    // ESC key
                    if (e.keyCode === 27 && this.options.dismissible) {
                        this.close();
                    }
                }

                /**
                 * Handle Focus
                 * @param {Event} e
                 */

            }, {
                key: "_handleFocus",
                value: function _handleFocus(e) {
                    // Only trap focus if this modal is the last model opened (prevents loops in nested modals).
                    if (!this.el.contains(e.target) && this._nthModalOpened === Modal._modalsOpen) {
                        this.el.focus();
                    }
                }

                /**
                 * Animate in modal
                 */

            }, {
                key: "_animateIn",
                value: function _animateIn() {
                    var _this13 = this;

                    // Set initial styles
                    $.extend(this.el.style, {
                        display: 'block',
                        opacity: 0
                    });
                    $.extend(this.$overlay[0].style, {
                        display: 'block',
                        opacity: 0
                    });

                    // Animate overlay
                    anim({
                        targets: this.$overlay[0],
                        opacity: this.options.opacity,
                        duration: this.options.inDuration,
                        easing: 'easeOutQuad'
                    });

                    // Define modal animation options
                    var enterAnimOptions = {
                        targets: this.el,
                        duration: this.options.inDuration,
                        easing: 'easeOutCubic',
                        // Handle modal onOpenEnd callback
                        complete: function() {
                            if (typeof _this13.options.onOpenEnd === 'function') {
                                _this13.options.onOpenEnd.call(_this13, _this13.el, _this13._openingTrigger);
                            }
                        }
                    };

                    // Bottom sheet animation
                    if (this.el.classList.contains('bottom-sheet')) {
                        $.extend(enterAnimOptions, {
                            bottom: 0,
                            opacity: 1
                        });
                        anim(enterAnimOptions);

                        // Normal modal animation
                    } else {
                        $.extend(enterAnimOptions, {
                            top: [this.options.startingTop, this.options.endingTop],
                            opacity: 1,
                            scaleX: [0.8, 1],
                            scaleY: [0.8, 1]
                        });
                        anim(enterAnimOptions);
                    }
                }

                /**
                 * Animate out modal
                 */

            }, {
                key: "_animateOut",
                value: function _animateOut() {
                    var _this14 = this;

                    // Animate overlay
                    anim({
                        targets: this.$overlay[0],
                        opacity: 0,
                        duration: this.options.outDuration,
                        easing: 'easeOutQuart'
                    });

                    // Define modal animation options
                    var exitAnimOptions = {
                        targets: this.el,
                        duration: this.options.outDuration,
                        easing: 'easeOutCubic',
                        // Handle modal ready callback
                        complete: function() {
                            _this14.el.style.display = 'none';
                            _this14.$overlay.remove();

                            // Call onCloseEnd callback
                            if (typeof _this14.options.onCloseEnd === 'function') {
                                _this14.options.onCloseEnd.call(_this14, _this14.el);
                            }
                        }
                    };

                    // Bottom sheet animation
                    if (this.el.classList.contains('bottom-sheet')) {
                        $.extend(exitAnimOptions, {
                            bottom: '-100%',
                            opacity: 0
                        });
                        anim(exitAnimOptions);

                        // Normal modal animation
                    } else {
                        $.extend(exitAnimOptions, {
                            top: [this.options.endingTop, this.options.startingTop],
                            opacity: 0,
                            scaleX: 0.8,
                            scaleY: 0.8
                        });
                        anim(exitAnimOptions);
                    }
                }

                /**
                 * Open Modal
                 * @param {cash} [$trigger]
                 */

            }, {
                key: "open",
                value: function open($trigger) {
                    if (this.isOpen) {
                        return;
                    }

                    this.isOpen = true;
                    Modal._modalsOpen++;
                    this._nthModalOpened = Modal._modalsOpen;

                    // Set Z-Index based on number of currently open modals
                    this.$overlay[0].style.zIndex = 1000 + Modal._modalsOpen * 2;
                    this.el.style.zIndex = 1000 + Modal._modalsOpen * 2 + 1;

                    // Set opening trigger, undefined indicates modal was opened by javascript
                    this._openingTrigger = !!$trigger ? $trigger[0] : undefined;

                    // onOpenStart callback
                    if (typeof this.options.onOpenStart === 'function') {
                        this.options.onOpenStart.call(this, this.el, this._openingTrigger);
                    }

                    if (this.options.preventScrolling) {
                        document.body.style.overflow = 'hidden';
                    }

                    this.el.classList.add('open');
                    this.el.insertAdjacentElement('afterend', this.$overlay[0]);

                    if (this.options.dismissible) {
                        this._handleKeydownBound = this._handleKeydown.bind(this);
                        this._handleFocusBound = this._handleFocus.bind(this);
                        document.addEventListener('keydown', this._handleKeydownBound);
                        document.addEventListener('focus', this._handleFocusBound, true);
                    }

                    anim.remove(this.el);
                    anim.remove(this.$overlay[0]);
                    this._animateIn();

                    // Focus modal
                    this.el.focus();

                    return this;
                }

                /**
                 * Close Modal
                 */

            }, {
                key: "close",
                value: function close() {
                    if (!this.isOpen) {
                        return;
                    }

                    this.isOpen = false;
                    Modal._modalsOpen--;
                    this._nthModalOpened = 0;

                    // Call onCloseStart callback
                    if (typeof this.options.onCloseStart === 'function') {
                        this.options.onCloseStart.call(this, this.el);
                    }

                    this.el.classList.remove('open');

                    // Enable body scrolling only if there are no more modals open.
                    if (Modal._modalsOpen === 0) {
                        document.body.style.overflow = '';
                    }

                    if (this.options.dismissible) {
                        document.removeEventListener('keydown', this._handleKeydownBound);
                        // document.removeEventListener('focus', this._handleFocusBound, true);
                    }

                    anim.remove(this.el);
                    anim.remove(this.$overlay[0]);
                    this._animateOut();
                    return this;
                }
            }], [{
                key: "init",
                value: function init(els, options) {
                    return _get(Modal.__proto__ || Object.getPrototypeOf(Modal), "init", this).call(this, this, els, options);
                }

                /**
                 * Get Instance
                 */

            }, {
                key: "getInstance",
                value: function getInstance(el) {
                    var domElem = !!el.jquery ? el[0] : el;
                    return domElem.M_Modal;
                }
            }, {
                key: "defaults",
                get: function() {
                    return _defaults;
                }
            }]);

            return Modal;
        }(Component);

        /**
         * @static
         * @memberof Modal
         */


        Modal._modalsOpen = 0;

        /**
         * @static
         * @memberof Modal
         */
        Modal._count = 0;

        M.Modal = Modal;

        if (M.jQueryLoaded) {
            M.initializeJqueryWrapper(Modal, 'modal', 'M_Modal');
        }
    })(cash, M.anime);

    ;
    /*!
     * Waves v0.6.4
     * http://fian.my.id/Waves
     *
     * Copyright 2014 Alfiana E. Sibuea and other contributors
     * Released under the MIT license
     * https://github.com/fians/Waves/blob/master/LICENSE
     */
    ;

    //Toast
    ;
    (function($, anim) {
        'use strict';

        var _defaults = {
            html: '',
            displayLength: 4000,
            inDuration: 300,
            outDuration: 375,
            classes: '',
            completeCallback: null,
            activationPercent: 0.8
        };

        var Toast = function() {
            function Toast(options) {
                _classCallCheck(this, Toast);

                /**
                 * Options for the toast
                 * @member Toast#options
                 */
                this.options = $.extend({}, Toast.defaults, options);
                this.message = this.options.html;

                /**
                 * Describes current pan state toast
                 * @type {Boolean}
                 */
                this.panning = false;

                /**
                 * Time remaining until toast is removed
                 */
                this.timeRemaining = this.options.displayLength;

                if (Toast._toasts.length === 0) {
                    Toast._createContainer();
                }

                // Create new toast
                Toast._toasts.push(this);
                var toastElement = this._createToast();
                toastElement.M_Toast = this;
                this.el = toastElement;
                this.$el = $(toastElement);
                this._animateIn();
                this._setTimer();
            }

            _createClass(Toast, [{
                key: "_createToast",


                /**
                 * Create toast and append it to toast container
                 */
                value: function _createToast() {
                    var toast = document.createElement('div');
                    toast.classList.add('toast');

                    // Add custom classes onto toast
                    if (!!this.options.classes.length) {
                        $(toast).addClass(this.options.classes);
                    }

                    // Set content
                    if (typeof HTMLElement === 'object' ? this.message instanceof HTMLElement : this.message && typeof this.message === 'object' && this.message !== null && this.message.nodeType === 1 && typeof this.message.nodeName === 'string') {
                        toast.appendChild(this.message);

                        // Check if it is jQuery object
                    } else if (!!this.message.jquery) {
                        $(toast).append(this.message[0]);

                        // Insert as html;
                    } else {
                        toast.innerHTML = this.message;
                    }

                    // Append toasft
                    Toast._container.appendChild(toast);
                    return toast;
                }

                /**
                 * Animate in toast
                 */

            }, {
                key: "_animateIn",
                value: function _animateIn() {
                    // Animate toast in
                    anim({
                        targets: this.el,
                        top: 0,
                        opacity: 1,
                        duration: this.options.inDuration,
                        easing: 'easeOutCubic'
                    });
                }

                /**
                 * Create setInterval which automatically removes toast when timeRemaining >= 0
                 * has been reached
                 */

            }, {
                key: "_setTimer",
                value: function _setTimer() {
                    var _this28 = this;

                    if (this.timeRemaining !== Infinity) {
                        this.counterInterval = setInterval(function() {
                            // If toast is not being dragged, decrease its time remaining
                            if (!_this28.panning) {
                                _this28.timeRemaining -= 20;
                            }

                            // Animate toast out
                            if (_this28.timeRemaining <= 0) {
                                _this28.dismiss();
                            }
                        }, 20);
                    }
                }

                /**
                 * Dismiss toast with animation
                 */

            }, {
                key: "dismiss",
                value: function dismiss() {
                    var _this29 = this;

                    window.clearInterval(this.counterInterval);
                    var activationDistance = this.el.offsetWidth * this.options.activationPercent;

                    if (this.wasSwiped) {
                        this.el.style.transition = 'transform .05s, opacity .05s';
                        this.el.style.transform = "translateX(" + (this.swipeDirection?-activationDistance:activationDistance) + "px)";
                        this.el.style.opacity = 0;
                    }

                    anim({
                        targets: this.el,
                        opacity: 0,
                        marginTop: -40,
                        duration: this.options.outDuration,
                        easing: 'easeOutExpo',
                        complete: function() {
                            // Call the optional callback
                            if (typeof _this29.options.completeCallback === 'function') {
                                _this29.options.completeCallback();
                            }
                            // Remove toast from DOM
                            _this29.$el.remove();
                            Toast._toasts.splice(Toast._toasts.indexOf(_this29), 1);
                            if (Toast._toasts.length === 0) {
                                Toast._removeContainer();
                            }
                        }
                    });
                }
            }], [{
                key: "getInstance",


                /**
                 * Get Instance
                 */
                value: function getInstance(el) {
                    var domElem = !!el.jquery ? el[0] : el;
                    return domElem.M_Toast;
                }

                /**
                 * Append toast container and add event handlers
                 */

            }, {
                key: "_createContainer",
                value: function _createContainer() {
                    var container = document.createElement('div');
                    container.setAttribute('id', 'toast-container');

                    // Add event handler
                    container.addEventListener('touchstart', Toast._onDragStart);
                    container.addEventListener('touchmove', Toast._onDragMove);
                    container.addEventListener('touchend', Toast._onDragEnd);

                    container.addEventListener('mousedown', Toast._onDragStart);
                    document.addEventListener('mousemove', Toast._onDragMove);
                    document.addEventListener('mouseup', Toast._onDragEnd);

                    document.body.appendChild(container);
                    Toast._container = container;
                }

                /**
                 * Remove toast container and event handlers
                 */

            }, {
                key: "_removeContainer",
                value: function _removeContainer() {
                    // Add event handler
                    document.removeEventListener('mousemove', Toast._onDragMove);
                    document.removeEventListener('mouseup', Toast._onDragEnd);

                    $(Toast._container).remove();
                    Toast._container = null;
                }

                /**
                 * Begin drag handler
                 * @param {Event} e
                 */

            }, {
                key: "_onDragStart",
                value: function _onDragStart(e) {
                    if (e.target && $(e.target).closest('.toast').length) {
                        var $toast = $(e.target).closest('.toast');
                        var toast = $toast[0].M_Toast;
                        toast.panning = true;
                        Toast._draggedToast = toast;
                        toast.el.classList.add('panning');
                        toast.el.style.transition = '';
                        toast.startingXPos = Toast._xPos(e);
                        toast.time = Date.now();
                        toast.xPos = Toast._xPos(e);
                    }
                }

                /**
                 * Drag move handler
                 * @param {Event} e
                 */

            }, {
                key: "_onDragMove",
                value: function _onDragMove(e) {
                    if (!!Toast._draggedToast) {
                        e.preventDefault();
                        var toast = Toast._draggedToast;
                        toast.deltaX = Math.abs(toast.xPos - Toast._xPos(e));
                        var swipeDirection = toast.xPos > Toast._xPos(e);
                        if (toast.swipeDirection != swipeDirection) {
                            toast.velocityX = 0;
                            toast.swipeDirection = swipeDirection;
                        }
                        toast.xPos = Toast._xPos(e);
                        toast.velocityX = Math.max(toast.velocityX, toast.deltaX / (Date.now() - toast.time));
                        toast.time = Date.now();

                        var totalDeltaX = toast.xPos - toast.startingXPos;
                        var activationDistance = toast.el.offsetWidth * toast.options.activationPercent;
                        toast.el.style.transform = "translateX(" + totalDeltaX + "px)";
                        toast.el.style.opacity = 1 - Math.abs(totalDeltaX / activationDistance);
                    }
                }

                /**
                 * End drag handler
                 */

            }, {
                key: "_onDragEnd",
                value: function _onDragEnd() {
                    if (!!Toast._draggedToast) {
                        var toast = Toast._draggedToast;
                        toast.panning = false;
                        toast.el.classList.remove('panning');

                        var totalDeltaX = toast.xPos - toast.startingXPos;
                        var activationDistance = toast.el.offsetWidth * toast.options.activationPercent;
                        var shouldBeDismissed = Math.abs(totalDeltaX) > activationDistance || toast.velocityX > 1;

                        // Remove toast
                        if (shouldBeDismissed) {
                            toast.wasSwiped = true;
                            toast.dismiss();

                            // Animate toast back to original position
                        } else {
                            toast.el.style.transition = 'transform .2s, opacity .2s';
                            toast.el.style.transform = '';
                            toast.el.style.opacity = '';
                        }
                        Toast._draggedToast = null;
                    }
                }

                /**
                 * Get x position of mouse or touch event
                 * @param {Event} e
                 */

            }, {
                key: "_xPos",
                value: function _xPos(e) {
                    if (e.targetTouches && e.targetTouches.length >= 1) {
                        return e.targetTouches[0].clientX;
                    }
                    // mouse event
                    return e.clientX;
                }

                /**
                 * Remove all toasts
                 */

            }, {
                key: "dismissAll",
                value: function dismissAll() {
                    for (var toastIndex in Toast._toasts) {
                        Toast._toasts[toastIndex].dismiss();
                    }
                }
            }, {
                key: "defaults",
                get: function() {
                    return _defaults;
                }
            }]);

            return Toast;
        }();

        /**
         * @static
         * @memberof Toast
         * @type {Array.<Toast>}
         */


        Toast._toasts = [];

        /**
         * @static
         * @memberof Toast
         */
        Toast._container = null;

        /**
         * @static
         * @memberof Toast
         * @type {Toast}
         */
        Toast._draggedToast = null;

        M.Toast = Toast;
        M.toast = function(options) {
            return new Toast(options);
        };
    })(cash, M.anime);
    //Floating Action Button
    ;
    (function($, anim) {
        'use strict';

        var _defaults = {
            direction: 'top',
            hoverEnabled: true,
            toolbarEnabled: false
        };

        $.fn.reverse = [].reverse;

        /**
         * @class
         *
         */

        var FloatingActionButton = function(_Component14) {
            _inherits(FloatingActionButton, _Component14);

            /**
             * Construct FloatingActionButton instance
             * @constructor
             * @param {Element} el
             * @param {Object} options
             */
            function FloatingActionButton(el, options) {
                _classCallCheck(this, FloatingActionButton);

                var _this47 = _possibleConstructorReturn(this, (FloatingActionButton.__proto__ || Object.getPrototypeOf(FloatingActionButton)).call(this, FloatingActionButton, el, options));

                _this47.el.M_FloatingActionButton = _this47;

                /**
                 * Options for the fab
                 * @member FloatingActionButton#options
                 * @prop {Boolean} [direction] - Direction fab menu opens
                 * @prop {Boolean} [hoverEnabled=true] - Enable hover vs click
                 * @prop {Boolean} [toolbarEnabled=false] - Enable toolbar transition
                 */
                _this47.options = $.extend({}, FloatingActionButton.defaults, options);

                _this47.isOpen = false;
                _this47.$anchor = _this47.$el.children('a').first();
                _this47.$menu = _this47.$el.children('ul').first();
                _this47.$floatingBtns = _this47.$el.find('ul .btn-floating');
                _this47.$floatingBtnsReverse = _this47.$el.find('ul .btn-floating').reverse();
                _this47.offsetY = 0;
                _this47.offsetX = 0;

                _this47.$el.addClass("direction-" + _this47.options.direction);
                if (_this47.options.direction === 'top') {
                    _this47.offsetY = 40;
                } else if (_this47.options.direction === 'right') {
                    _this47.offsetX = -40;
                } else if (_this47.options.direction === 'bottom') {
                    _this47.offsetY = -40;
                } else {
                    _this47.offsetX = 40;
                }
                _this47._setupEventHandlers();
                return _this47;
            }

            _createClass(FloatingActionButton, [{
                key: "destroy",


                /**
                 * Teardown component
                 */
                value: function destroy() {
                    this._removeEventHandlers();
                    this.el.M_FloatingActionButton = undefined;
                }

                /**
                 * Setup Event Handlers
                 */

            }, {
                key: "_setupEventHandlers",
                value: function _setupEventHandlers() {
                    this._handleFABClickBound = this._handleFABClick.bind(this);
                    this._handleOpenBound = this.open.bind(this);
                    this._handleCloseBound = this.close.bind(this);

                    if (this.options.hoverEnabled && !this.options.toolbarEnabled) {
                        this.el.addEventListener('mouseenter', this._handleOpenBound);
                        this.el.addEventListener('mouseleave', this._handleCloseBound);
                    } else {
                        this.el.addEventListener('click', this._handleFABClickBound);
                    }
                }

                /**
                 * Remove Event Handlers
                 */

            }, {
                key: "_removeEventHandlers",
                value: function _removeEventHandlers() {
                    if (this.options.hoverEnabled && !this.options.toolbarEnabled) {
                        this.el.removeEventListener('mouseenter', this._handleOpenBound);
                        this.el.removeEventListener('mouseleave', this._handleCloseBound);
                    } else {
                        this.el.removeEventListener('click', this._handleFABClickBound);
                    }
                }

                /**
                 * Handle FAB Click
                 */

            }, {
                key: "_handleFABClick",
                value: function _handleFABClick() {
                    if (this.isOpen) {
                        this.close();
                    } else {
                        this.open();
                    }
                }

                /**
                 * Handle Document Click
                 * @param {Event} e
                 */

            }, {
                key: "_handleDocumentClick",
                value: function _handleDocumentClick(e) {
                    if (!$(e.target).closest(this.$menu).length) {
                        this.close();
                    }
                }

                /**
                 * Open FAB
                 */

            }, {
                key: "open",
                value: function open() {
                    if (this.isOpen) {
                        return;
                    }

                    if (this.options.toolbarEnabled) {
                        this._animateInToolbar();
                    } else {
                        this._animateInFAB();
                    }
                    this.isOpen = true;
                }

                /**
                 * Close FAB
                 */

            }, {
                key: "close",
                value: function close() {
                    if (!this.isOpen) {
                        return;
                    }

                    if (this.options.toolbarEnabled) {
                        window.removeEventListener('scroll', this._handleCloseBound, true);
                        document.body.removeEventListener('click', this._handleDocumentClickBound, true);
                        this._animateOutToolbar();
                    } else {
                        this._animateOutFAB();
                    }
                    this.isOpen = false;
                }

                /**
                 * Classic FAB Menu open
                 */

            }, {
                key: "_animateInFAB",
                value: function _animateInFAB() {
                    var _this48 = this;

                    this.$el.addClass('active');

                    var time = 0;
                    this.$floatingBtnsReverse.each(function(el) {
                        anim({
                            targets: el,
                            opacity: 1,
                            scale: [0.4, 1],
                            translateY: [_this48.offsetY, 0],
                            translateX: [_this48.offsetX, 0],
                            duration: 275,
                            delay: time,
                            easing: 'easeInOutQuad'
                        });
                        time += 40;
                    });
                }

                /**
                 * Classic FAB Menu close
                 */

            }, {
                key: "_animateOutFAB",
                value: function _animateOutFAB() {
                    var _this49 = this;

                    this.$floatingBtnsReverse.each(function(el) {
                        anim.remove(el);
                        anim({
                            targets: el,
                            opacity: 0,
                            scale: 0.4,
                            translateY: _this49.offsetY,
                            translateX: _this49.offsetX,
                            duration: 175,
                            easing: 'easeOutQuad',
                            complete: function() {
                                _this49.$el.removeClass('active');
                            }
                        });
                    });
                }

                /**
                 * Toolbar transition Menu open
                 */

            }, {
                key: "_animateInToolbar",
                value: function _animateInToolbar() {
                    var _this50 = this;

                    var scaleFactor = void 0;
                    var windowWidth = window.innerWidth;
                    var windowHeight = window.innerHeight;
                    var btnRect = this.el.getBoundingClientRect();
                    var backdrop = $('<div class="fab-backdrop"></div>');
                    var fabColor = this.$anchor.css('background-color');
                    this.$anchor.append(backdrop);

                    this.offsetX = btnRect.left - windowWidth / 2 + btnRect.width / 2;
                    this.offsetY = windowHeight - btnRect.bottom;
                    scaleFactor = windowWidth / backdrop[0].clientWidth;
                    this.btnBottom = btnRect.bottom;
                    this.btnLeft = btnRect.left;
                    this.btnWidth = btnRect.width;

                    // Set initial state
                    this.$el.addClass('active');
                    this.$el.css({
                        'text-align': 'center',
                        width: '100%',
                        bottom: 0,
                        left: 0,
                        transform: 'translateX(' + this.offsetX + 'px)',
                        transition: 'none'
                    });
                    this.$anchor.css({
                        transform: 'translateY(' + -this.offsetY + 'px)',
                        transition: 'none'
                    });
                    backdrop.css({
                        'background-color': fabColor
                    });

                    setTimeout(function() {
                        _this50.$el.css({
                            transform: '',
                            transition: 'transform .2s cubic-bezier(0.550, 0.085, 0.680, 0.530), background-color 0s linear .2s'
                        });
                        _this50.$anchor.css({
                            overflow: 'visible',
                            transform: '',
                            transition: 'transform .2s'
                        });

                        setTimeout(function() {
                            _this50.$el.css({
                                overflow: 'hidden',
                                'background-color': fabColor
                            });
                            backdrop.css({
                                transform: 'scale(' + scaleFactor + ')',
                                transition: 'transform .2s cubic-bezier(0.550, 0.055, 0.675, 0.190)'
                            });
                            _this50.$menu.children('li').children('a').css({
                                opacity: 1
                            });

                            // Scroll to close.
                            _this50._handleDocumentClickBound = _this50._handleDocumentClick.bind(_this50);
                            window.addEventListener('scroll', _this50._handleCloseBound, true);
                            document.body.addEventListener('click', _this50._handleDocumentClickBound, true);
                        }, 100);
                    }, 0);
                }

                /**
                 * Toolbar transition Menu close
                 */

            }, {
                key: "_animateOutToolbar",
                value: function _animateOutToolbar() {
                    var _this51 = this;

                    var windowWidth = window.innerWidth;
                    var windowHeight = window.innerHeight;
                    var backdrop = this.$el.find('.fab-backdrop');
                    var fabColor = this.$anchor.css('background-color');

                    this.offsetX = this.btnLeft - windowWidth / 2 + this.btnWidth / 2;
                    this.offsetY = windowHeight - this.btnBottom;

                    // Hide backdrop
                    this.$el.removeClass('active');
                    this.$el.css({
                        'background-color': 'transparent',
                        transition: 'none'
                    });
                    this.$anchor.css({
                        transition: 'none'
                    });
                    backdrop.css({
                        transform: 'scale(0)',
                        'background-color': fabColor
                    });
                    this.$menu.children('li').children('a').css({
                        opacity: ''
                    });

                    setTimeout(function() {
                        backdrop.remove();

                        // Set initial state.
                        _this51.$el.css({
                            'text-align': '',
                            width: '',
                            bottom: '',
                            left: '',
                            overflow: '',
                            'background-color': '',
                            transform: 'translate3d(' + -_this51.offsetX + 'px,0,0)'
                        });
                        _this51.$anchor.css({
                            overflow: '',
                            transform: 'translate3d(0,' + _this51.offsetY + 'px,0)'
                        });

                        setTimeout(function() {
                            _this51.$el.css({
                                transform: 'translate3d(0,0,0)',
                                transition: 'transform .2s'
                            });
                            _this51.$anchor.css({
                                transform: 'translate3d(0,0,0)',
                                transition: 'transform .2s cubic-bezier(0.550, 0.055, 0.675, 0.190)'
                            });
                        }, 20);
                    }, 200);
                }
            }], [{
                key: "init",
                value: function init(els, options) {
                    return _get(FloatingActionButton.__proto__ || Object.getPrototypeOf(FloatingActionButton), "init", this).call(this, this, els, options);
                }

                /**
                 * Get Instance
                 */

            }, {
                key: "getInstance",
                value: function getInstance(el) {
                    var domElem = !!el.jquery ? el[0] : el;
                    return domElem.M_FloatingActionButton;
                }
            }, {
                key: "defaults",
                get: function() {
                    return _defaults;
                }
            }]);

            return FloatingActionButton;
        }(Component);

        M.FloatingActionButton = FloatingActionButton;

        if (M.jQueryLoaded) {
            M.initializeJqueryWrapper(FloatingActionButton, 'floatingActionButton', 'M_FloatingActionButton');
        }
    })(cash, M.anime);

    //DatePicker
    ;
    (function($) {
        'use strict';

        var _defaults = {
            // Close when date is selected
            autoClose: false,

            // the default output format for the input field value
            format: 'mmm dd, yyyy',

            // Used to create date object from current input string
            parse: null,

            // The initial date to view when first opened
            defaultDate: null,

            // Make the `defaultDate` the initial selected value
            setDefaultDate: false,

            disableWeekends: false,

            disableDayFn: null,

            // First day of week (0: Sunday, 1: Monday etc)
            firstDay: 0,

            // The earliest date that can be selected
            minDate: null,
            // Thelatest date that can be selected
            maxDate: null,

            // Number of years either side, or array of upper/lower range
            yearRange: 10,

            // used internally (don't config outside)
            minYear: 0,
            maxYear: 9999,
            minMonth: undefined,
            maxMonth: undefined,

            startRange: null,
            endRange: null,

            isRTL: false,

            // Render the month after year in the calendar title
            showMonthAfterYear: false,

            // Render days of the calendar grid that fall in the next or previous month
            showDaysInNextAndPreviousMonths: false,

            // Specify a DOM element to render the calendar in
            container: null,

            // Show clear button
            showClearBtn: false,

            // internationalization
            i18n: {
                cancel: 'Cancel',
                clear: 'Clear',
                done: 'Ok',
                previousMonth: '‹',
                nextMonth: '›',
                months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                weekdaysAbbrev: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
            },

            // events array
            events: [],

            // callback function
            onSelect: null,
            onOpen: null,
            onClose: null,
            onDraw: null
        };

        /**
         * @class
         *
         */

        var Datepicker = function(_Component15) {
            _inherits(Datepicker, _Component15);

            /**
             * Construct Datepicker instance and set up overlay
             * @constructor
             * @param {Element} el
             * @param {Object} options
             */
            function Datepicker(el, options) {
                _classCallCheck(this, Datepicker);

                var _this52 = _possibleConstructorReturn(this, (Datepicker.__proto__ || Object.getPrototypeOf(Datepicker)).call(this, Datepicker, el, options));

                _this52.el.M_Datepicker = _this52;

                _this52.options = $.extend({}, Datepicker.defaults, options);

                // make sure i18n defaults are not lost when only few i18n option properties are passed
                if (!!options && options.hasOwnProperty('i18n') && typeof options.i18n === 'object') {
                    _this52.options.i18n = $.extend({}, Datepicker.defaults.i18n, options.i18n);
                }

                // Remove time component from minDate and maxDate options
                if (_this52.options.minDate) _this52.options.minDate.setHours(0, 0, 0, 0);
                if (_this52.options.maxDate) _this52.options.maxDate.setHours(0, 0, 0, 0);

                _this52.id = M.guid();

                _this52._setupVariables();
                _this52._insertHTMLIntoDOM();
                _this52._setupModal();

                _this52._setupEventHandlers();

                if (!_this52.options.defaultDate) {
                    _this52.options.defaultDate = new Date(Date.parse(_this52.el.value));
                }

                var defDate = _this52.options.defaultDate;
                if (Datepicker._isDate(defDate)) {
                    if (_this52.options.setDefaultDate) {
                        _this52.setDate(defDate, true);
                        _this52.setInputValue();
                    } else {
                        _this52.gotoDate(defDate);
                    }
                } else {
                    _this52.gotoDate(new Date());
                }

                /**
                 * Describes open/close state of datepicker
                 * @type {Boolean}
                 */
                _this52.isOpen = false;
                return _this52;
            }

            _createClass(Datepicker, [{
                key: "destroy",


                /**
                 * Teardown component
                 */
                value: function destroy() {
                    this._removeEventHandlers();
                    this.modal.destroy();
                    $(this.modalEl).remove();
                    this.destroySelects();
                    this.el.M_Datepicker = undefined;
                }
            }, {
                key: "destroySelects",
                value: function destroySelects() {
                    var oldYearSelect = this.calendarEl.querySelector('.orig-select-year');
                    if (oldYearSelect) {
                        M.FormSelect.getInstance(oldYearSelect).destroy();
                    }
                    var oldMonthSelect = this.calendarEl.querySelector('.orig-select-month');
                    if (oldMonthSelect) {
                        M.FormSelect.getInstance(oldMonthSelect).destroy();
                    }
                }
            }, {
                key: "_insertHTMLIntoDOM",
                value: function _insertHTMLIntoDOM() {
                    if (this.options.showClearBtn) {
                        $(this.clearBtn).css({
                            visibility: ''
                        });
                        this.clearBtn.innerHTML = this.options.i18n.clear;
                    }

                    this.doneBtn.innerHTML = this.options.i18n.done;
                    this.cancelBtn.innerHTML = this.options.i18n.cancel;

                    if (this.options.container) {
                        this.$modalEl.appendTo(this.options.container);
                    } else {
                        this.$modalEl.insertBefore(this.el);
                    }
                }
            }, {
                key: "_setupModal",
                value: function _setupModal() {
                    var _this53 = this;

                    this.modalEl.id = 'modal-' + this.id;
                    this.modal = M.Modal.init(this.modalEl, {
                        onCloseEnd: function() {
                            _this53.isOpen = false;
                        }
                    });
                }
            }, {
                key: "toString",
                value: function toString(format) {
                    var _this54 = this;

                    format = format || this.options.format;
                    if (!Datepicker._isDate(this.date)) {
                        return '';
                    }

                    var formatArray = format.split(/(d{1,4}|m{1,4}|y{4}|yy|!.)/g);
                    var formattedDate = formatArray.map(function(label) {
                        if (_this54.formats[label]) {
                            return _this54.formats[label]();
                        }

                        return label;
                    }).join('');
                    return formattedDate;
                }
            }, {
                key: "setDate",
                value: function setDate(date, preventOnSelect) {
                    if (!date) {
                        this.date = null;
                        this._renderDateDisplay();
                        return this.draw();
                    }
                    if (typeof date === 'string') {
                        date = new Date(Date.parse(date));
                    }
                    if (!Datepicker._isDate(date)) {
                        return;
                    }

                    var min = this.options.minDate,
                        max = this.options.maxDate;

                    if (Datepicker._isDate(min) && date < min) {
                        date = min;
                    } else if (Datepicker._isDate(max) && date > max) {
                        date = max;
                    }

                    this.date = new Date(date.getTime());

                    this._renderDateDisplay();

                    Datepicker._setToStartOfDay(this.date);
                    this.gotoDate(this.date);

                    if (!preventOnSelect && typeof this.options.onSelect === 'function') {
                        this.options.onSelect.call(this, this.date);
                    }
                }
            }, {
                key: "setInputValue",
                value: function setInputValue() {
                    this.el.value = this.toString();
                    this.$el.trigger('change', {
                        firedBy: this
                    });
                }
            }, {
                key: "_renderDateDisplay",
                value: function _renderDateDisplay() {
                    var displayDate = Datepicker._isDate(this.date) ? this.date : new Date();
                    var i18n = this.options.i18n;
                    var day = i18n.weekdaysShort[displayDate.getDay()];
                    var month = i18n.monthsShort[displayDate.getMonth()];
                    var date = displayDate.getDate();
                    this.yearTextEl.innerHTML = displayDate.getFullYear();
                    this.dateTextEl.innerHTML = day + ", " + month + " " + date;
                }

                /**
                 * change view to a specific date
                 */

            }, {
                key: "gotoDate",
                value: function gotoDate(date) {
                    var newCalendar = true;

                    if (!Datepicker._isDate(date)) {
                        return;
                    }

                    if (this.calendars) {
                        var firstVisibleDate = new Date(this.calendars[0].year, this.calendars[0].month, 1),
                            lastVisibleDate = new Date(this.calendars[this.calendars.length - 1].year, this.calendars[this.calendars.length - 1].month, 1),
                            visibleDate = date.getTime();
                        // get the end of the month
                        lastVisibleDate.setMonth(lastVisibleDate.getMonth() + 1);
                        lastVisibleDate.setDate(lastVisibleDate.getDate() - 1);
                        newCalendar = visibleDate < firstVisibleDate.getTime() || lastVisibleDate.getTime() < visibleDate;
                    }

                    if (newCalendar) {
                        this.calendars = [{
                            month: date.getMonth(),
                            year: date.getFullYear()
                        }];
                    }

                    this.adjustCalendars();
                }
            }, {
                key: "adjustCalendars",
                value: function adjustCalendars() {
                    this.calendars[0] = this.adjustCalendar(this.calendars[0]);
                    this.draw();
                }
            }, {
                key: "adjustCalendar",
                value: function adjustCalendar(calendar) {
                    if (calendar.month < 0) {
                        calendar.year -= Math.ceil(Math.abs(calendar.month) / 12);
                        calendar.month += 12;
                    }
                    if (calendar.month > 11) {
                        calendar.year += Math.floor(Math.abs(calendar.month) / 12);
                        calendar.month -= 12;
                    }
                    return calendar;
                }
            }, {
                key: "nextMonth",
                value: function nextMonth() {
                    this.calendars[0].month++;
                    this.adjustCalendars();
                }
            }, {
                key: "prevMonth",
                value: function prevMonth() {
                    this.calendars[0].month--;
                    this.adjustCalendars();
                }
            }, {
                key: "render",
                value: function render(year, month, randId) {
                    var opts = this.options,
                        now = new Date(),
                        days = Datepicker._getDaysInMonth(year, month),
                        before = new Date(year, month, 1).getDay(),
                        data = [],
                        row = [];
                    Datepicker._setToStartOfDay(now);
                    if (opts.firstDay > 0) {
                        before -= opts.firstDay;
                        if (before < 0) {
                            before += 7;
                        }
                    }
                    var previousMonth = month === 0 ? 11 : month - 1,
                        nextMonth = month === 11 ? 0 : month + 1,
                        yearOfPreviousMonth = month === 0 ? year - 1 : year,
                        yearOfNextMonth = month === 11 ? year + 1 : year,
                        daysInPreviousMonth = Datepicker._getDaysInMonth(yearOfPreviousMonth, previousMonth);
                    var cells = days + before,
                        after = cells;
                    while (after > 7) {
                        after -= 7;
                    }
                    cells += 7 - after;
                    var isWeekSelected = false;
                    for (var i = 0, r = 0; i < cells; i++) {
                        var day = new Date(year, month, 1 + (i - before)),
                            isSelected = Datepicker._isDate(this.date) ? Datepicker._compareDates(day, this.date) : false,
                            isToday = Datepicker._compareDates(day, now),
                            hasEvent = opts.events.indexOf(day.toDateString()) !== -1 ? true : false,
                            isEmpty = i < before || i >= days + before,
                            dayNumber = 1 + (i - before),
                            monthNumber = month,
                            yearNumber = year,
                            isStartRange = opts.startRange && Datepicker._compareDates(opts.startRange, day),
                            isEndRange = opts.endRange && Datepicker._compareDates(opts.endRange, day),
                            isInRange = opts.startRange && opts.endRange && opts.startRange < day && day < opts.endRange,
                            isDisabled = opts.minDate && day < opts.minDate || opts.maxDate && day > opts.maxDate || opts.disableWeekends && Datepicker._isWeekend(day) || opts.disableDayFn && opts.disableDayFn(day);

                        if (isEmpty) {
                            if (i < before) {
                                dayNumber = daysInPreviousMonth + dayNumber;
                                monthNumber = previousMonth;
                                yearNumber = yearOfPreviousMonth;
                            } else {
                                dayNumber = dayNumber - days;
                                monthNumber = nextMonth;
                                yearNumber = yearOfNextMonth;
                            }
                        }

                        var dayConfig = {
                            day: dayNumber,
                            month: monthNumber,
                            year: yearNumber,
                            hasEvent: hasEvent,
                            isSelected: isSelected,
                            isToday: isToday,
                            isDisabled: isDisabled,
                            isEmpty: isEmpty,
                            isStartRange: isStartRange,
                            isEndRange: isEndRange,
                            isInRange: isInRange,
                            showDaysInNextAndPreviousMonths: opts.showDaysInNextAndPreviousMonths
                        };

                        row.push(this.renderDay(dayConfig));

                        if (++r === 7) {
                            data.push(this.renderRow(row, opts.isRTL, isWeekSelected));
                            row = [];
                            r = 0;
                            isWeekSelected = false;
                        }
                    }
                    return this.renderTable(opts, data, randId);
                }
            }, {
                key: "renderDay",
                value: function renderDay(opts) {
                    var arr = [];
                    var ariaSelected = 'false';
                    if (opts.isEmpty) {
                        if (opts.showDaysInNextAndPreviousMonths) {
                            arr.push('is-outside-current-month');
                            arr.push('is-selection-disabled');
                        } else {
                            return '<td class="is-empty"></td>';
                        }
                    }
                    if (opts.isDisabled) {
                        arr.push('is-disabled');
                    }

                    if (opts.isToday) {
                        arr.push('is-today');
                    }
                    if (opts.isSelected) {
                        arr.push('is-selected');
                        ariaSelected = 'true';
                    }
                    if (opts.hasEvent) {
                        arr.push('has-event');
                    }
                    if (opts.isInRange) {
                        arr.push('is-inrange');
                    }
                    if (opts.isStartRange) {
                        arr.push('is-startrange');
                    }
                    if (opts.isEndRange) {
                        arr.push('is-endrange');
                    }
                    return "<td data-day=\"" + opts.day + "\" class=\"" + arr.join(' ') + "\" aria-selected=\"" + ariaSelected + "\">" + ("<button class=\"datepicker-day-button\" type=\"button\" data-year=\"" + opts.year + "\" data-month=\"" + opts.month + "\" data-day=\"" + opts.day + "\">" + opts.day + "</button>") + '</td>';
                }
            }, {
                key: "renderRow",
                value: function renderRow(days, isRTL, isRowSelected) {
                    return '<tr class="datepicker-row' + (isRowSelected ? ' is-selected' : '') + '">' + (isRTL ? days.reverse() : days).join('') + '</tr>';
                }
            }, {
                key: "renderTable",
                value: function renderTable(opts, data, randId) {
                    return '<div class="datepicker-table-wrapper"><table cellpadding="0" cellspacing="0" class="datepicker-table" role="grid" aria-labelledby="' + randId + '">' + this.renderHead(opts) + this.renderBody(data) + '</table></div>';
                }
            }, {
                key: "renderHead",
                value: function renderHead(opts) {
                    var i = void 0,
                        arr = [];
                    for (i = 0; i < 7; i++) {
                        arr.push("<th scope=\"col\"><abbr title=\"" + this.renderDayName(opts, i) + "\">" + this.renderDayName(opts, i, true) + "</abbr></th>");
                    }
                    return '<thead><tr>' + (opts.isRTL ? arr.reverse() : arr).join('') + '</tr></thead>';
                }
            }, {
                key: "renderBody",
                value: function renderBody(rows) {
                    return '<tbody>' + rows.join('') + '</tbody>';
                }
            }, {
                key: "renderTitle",
                value: function renderTitle(instance, c, year, month, refYear, randId) {
                    var i = void 0,
                        j = void 0,
                        arr = void 0,
                        opts = this.options,
                        isMinYear = year === opts.minYear,
                        isMaxYear = year === opts.maxYear,
                        html = '<div id="' + randId + '" class="datepicker-controls" role="heading" aria-live="assertive">',
                        monthHtml = void 0,
                        yearHtml = void 0,
                        prev = true,
                        next = true;

                    for (arr = [], i = 0; i < 12; i++) {
                        arr.push('<option value="' + (year === refYear ? i - c : 12 + i - c) + '"' + (i === month ? ' selected="selected"' : '') + (isMinYear && i < opts.minMonth || isMaxYear && i > opts.maxMonth ? 'disabled="disabled"' : '') + '>' + opts.i18n.months[i] + '</option>');
                    }

                    monthHtml = '<select class="datepicker-select orig-select-month" tabindex="-1">' + arr.join('') + '</select>';

                    if ($.isArray(opts.yearRange)) {
                        i = opts.yearRange[0];
                        j = opts.yearRange[1] + 1;
                    } else {
                        i = year - opts.yearRange;
                        j = 1 + year + opts.yearRange;
                    }

                    for (arr = []; i < j && i <= opts.maxYear; i++) {
                        if (i >= opts.minYear) {
                            arr.push("<option value=\"" + i + "\" " + (i === year ? 'selected="selected"' : '') + ">" + i + "</option>");
                        }
                    }

                    yearHtml = "<select class=\"datepicker-select orig-select-year\" tabindex=\"-1\">" + arr.join('') + "</select>";

                    var leftArrow = '<svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z"/><path d="M0-.5h24v24H0z" fill="none"/></svg>';
                    html += "<button class=\"month-prev" + (prev ? '' : ' is-disabled') + "\" type=\"button\">" + leftArrow + "</button>";

                    html += '<div class="selects-container">';
                    if (opts.showMonthAfterYear) {
                        html += yearHtml + monthHtml;
                    } else {
                        html += monthHtml + yearHtml;
                    }
                    html += '</div>';

                    if (isMinYear && (month === 0 || opts.minMonth >= month)) {
                        prev = false;
                    }

                    if (isMaxYear && (month === 11 || opts.maxMonth <= month)) {
                        next = false;
                    }

                    var rightArrow = '<svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"/><path d="M0-.25h24v24H0z" fill="none"/></svg>';
                    html += "<button class=\"month-next" + (next ? '' : ' is-disabled') + "\" type=\"button\">" + rightArrow + "</button>";

                    return html += '</div>';
                }

                /**
                 * refresh the HTML
                 */

            }, {
                key: "draw",
                value: function draw(force) {
                    if (!this.isOpen && !force) {
                        return;
                    }
                    var opts = this.options,
                        minYear = opts.minYear,
                        maxYear = opts.maxYear,
                        minMonth = opts.minMonth,
                        maxMonth = opts.maxMonth,
                        html = '',
                        randId = void 0;

                    if (this._y <= minYear) {
                        this._y = minYear;
                        if (!isNaN(minMonth) && this._m < minMonth) {
                            this._m = minMonth;
                        }
                    }
                    if (this._y >= maxYear) {
                        this._y = maxYear;
                        if (!isNaN(maxMonth) && this._m > maxMonth) {
                            this._m = maxMonth;
                        }
                    }

                    randId = 'datepicker-title-' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 2);

                    for (var c = 0; c < 1; c++) {
                        this._renderDateDisplay();
                        html += this.renderTitle(this, c, this.calendars[c].year, this.calendars[c].month, this.calendars[0].year, randId) + this.render(this.calendars[c].year, this.calendars[c].month, randId);
                    }

                    this.destroySelects();

                    this.calendarEl.innerHTML = html;

                    // Init Materialize Select
                    var yearSelect = this.calendarEl.querySelector('.orig-select-year');
                    var monthSelect = this.calendarEl.querySelector('.orig-select-month');
                    M.FormSelect.init(yearSelect, {
                        classes: 'select-year',
                        dropdownOptions: {
                            container: document.body,
                            constrainWidth: false
                        }
                    });
                    M.FormSelect.init(monthSelect, {
                        classes: 'select-month',
                        dropdownOptions: {
                            container: document.body,
                            constrainWidth: false
                        }
                    });

                    // Add change handlers for select
                    yearSelect.addEventListener('change', this._handleYearChange.bind(this));
                    monthSelect.addEventListener('change', this._handleMonthChange.bind(this));

                    if (typeof this.options.onDraw === 'function') {
                        this.options.onDraw(this);
                    }
                }

                /**
                 * Setup Event Handlers
                 */

            }, {
                key: "_setupEventHandlers",
                value: function _setupEventHandlers() {
                    this._handleInputKeydownBound = this._handleInputKeydown.bind(this);
                    this._handleInputClickBound = this._handleInputClick.bind(this);
                    this._handleInputChangeBound = this._handleInputChange.bind(this);
                    this._handleCalendarClickBound = this._handleCalendarClick.bind(this);
                    this._finishSelectionBound = this._finishSelection.bind(this);
                    this._handleMonthChange = this._handleMonthChange.bind(this);
                    this._closeBound = this.close.bind(this);

                    this.el.addEventListener('click', this._handleInputClickBound);
                    this.el.addEventListener('keydown', this._handleInputKeydownBound);
                    this.el.addEventListener('change', this._handleInputChangeBound);
                    this.calendarEl.addEventListener('click', this._handleCalendarClickBound);
                    this.doneBtn.addEventListener('click', this._finishSelectionBound);
                    this.cancelBtn.addEventListener('click', this._closeBound);

                    if (this.options.showClearBtn) {
                        this._handleClearClickBound = this._handleClearClick.bind(this);
                        this.clearBtn.addEventListener('click', this._handleClearClickBound);
                    }
                }
            }, {
                key: "_setupVariables",
                value: function _setupVariables() {
                    var _this55 = this;

                    this.$modalEl = $(Datepicker._template);
                    this.modalEl = this.$modalEl[0];

                    this.calendarEl = this.modalEl.querySelector('.datepicker-calendar');

                    this.yearTextEl = this.modalEl.querySelector('.year-text');
                    this.dateTextEl = this.modalEl.querySelector('.date-text');
                    if (this.options.showClearBtn) {
                        this.clearBtn = this.modalEl.querySelector('.datepicker-clear');
                    }
                    this.doneBtn = this.modalEl.querySelector('.datepicker-done');
                    this.cancelBtn = this.modalEl.querySelector('.datepicker-cancel');

                    this.formats = {
                        d: function() {
                            return _this55.date.getDate();
                        },
                        dd: function() {
                            var d = _this55.date.getDate();
                            return (d < 10 ? '0' : '') + d;
                        },
                        ddd: function() {
                            return _this55.options.i18n.weekdaysShort[_this55.date.getDay()];
                        },
                        dddd: function() {
                            return _this55.options.i18n.weekdays[_this55.date.getDay()];
                        },
                        m: function() {
                            return _this55.date.getMonth() + 1;
                        },
                        mm: function() {
                            var m = _this55.date.getMonth() + 1;
                            return (m < 10 ? '0' : '') + m;
                        },
                        mmm: function() {
                            return _this55.options.i18n.monthsShort[_this55.date.getMonth()];
                        },
                        mmmm: function() {
                            return _this55.options.i18n.months[_this55.date.getMonth()];
                        },
                        yy: function() {
                            return ('' + _this55.date.getFullYear()).slice(2);
                        },
                        yyyy: function() {
                            return _this55.date.getFullYear();
                        }
                    };
                }

                /**
                 * Remove Event Handlers
                 */

            }, {
                key: "_removeEventHandlers",
                value: function _removeEventHandlers() {
                    this.el.removeEventListener('click', this._handleInputClickBound);
                    this.el.removeEventListener('keydown', this._handleInputKeydownBound);
                    this.el.removeEventListener('change', this._handleInputChangeBound);
                    this.calendarEl.removeEventListener('click', this._handleCalendarClickBound);
                }
            }, {
                key: "_handleInputClick",
                value: function _handleInputClick() {
                    this.open();
                }
            }, {
                key: "_handleInputKeydown",
                value: function _handleInputKeydown(e) {
                    if (e.which === M.keys.ENTER) {
                        e.preventDefault();
                        this.open();
                    }
                }
            }, {
                key: "_handleCalendarClick",
                value: function _handleCalendarClick(e) {
                    if (!this.isOpen) {
                        return;
                    }

                    var $target = $(e.target);
                    if (!$target.hasClass('is-disabled')) {
                        if ($target.hasClass('datepicker-day-button') && !$target.hasClass('is-empty') && !$target.parent().hasClass('is-disabled')) {
                            this.setDate(new Date(e.target.getAttribute('data-year'), e.target.getAttribute('data-month'), e.target.getAttribute('data-day')));
                            if (this.options.autoClose) {
                                this._finishSelection();
                            }
                        } else if ($target.closest('.month-prev').length) {
                            this.prevMonth();
                        } else if ($target.closest('.month-next').length) {
                            this.nextMonth();
                        }
                    }
                }
            }, {
                key: "_handleClearClick",
                value: function _handleClearClick() {
                    this.date = null;
                    this.setInputValue();
                    this.close();
                }
            }, {
                key: "_handleMonthChange",
                value: function _handleMonthChange(e) {
                    this.gotoMonth(e.target.value);
                }
            }, {
                key: "_handleYearChange",
                value: function _handleYearChange(e) {
                    this.gotoYear(e.target.value);
                }

                /**
                 * change view to a specific month (zero-index, e.g. 0: January)
                 */

            }, {
                key: "gotoMonth",
                value: function gotoMonth(month) {
                    if (!isNaN(month)) {
                        this.calendars[0].month = parseInt(month, 10);
                        this.adjustCalendars();
                    }
                }

                /**
                 * change view to a specific full year (e.g. "2012")
                 */

            }, {
                key: "gotoYear",
                value: function gotoYear(year) {
                    if (!isNaN(year)) {
                        this.calendars[0].year = parseInt(year, 10);
                        this.adjustCalendars();
                    }
                }
            }, {
                key: "_handleInputChange",
                value: function _handleInputChange(e) {
                    var date = void 0;

                    // Prevent change event from being fired when triggered by the plugin
                    if (e.firedBy === this) {
                        return;
                    }
                    if (this.options.parse) {
                        date = this.options.parse(this.el.value, this.options.format);
                    } else {
                        date = new Date(Date.parse(this.el.value));
                    }

                    if (Datepicker._isDate(date)) {
                        this.setDate(date);
                    }
                }
            }, {
                key: "renderDayName",
                value: function renderDayName(opts, day, abbr) {
                    day += opts.firstDay;
                    while (day >= 7) {
                        day -= 7;
                    }
                    return abbr ? opts.i18n.weekdaysAbbrev[day] : opts.i18n.weekdays[day];
                }

                /**
                 * Set input value to the selected date and close Datepicker
                 */

            }, {
                key: "_finishSelection",
                value: function _finishSelection() {
                    this.setInputValue();
                    this.close();
                }

                /**
                 * Open Datepicker
                 */

            }, {
                key: "open",
                value: function open() {
                    if (this.isOpen) {
                        return;
                    }

                    this.isOpen = true;
                    if (typeof this.options.onOpen === 'function') {
                        this.options.onOpen.call(this);
                    }
                    this.draw();
                    this.modal.open();
                    return this;
                }

                /**
                 * Close Datepicker
                 */

            }, {
                key: "close",
                value: function close() {
                    if (!this.isOpen) {
                        return;
                    }

                    this.isOpen = false;
                    if (typeof this.options.onClose === 'function') {
                        this.options.onClose.call(this);
                    }
                    this.modal.close();
                    return this;
                }
            }], [{
                key: "init",
                value: function init(els, options) {
                    return _get(Datepicker.__proto__ || Object.getPrototypeOf(Datepicker), "init", this).call(this, this, els, options);
                }
            }, {
                key: "_isDate",
                value: function _isDate(obj) {
                    return (/Date/.test(Object.prototype.toString.call(obj)) && !isNaN(obj.getTime()));
                }
            }, {
                key: "_isWeekend",
                value: function _isWeekend(date) {
                    var day = date.getDay();
                    return day === 0 || day === 6;
                }
            }, {
                key: "_setToStartOfDay",
                value: function _setToStartOfDay(date) {
                    if (Datepicker._isDate(date)) date.setHours(0, 0, 0, 0);
                }
            }, {
                key: "_getDaysInMonth",
                value: function _getDaysInMonth(year, month) {
                    return [31, Datepicker._isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
                }
            }, {
                key: "_isLeapYear",
                value: function _isLeapYear(year) {
                    // solution by Matti Virkkunen: http://stackoverflow.com/a/4881951
                    return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
                }
            }, {
                key: "_compareDates",
                value: function _compareDates(a, b) {
                    // weak date comparison (use setToStartOfDay(date) to ensure correct result)
                    return a.getTime() === b.getTime();
                }
            }, {
                key: "_setToStartOfDay",
                value: function _setToStartOfDay(date) {
                    if (Datepicker._isDate(date)) date.setHours(0, 0, 0, 0);
                }

                /**
                 * Get Instance
                 */

            }, {
                key: "getInstance",
                value: function getInstance(el) {
                    var domElem = !!el.jquery ? el[0] : el;
                    return domElem.M_Datepicker;
                }
            }, {
                key: "defaults",
                get: function() {
                    return _defaults;
                }
            }]);

            return Datepicker;
        }(Component);

        Datepicker._template = ['<div class= "modal datepicker-modal">', '<div class="modal-content datepicker-container">', '<div class="datepicker-date-display">', '<span class="year-text"></span>', '<span class="date-text"></span>', '</div>', '<div class="datepicker-calendar-container">', '<div class="datepicker-calendar"></div>', '<div class="datepicker-footer">', '<button class="btn-flat datepicker-clear waves-effect" style="visibility: hidden;" type="button"></button>', '<div class="confirmation-btns">', '<button class="btn-flat datepicker-cancel waves-effect" type="button"></button>', '<button class="btn-flat datepicker-done waves-effect" type="button"></button>', '</div>', '</div>', '</div>', '</div>', '</div>'].join('');

        M.Datepicker = Datepicker;

        if (M.jQueryLoaded) {
            M.initializeJqueryWrapper(Datepicker, 'datepicker', 'M_Datepicker');
        }
    })(cash);
    //TimePicker
    ;
    (function($) {
        'use strict';

        var _defaults = {
            dialRadius: 135,
            outerRadius: 105,
            innerRadius: 70,
            tickRadius: 20,
            duration: 350,
            container: null,
            defaultTime: 'now', // default time, 'now' or '13:14' e.g.
            fromNow: 0, // Millisecond offset from the defaultTime
            showClearBtn: false,

            // internationalization
            i18n: {
                cancel: 'Cancel',
                clear: 'Clear',
                done: 'Ok'
            },

            autoClose: false, // auto close when minute is selected
            twelveHour: true, // change to 12 hour AM/PM clock from 24 hour
            vibrate: true, // vibrate the device when dragging clock hand

            // Callbacks
            onOpenStart: null,
            onOpenEnd: null,
            onCloseStart: null,
            onCloseEnd: null,
            onSelect: null
        };

        /**
         * @class
         *
         */

        var Timepicker = function(_Component16) {
            _inherits(Timepicker, _Component16);

            function Timepicker(el, options) {
                _classCallCheck(this, Timepicker);

                var _this56 = _possibleConstructorReturn(this, (Timepicker.__proto__ || Object.getPrototypeOf(Timepicker)).call(this, Timepicker, el, options));

                _this56.el.M_Timepicker = _this56;

                _this56.options = $.extend({}, Timepicker.defaults, options);

                _this56.id = M.guid();
                _this56._insertHTMLIntoDOM();
                _this56._setupModal();
                _this56._setupVariables();
                _this56._setupEventHandlers();

                _this56._clockSetup();
                _this56._pickerSetup();
                return _this56;
            }

            _createClass(Timepicker, [{
                key: "destroy",


                /**
                 * Teardown component
                 */
                value: function destroy() {
                    this._removeEventHandlers();
                    this.modal.destroy();
                    $(this.modalEl).remove();
                    this.el.M_Timepicker = undefined;
                }

                /**
                 * Setup Event Handlers
                 */

            }, {
                key: "_setupEventHandlers",
                value: function _setupEventHandlers() {
                    this._handleInputKeydownBound = this._handleInputKeydown.bind(this);
                    this._handleInputClickBound = this._handleInputClick.bind(this);
                    this._handleClockClickStartBound = this._handleClockClickStart.bind(this);
                    this._handleDocumentClickMoveBound = this._handleDocumentClickMove.bind(this);
                    this._handleDocumentClickEndBound = this._handleDocumentClickEnd.bind(this);

                    this.el.addEventListener('click', this._handleInputClickBound);
                    this.el.addEventListener('keydown', this._handleInputKeydownBound);
                    this.plate.addEventListener('mousedown', this._handleClockClickStartBound);
                    this.plate.addEventListener('touchstart', this._handleClockClickStartBound);

                    $(this.spanHours).on('click', this.showView.bind(this, 'hours'));
                    $(this.spanMinutes).on('click', this.showView.bind(this, 'minutes'));
                }
            }, {
                key: "_removeEventHandlers",
                value: function _removeEventHandlers() {
                    this.el.removeEventListener('click', this._handleInputClickBound);
                    this.el.removeEventListener('keydown', this._handleInputKeydownBound);
                }
            }, {
                key: "_handleInputClick",
                value: function _handleInputClick() {
                    this.open();
                }
            }, {
                key: "_handleInputKeydown",
                value: function _handleInputKeydown(e) {
                    if (e.which === M.keys.ENTER) {
                        e.preventDefault();
                        this.open();
                    }
                }
            }, {
                key: "_handleClockClickStart",
                value: function _handleClockClickStart(e) {
                    e.preventDefault();
                    var clockPlateBR = this.plate.getBoundingClientRect();
                    var offset = {
                        x: clockPlateBR.left,
                        y: clockPlateBR.top
                    };

                    this.x0 = offset.x + this.options.dialRadius;
                    this.y0 = offset.y + this.options.dialRadius;
                    this.moved = false;
                    var clickPos = Timepicker._Pos(e);
                    this.dx = clickPos.x - this.x0;
                    this.dy = clickPos.y - this.y0;

                    // Set clock hands
                    this.setHand(this.dx, this.dy, false);

                    // Mousemove on document
                    document.addEventListener('mousemove', this._handleDocumentClickMoveBound);
                    document.addEventListener('touchmove', this._handleDocumentClickMoveBound);

                    // Mouseup on document
                    document.addEventListener('mouseup', this._handleDocumentClickEndBound);
                    document.addEventListener('touchend', this._handleDocumentClickEndBound);
                }
            }, {
                key: "_handleDocumentClickMove",
                value: function _handleDocumentClickMove(e) {
                    e.preventDefault();
                    var clickPos = Timepicker._Pos(e);
                    var x = clickPos.x - this.x0;
                    var y = clickPos.y - this.y0;
                    this.moved = true;
                    this.setHand(x, y, false, true);
                }
            }, {
                key: "_handleDocumentClickEnd",
                value: function _handleDocumentClickEnd(e) {
                    var _this57 = this;

                    e.preventDefault();
                    document.removeEventListener('mouseup', this._handleDocumentClickEndBound);
                    document.removeEventListener('touchend', this._handleDocumentClickEndBound);
                    var clickPos = Timepicker._Pos(e);
                    var x = clickPos.x - this.x0;
                    var y = clickPos.y - this.y0;
                    if (this.moved && x === this.dx && y === this.dy) {
                        this.setHand(x, y);
                    }

                    if (this.currentView === 'hours') {
                        this.showView('minutes', this.options.duration / 2);
                    } else if (this.options.autoClose) {
                        $(this.minutesView).addClass('timepicker-dial-out');
                        setTimeout(function() {
                            _this57.done();
                        }, this.options.duration / 2);
                    }

                    if (typeof this.options.onSelect === 'function') {
                        this.options.onSelect.call(this, this.hours, this.minutes);
                    }

                    // Unbind mousemove event
                    document.removeEventListener('mousemove', this._handleDocumentClickMoveBound);
                    document.removeEventListener('touchmove', this._handleDocumentClickMoveBound);
                }
            }, {
                key: "_insertHTMLIntoDOM",
                value: function _insertHTMLIntoDOM() {
                    this.$modalEl = $(Timepicker._template);
                    this.modalEl = this.$modalEl[0];
                    this.modalEl.id = 'modal-' + this.id;

                    // Append popover to input by default
                    var containerEl = document.querySelector(this.options.container);
                    if (this.options.container && !!containerEl) {
                        this.$modalEl.appendTo(containerEl);
                    } else {
                        this.$modalEl.insertBefore(this.el);
                    }
                }
            }, {
                key: "_setupModal",
                value: function _setupModal() {
                    var _this58 = this;

                    this.modal = M.Modal.init(this.modalEl, {
                        onOpenStart: this.options.onOpenStart,
                        onOpenEnd: this.options.onOpenEnd,
                        onCloseStart: this.options.onCloseStart,
                        onCloseEnd: function() {
                            if (typeof _this58.options.onCloseEnd === 'function') {
                                _this58.options.onCloseEnd.call(_this58);
                            }
                            _this58.isOpen = false;
                        }
                    });
                }
            }, {
                key: "_setupVariables",
                value: function _setupVariables() {
                    this.currentView = 'hours';
                    this.vibrate = navigator.vibrate ? 'vibrate' : navigator.webkitVibrate ? 'webkitVibrate' : null;

                    this._canvas = this.modalEl.querySelector('.timepicker-canvas');
                    this.plate = this.modalEl.querySelector('.timepicker-plate');

                    this.hoursView = this.modalEl.querySelector('.timepicker-hours');
                    this.minutesView = this.modalEl.querySelector('.timepicker-minutes');
                    this.spanHours = this.modalEl.querySelector('.timepicker-span-hours');
                    this.spanMinutes = this.modalEl.querySelector('.timepicker-span-minutes');
                    this.spanAmPm = this.modalEl.querySelector('.timepicker-span-am-pm');
                    this.footer = this.modalEl.querySelector('.timepicker-footer');
                    this.amOrPm = 'PM';
                }
            }, {
                key: "_pickerSetup",
                value: function _pickerSetup() {
                    var $clearBtn = $("<button class=\"btn-flat timepicker-clear waves-effect\" style=\"visibility: hidden;\" type=\"button\" tabindex=\"" + (this.options.twelveHour ? '3' : '1') + "\">" + this.options.i18n.clear + "</button>").appendTo(this.footer).on('click', this.clear.bind(this));
                    if (this.options.showClearBtn) {
                        $clearBtn.css({
                            visibility: ''
                        });
                    }

                    var confirmationBtnsContainer = $('<div class="confirmation-btns"></div>');
                    $('<button class="btn-flat timepicker-close waves-effect" type="button" tabindex="' + (this.options.twelveHour ? '3' : '1') + '">' + this.options.i18n.cancel + '</button>').appendTo(confirmationBtnsContainer).on('click', this.close.bind(this));
                    $('<button class="btn-flat timepicker-close waves-effect" type="button" tabindex="' + (this.options.twelveHour ? '3' : '1') + '">' + this.options.i18n.done + '</button>').appendTo(confirmationBtnsContainer).on('click', this.done.bind(this));
                    confirmationBtnsContainer.appendTo(this.footer);
                }
            }, {
                key: "_clockSetup",
                value: function _clockSetup() {
                    if (this.options.twelveHour) {
                        this.$amBtn = $('<div class="am-btn">AM</div>');
                        this.$pmBtn = $('<div class="pm-btn">PM</div>');
                        this.$amBtn.on('click', this._handleAmPmClick.bind(this)).appendTo(this.spanAmPm);
                        this.$pmBtn.on('click', this._handleAmPmClick.bind(this)).appendTo(this.spanAmPm);
                    }

                    this._buildHoursView();
                    this._buildMinutesView();
                    this._buildSVGClock();
                }
            }, {
                key: "_buildSVGClock",
                value: function _buildSVGClock() {
                    // Draw clock hands and others
                    var dialRadius = this.options.dialRadius;
                    var tickRadius = this.options.tickRadius;
                    var diameter = dialRadius * 2;

                    var svg = Timepicker._createSVGEl('svg');
                    svg.setAttribute('class', 'timepicker-svg');
                    svg.setAttribute('width', diameter);
                    svg.setAttribute('height', diameter);
                    var g = Timepicker._createSVGEl('g');
                    g.setAttribute('transform', 'translate(' + dialRadius + ',' + dialRadius + ')');
                    var bearing = Timepicker._createSVGEl('circle');
                    bearing.setAttribute('class', 'timepicker-canvas-bearing');
                    bearing.setAttribute('cx', 0);
                    bearing.setAttribute('cy', 0);
                    bearing.setAttribute('r', 4);
                    var hand = Timepicker._createSVGEl('line');
                    hand.setAttribute('x1', 0);
                    hand.setAttribute('y1', 0);
                    var bg = Timepicker._createSVGEl('circle');
                    bg.setAttribute('class', 'timepicker-canvas-bg');
                    bg.setAttribute('r', tickRadius);
                    g.appendChild(hand);
                    g.appendChild(bg);
                    g.appendChild(bearing);
                    svg.appendChild(g);
                    this._canvas.appendChild(svg);

                    this.hand = hand;
                    this.bg = bg;
                    this.bearing = bearing;
                    this.g = g;
                }
            }, {
                key: "_buildHoursView",
                value: function _buildHoursView() {
                    var $tick = $('<div class="timepicker-tick"></div>');
                    // Hours view
                    if (this.options.twelveHour) {
                        for (var i = 1; i < 13; i += 1) {
                            var tick = $tick.clone();
                            var radian = i / 6 * Math.PI;
                            var radius = this.options.outerRadius;
                            tick.css({
                                left: this.options.dialRadius + Math.sin(radian) * radius - this.options.tickRadius + 'px',
                                top: this.options.dialRadius - Math.cos(radian) * radius - this.options.tickRadius + 'px'
                            });
                            tick.html(i === 0 ? '00' : i);
                            this.hoursView.appendChild(tick[0]);
                            // tick.on(mousedownEvent, mousedown);
                        }
                    } else {
                        for (var _i2 = 0; _i2 < 24; _i2 += 1) {
                            var _tick = $tick.clone();
                            var _radian = _i2 / 6 * Math.PI;
                            var inner = _i2 > 0 && _i2 < 13;
                            var _radius = inner ? this.options.innerRadius : this.options.outerRadius;
                            _tick.css({
                                left: this.options.dialRadius + Math.sin(_radian) * _radius - this.options.tickRadius + 'px',
                                top: this.options.dialRadius - Math.cos(_radian) * _radius - this.options.tickRadius + 'px'
                            });
                            _tick.html(_i2 === 0 ? '00' : _i2);
                            this.hoursView.appendChild(_tick[0]);
                            // tick.on(mousedownEvent, mousedown);
                        }
                    }
                }
            }, {
                key: "_buildMinutesView",
                value: function _buildMinutesView() {
                    var $tick = $('<div class="timepicker-tick"></div>');
                    // Minutes view
                    for (var i = 0; i < 60; i += 5) {
                        var tick = $tick.clone();
                        var radian = i / 30 * Math.PI;
                        tick.css({
                            left: this.options.dialRadius + Math.sin(radian) * this.options.outerRadius - this.options.tickRadius + 'px',
                            top: this.options.dialRadius - Math.cos(radian) * this.options.outerRadius - this.options.tickRadius + 'px'
                        });
                        tick.html(Timepicker._addLeadingZero(i));
                        this.minutesView.appendChild(tick[0]);
                    }
                }
            }, {
                key: "_handleAmPmClick",
                value: function _handleAmPmClick(e) {
                    var $btnClicked = $(e.target);
                    this.amOrPm = $btnClicked.hasClass('am-btn') ? 'AM' : 'PM';
                    this._updateAmPmView();
                }
            }, {
                key: "_updateAmPmView",
                value: function _updateAmPmView() {
                    if (this.options.twelveHour) {
                        this.$amBtn.toggleClass('text-primary', this.amOrPm === 'AM');
                        this.$pmBtn.toggleClass('text-primary', this.amOrPm === 'PM');
                    }
                }
            }, {
                key: "_updateTimeFromInput",
                value: function _updateTimeFromInput() {
                    // Get the time
                    var value = ((this.el.value || this.options.defaultTime || '') + '').split(':');
                    if (this.options.twelveHour && !(typeof value[1] === 'undefined')) {
                        if (value[1].toUpperCase().indexOf('AM') > 0) {
                            this.amOrPm = 'AM';
                        } else {
                            this.amOrPm = 'PM';
                        }
                        value[1] = value[1].replace('AM', '').replace('PM', '');
                    }
                    if (value[0] === 'now') {
                        var now = new Date(+new Date() + this.options.fromNow);
                        value = [now.getHours(), now.getMinutes()];
                        if (this.options.twelveHour) {
                            this.amOrPm = value[0] >= 12 && value[0] < 24 ? 'PM' : 'AM';
                        }
                    }
                    this.hours = +value[0] || 0;
                    this.minutes = +value[1] || 0;
                    this.spanHours.innerHTML = this.hours;
                    this.spanMinutes.innerHTML = Timepicker._addLeadingZero(this.minutes);

                    this._updateAmPmView();
                }
            }, {
                key: "showView",
                value: function showView(view, delay) {
                    if (view === 'minutes' && $(this.hoursView).css('visibility') === 'visible') {
                        // raiseCallback(this.options.beforeHourSelect);
                    }
                    var isHours = view === 'hours',
                        nextView = isHours ? this.hoursView : this.minutesView,
                        hideView = isHours ? this.minutesView : this.hoursView;
                    this.currentView = view;

                    $(this.spanHours).toggleClass('text-primary', isHours);
                    $(this.spanMinutes).toggleClass('text-primary', !isHours);

                    // Transition view
                    hideView.classList.add('timepicker-dial-out');
                    $(nextView).css('visibility', 'visible').removeClass('timepicker-dial-out');

                    // Reset clock hand
                    this.resetClock(delay);

                    // After transitions ended
                    clearTimeout(this.toggleViewTimer);
                    this.toggleViewTimer = setTimeout(function() {
                        $(hideView).css('visibility', 'hidden');
                    }, this.options.duration);
                }
            }, {
                key: "resetClock",
                value: function resetClock(delay) {
                    var view = this.currentView,
                        value = this[view],
                        isHours = view === 'hours',
                        unit = Math.PI / (isHours ? 6 : 30),
                        radian = value * unit,
                        radius = isHours && value > 0 && value < 13 ? this.options.innerRadius : this.options.outerRadius,
                        x = Math.sin(radian) * radius,
                        y = -Math.cos(radian) * radius,
                        self = this;

                    if (delay) {
                        $(this.canvas).addClass('timepicker-canvas-out');
                        setTimeout(function() {
                            $(self.canvas).removeClass('timepicker-canvas-out');
                            self.setHand(x, y);
                        }, delay);
                    } else {
                        this.setHand(x, y);
                    }
                }
            }, {
                key: "setHand",
                value: function setHand(x, y, roundBy5) {
                    var _this59 = this;

                    var radian = Math.atan2(x, -y),
                        isHours = this.currentView === 'hours',
                        unit = Math.PI / (isHours || roundBy5 ? 6 : 30),
                        z = Math.sqrt(x * x + y * y),
                        inner = isHours && z < (this.options.outerRadius + this.options.innerRadius) / 2,
                        radius = inner ? this.options.innerRadius : this.options.outerRadius;

                    if (this.options.twelveHour) {
                        radius = this.options.outerRadius;
                    }

                    // Radian should in range [0, 2PI]
                    if (radian < 0) {
                        radian = Math.PI * 2 + radian;
                    }

                    // Get the round value
                    var value = Math.round(radian / unit);

                    // Get the round radian
                    radian = value * unit;

                    // Correct the hours or minutes
                    if (this.options.twelveHour) {
                        if (isHours) {
                            if (value === 0) value = 12;
                        } else {
                            if (roundBy5) value *= 5;
                            if (value === 60) value = 0;
                        }
                    } else {
                        if (isHours) {
                            if (value === 12) {
                                value = 0;
                            }
                            value = inner ? value === 0 ? 12 : value : value === 0 ? 0 : value + 12;
                        } else {
                            if (roundBy5) {
                                value *= 5;
                            }
                            if (value === 60) {
                                value = 0;
                            }
                        }
                    }

                    // Once hours or minutes changed, vibrate the device
                    if (this[this.currentView] !== value) {
                        if (this.vibrate && this.options.vibrate) {
                            // Do not vibrate too frequently
                            if (!this.vibrateTimer) {
                                navigator[this.vibrate](10);
                                this.vibrateTimer = setTimeout(function() {
                                    _this59.vibrateTimer = null;
                                }, 100);
                            }
                        }
                    }

                    this[this.currentView] = value;
                    if (isHours) {
                        this['spanHours'].innerHTML = value;
                    } else {
                        this['spanMinutes'].innerHTML = Timepicker._addLeadingZero(value);
                    }

                    // Set clock hand and others' position
                    var cx1 = Math.sin(radian) * (radius - this.options.tickRadius),
                        cy1 = -Math.cos(radian) * (radius - this.options.tickRadius),
                        cx2 = Math.sin(radian) * radius,
                        cy2 = -Math.cos(radian) * radius;
                    this.hand.setAttribute('x2', cx1);
                    this.hand.setAttribute('y2', cy1);
                    this.bg.setAttribute('cx', cx2);
                    this.bg.setAttribute('cy', cy2);
                }
            }, {
                key: "open",
                value: function open() {
                    if (this.isOpen) {
                        return;
                    }

                    this.isOpen = true;
                    this._updateTimeFromInput();
                    this.showView('hours');

                    this.modal.open();
                }
            }, {
                key: "close",
                value: function close() {
                    if (!this.isOpen) {
                        return;
                    }

                    this.isOpen = false;
                    this.modal.close();
                }

                /**
                 * Finish timepicker selection.
                 */

            }, {
                key: "done",
                value: function done(e, clearValue) {
                    // Set input value
                    var last = this.el.value;
                    var value = clearValue ? '' : Timepicker._addLeadingZero(this.hours) + ':' + Timepicker._addLeadingZero(this.minutes);
                    this.time = value;
                    if (!clearValue && this.options.twelveHour) {
                        value = value + " " + this.amOrPm;
                    }
                    this.el.value = value;

                    // Trigger change event
                    if (value !== last) {
                        this.$el.trigger('change');
                    }

                    this.close();
                    this.el.focus();
                }
            }, {
                key: "clear",
                value: function clear() {
                    this.done(null, true);
                }
            }], [{
                key: "init",
                value: function init(els, options) {
                    return _get(Timepicker.__proto__ || Object.getPrototypeOf(Timepicker), "init", this).call(this, this, els, options);
                }
            }, {
                key: "_addLeadingZero",
                value: function _addLeadingZero(num) {
                    return (num < 10 ? '0' : '') + num;
                }
            }, {
                key: "_createSVGEl",
                value: function _createSVGEl(name) {
                    var svgNS = 'http://www.w3.org/2000/svg';
                    return document.createElementNS(svgNS, name);
                }

                /**
                 * @typedef {Object} Point
                 * @property {number} x The X Coordinate
                 * @property {number} y The Y Coordinate
                 */

                /**
                 * Get x position of mouse or touch event
                 * @param {Event} e
                 * @return {Point} x and y location
                 */

            }, {
                key: "_Pos",
                value: function _Pos(e) {
                    if (e.targetTouches && e.targetTouches.length >= 1) {
                        return {
                            x: e.targetTouches[0].clientX,
                            y: e.targetTouches[0].clientY
                        };
                    }
                    // mouse event
                    return {
                        x: e.clientX,
                        y: e.clientY
                    };
                }

                /**
                 * Get Instance
                 */

            }, {
                key: "getInstance",
                value: function getInstance(el) {
                    var domElem = !!el.jquery ? el[0] : el;
                    return domElem.M_Timepicker;
                }
            }, {
                key: "defaults",
                get: function() {
                    return _defaults;
                }
            }]);

            return Timepicker;
        }(Component);

        Timepicker._template = ['<div class= "modal timepicker-modal">', '<div class="modal-content timepicker-container">', '<div class="timepicker-digital-display">', '<div class="timepicker-text-container">', '<div class="timepicker-display-column">', '<span class="timepicker-span-hours text-primary"></span>', ':', '<span class="timepicker-span-minutes"></span>', '</div>', '<div class="timepicker-display-column timepicker-display-am-pm">', '<div class="timepicker-span-am-pm"></div>', '</div>', '</div>', '</div>', '<div class="timepicker-analog-display">', '<div class="timepicker-plate">', '<div class="timepicker-canvas"></div>', '<div class="timepicker-dial timepicker-hours"></div>', '<div class="timepicker-dial timepicker-minutes timepicker-dial-out"></div>', '</div>', '<div class="timepicker-footer"></div>', '</div>', '</div>', '</div>'].join('');

        M.Timepicker = Timepicker;

        if (M.jQueryLoaded) {
            M.initializeJqueryWrapper(Timepicker, 'timepicker', 'M_Timepicker');
        }
    })(cash);
})()