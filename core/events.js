_Define(function(global) {
    "use strict";
    var Utils = global.Utils;
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
        frozenEvents: false,
        triggerAsync: function(eventname, obj, delegate) {
            setImmediate((function() {
                this.trigger(eventname, obj, delegate);
            }).bind(this));
        },
        trigger: function(eventname, obj, noEventObj) {
            if (!noEventObj)
                obj = this.createEvent(obj);
            var handlers = this._eventRegistry[eventname];
            if (handlers) {
                if (typeof handlers == 'function') {
                    handlers(obj);
                    if (obj && obj.propagationStopped)
                        return obj;
                }
                else if (obj) {
                    for (var i in handlers) {
                        handlers[i](obj);
                        if (obj.propagationStopped)
                            return obj;
                    }
                }
                else {
                    for (var j in handlers) {
                        handlers[j](obj);
                    }
                }
            }
            if (this.parentEmitter)
                return this.parentEmitter.trigger(eventname, obj, true);
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
            if (this.frozenEvents && !_eventRegistry.hasOwnProperty(event)) {
                console.warn('Unknown event ' + event);
                return false;
            }
            if (!_eventRegistry[event]) {
                _eventRegistry[event] = func;
            }
            else if (_eventRegistry[event] === true) {
                setTimeout(func, 0);
            }
            else {
                if (typeof _eventRegistry[event] == 'function') _eventRegistry[event] = [_eventRegistry[event]];
                if (capture) _eventRegistry[event].unshift(func);
                else _eventRegistry[event].push(func);
            }
        },
        off: function(event, func) {
            var reg = this._eventRegistry[event];
            if (!(reg && func)) return;
            if (typeof reg=="function"){
                if (reg == func) this._eventRegistry[event] = null;
            }
            else if (reg !== true) {
                this._eventRegistry[event] = reg.filter(Utils.except(func));
            }
        },
        triggerForever: function(event) {
            this.trigger(event);
            this._eventRegistry[event] = true;
        }
    });
    EventsEmitter.prototype.emit = EventsEmitter.prototype.trigger;
    global.EventsEmitter = EventsEmitter;
    global.AppEvents = new EventsEmitter();
    global.AppEvents.frozenEvents = true;
    global.AppEvents._eventRegistry = {
        'app-loaded': null,
        'documents-loaded': null,
        'app-paused': null,
        'app-resumed': null,
        'view-change': null,
        'fully-loaded': null,
        'filebrowsers': null,
        'createDoc': null,
        'closeDoc': null,
        'changeTab': null,
        "closeTab": null,
        "beforeCloseTab": null,
        "changeEditor": null,
        "createEditor": null,
        "closeEditor": null
    };
    global.ConfigEvents = new EventsEmitter();
    global.ConfigEvents.frozen = true;
})/*_EndDefine*/