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
//TODO get rid of this bug bank
var unsafeAnime = M.anime;
M.anime = Object.assign(function(opts){
  if(opts.complete){
    var unsafe = opts.complete;
    opts.complete = function(){
      try{
        unsafe.call(this,arguments);
      }
      catch(e){
        console.error(e);
      }
    };
  }
  return unsafeAnime(opts);
} ,M.anime);
/*!
     * Waves v0.6.4
     * http://fian.my.id/Waves
     *
     * Copyright 2014 Alfiana E. Sibuea and other contributors
     * Released under the MIT license
     * https://github.com/fians/Waves/blob/master/LICENSE
     */
    ;

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
    window.jQuery = $;
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



    /**
     * Escapes hash from special characters
     * @param {string} hash  String returned from this.hash
     * @returns {string}
     */
    M.escapeHash = function(hash) {
        return hash.replace(/(:|\.|\[|\]|,|=|\/)/g, '\\$1');
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
})()