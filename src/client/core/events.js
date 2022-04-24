define(function(require, exports, module) {
    "use strict";
    var Utils = require("./utils").Utils;
    var debug = console;
    var setImmediate = Utils.setImmediate;
    var EventsEmitter = function(parent) {
        this._eventRegistry = {};
        if (parent)
            this.parentEmitter = parent;
    };
    Object.assign(EventsEmitter.prototype, {
        _eventRegistry: {},
        createEvent: function(props) {
            var _defaultPrevented, _propagationStopped;
            var event = {
                target: this,
                preventDefault: function() {
                    _defaultPrevented = true;
                },
                stopPropagation: function() {
                    _propagationStopped = true;
                },
                get defaultPrevented() {
                    return _defaultPrevented;
                },
                get propagationStopped() {
                    return _propagationStopped;
                },
            };
            return Object.assign(event, props);
        },
        //allows you to prevent registering
        //events that are not explicitly used
        //useful for 'once' calls that would have
        //led to memory leaks and debugging
        checkEvents: false,
        triggerAsync: function(eventname, obj, noEventObj) {
            setImmediate((function() {
                this.trigger(eventname, obj,
                    noEventObj);
            }).bind(this));
        },
        debug: function() {
            this._debug = true;
        },
        trigger: function(eventname, obj, noEventObj) {
            if (!noEventObj)
                obj = this.createEvent(obj);
            var id = null;
            if (this._debug) {
                switch (eventname) {
                    case 'createEditor':
                    case 'changeEditor':
                    case 'closeEditor':
                        id = obj.editor.id;
                        break;
                    case 'confirmCloseTab':
                    case 'closeTab':
                    case 'changeTab':
                        id = obj.tab;
                        break;
                    case 'createDoc':
                    case 'closeDoc':
                    case 'changeDoc':
                        id = obj.doc && obj.doc.id;
                }
                debug.log(eventname + ':' + (id || ''));
            }
            var handlers = this._eventRegistry[eventname];
            if (handlers) {
                if (typeof handlers == 'function') {
                    handlers(obj);
                    if (obj && obj.propagationStopped)
                        return obj;
                } else if (obj) {
                    for (var i in handlers) {
                        handlers[i](obj);
                        if (obj.propagationStopped)
                            return obj;
                    }
                } else {
                    for (var j in handlers) {
                        handlers[j](obj);
                    }
                }
            }
            if (this.parentEmitter)
                return this.parentEmitter.trigger(eventname,
                    obj, true);
            return obj;
        },
        setParentEmitter: function(p) {
            this.parentEmitter = p;
        },
        once: function(event, func, capture) {
            var newfunc = func;
            func = (function() {
                this.off(event, func);
                newfunc.apply(null, arguments);
            }).bind(this);
            this.on(event, func, capture);
            return func;
        },
        on: function(event, func, capture) {
            if (!func) return;
            var _eventRegistry = this._eventRegistry;
            if (this.checkEvents && !_eventRegistry
                .hasOwnProperty(event)) {
                debug.warn('Unknown event ' + event);
                return false;
            }
            if (!_eventRegistry[event]) {
                _eventRegistry[event] = func;
            } else if (_eventRegistry[event] === true) {
                setImmediate(func);
            } else {
                if (typeof _eventRegistry[event] ==
                    'function') _eventRegistry[event] = [
                    _eventRegistry[event]
                ];
                if (capture) _eventRegistry[event].unshift(
                    func);
                else _eventRegistry[event].push(func);
            }
        },
        off: function(event, func) {
            var reg = this._eventRegistry[event];
            if (!(reg && func)) return;
            if (typeof reg == "function") {
                if (reg == func) this._eventRegistry[
                    event] = null;
            } else if (reg !== true) {
                this._eventRegistry[event] = reg.filter(
                    Utils.except(func));
            }
        },
        triggerForever: function(event) {
            this.trigger(event);
            this._eventRegistry[event] = true;
        }
    });
    EventsEmitter.prototype.emit = EventsEmitter.prototype.trigger;
    exports.EventsEmitter = EventsEmitter;

    //See FileUtils, ConfigEvents, ItemList for more events
    exports.AppEvents = new EventsEmitter();
    exports.AppEvents.checkEvents = true;
    exports.AppEvents._eventRegistry = {
        appLoaded: null, //once on first render
        appPaused: null, //app is minimized
        appResumed: null, //app is resumed from pause

        //docs/active_doc.js
        changeDoc: null, //active doc changed

        //docs/docs.js
        createDoc: null, //created new document
        deleteDoc: null, //deleted underlying document on filesystem
        renameDoc: null, //renamed underlying document on filesystem
        saveDoc: null, //saved document to filesystem
        closeDoc: null, //closed document
        docStatusChange: null, //document state whether saved/unsaved; not necessarily changed
        documentsLoaded: null, //all previously open documents have been loaded

        //editor/editors.js
        createEditor: null, //created new editor
        changeEditor: null, //active editor changed
        closeEditor: null, //closed editor
        editorThemeLoaded: null,

        //setup/setup_tab_host.js
        changeTab: null, //active tab changed
        confirmCloseTab: null, //user wants to close a tab
        closeTab: null, //about closing tab
        closedTab: null, //finished closing tab

        //theme/theme.js
        themeChange: null, //app theme change

        //setup/setup_root.js
        layoutChange: null, //any layout change not directly triggered by resizes

        //core/focus_manager.js
        keyboardChange: null, //soft keyboard shown or hidden

        //setup/setup_ext
        fullyLoaded: null, //all extensions have been started

        //ext/autocompletion/manager.js
        trimServerMemory: null, //autocomplete server restarts in response to this event
    };
    exports.AppEvents.debug();

}); /*_EndDefine*/