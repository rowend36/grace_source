_Define(function (global) {
    var extname = global.FileUtils.extname;

    function loadScript(script, cb) {
        var scr = document.createElement("script");
        scr.src = script;
        scr.onload = function () {
            cb();
        };
        document.body.appendChild(scr);
    }

    function loadStyle(style, cb) {
        var styleEl = document.createElement("link");
        styleEl.href = style;
        styleEl.setAttribute("rel", "stylesheet");
        styleEl.onload = function () {
            cb();
        };
        document.body.appendChild(styleEl);
    }
    /**
     * @constructor
     */
    function Imports(onload, delay) {
        this.onLoad = onload;
        this.delay = delay == undefined ? 30 : 0;
        this.load = this.next.bind(this);
        this.deps = [];
    }
    Imports.prototype.add = function () {
        this.deps.push.apply(this.deps,arguments);
    };
    Imports.prototype.next = function () {
        if (this.deps.length < 1) {
            return this.onLoad && this.onLoad();
        }
        if (!this.started) {
            this.started = true;
        }
        var nextItem = this.deps.shift();
        if (typeof nextItem == "string")
            switch (extname(nextItem)) {
                case "css":
                    nextItem = {
                        style: nextItem,
                    };
                    break;
                case "js":
                    nextItem = {
                        script: nextItem,
                    };
                    break;
                default:
                    throw new Error("Unknown dependency " + nextItem);
            }
        if (nextItem.id) {
            this[nextItem.id] = true;
        }
        if (nextItem.ignoreIf) return this.next();
        if (nextItem.name) {
            console.debug(nextItem.name);
        }
        if (nextItem.func)
            setTimeout(
                (function () {
                    try {
                        nextItem.func();
                    } catch (e) {
                        try {
                            console.error(e);
                            nextItem.error && nextItem.error(e);
                        } catch (i) {
                            console.error(i);
                        }
                    }
                    this.next();
                }).bind(this),
                this.delay
            );
        else if (nextItem.script) {
            loadScript(nextItem.script, this.load);
        } else if (nextItem.style) {
            loadStyle(nextItem.style, this.load);
        } else throw new Error("Unknown dependency " + nextItem);
    };
    Imports.define = function (paths, start, func) {
        var cachedArgs = [];
        var bootList = new Imports(function () {
            bootList = null;
            func = (start && start()) || func;
            cachedArgs.forEach(function (i) {
                try {
                    func.apply(i[0], i[1]);
                } catch (e) {
                    console.error(e);
                }
            });
            start = bootList = paths = cachedArgs = undefined;
        });

        paths.forEach(function (e) {
            bootList.add(e);
        });
        return function () {
            if (cachedArgs) {
                cachedArgs.push([this, arguments]);
                if (!bootList.started) bootList.next();
            } else return func.apply(this, arguments);
        };
    };
    global.Imports = Imports;
}) /*_EndDefine*/;