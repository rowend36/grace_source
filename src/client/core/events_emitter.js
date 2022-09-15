define(function (require, exports, module) {
  'use strict';
  var Utils = require('./utils').Utils;
  var debug = console;
  var setImmediate = Utils.setImmediate;
  var EventsEmitter = function (parent) {
    this._eventRegistry = {};
    this.debug();
    if (parent)
      throw 'Removed API. Subclass event emitter to use parent emitters';
  };
  Object.assign(EventsEmitter.prototype, {
    _eventRegistry: {},
    _eventQueue: null,
    _debug: false,
    /**
     * Prevent registering of events that are not
     * explicitly added in _eventRegistry.
     **/
    checkEvents: false,
    preventDefault: function () {
      this.defaultPrevented = true;
    },
    stopPropagation: function () {
      this.propagationStopped = true;
    },
    createEvent: function (props) {
      return Object.assign(
        {
          defaultPrevented: false,
          propagationStopped: false,
          preventDefault: this.preventDefault,
          stopPropagation: this.stopPropagation,
        },
        props
      );
    },
    trigger: function (eventName, obj, noEventProps) {
      var reg = this._eventRegistry;
      if (this.checkEvents && !reg.hasOwnProperty(eventName)) {
        debug.warn('Failed to trigger unknown event: ' + eventName);
        return false;
      }
      if (!noEventProps) obj = this.createEvent(obj);
      var handlers = this._eventRegistry[eventName];
      if (handlers) {
        if (typeof handlers == 'function') {
          handlers(obj);
        } else {
          handlers = handlers.slice(0);
          for (var i = 0; i < handlers.length; i++) {
            handlers[i](obj);
            if (obj && obj.propagationStopped) return obj;
          }
        }
      }
      return obj;
    },
    /**
     Trigger an event that guarantees arrival order among
     other signalled events.
     Useful for transitioned/changed events.
    */
    signal: function (eventName, obj, addEventProps) {
      var reg = this._eventRegistry;
      if (this.checkEvents && !reg.hasOwnProperty(eventName)) {
        debug.warn('Failed to signal unknown event: ' + eventName);
        return false;
      }
      if (addEventProps) obj = this.createEvent(obj);
      var c = this._eventQueue || (this._eventQueue = {i: 0, q: []});
      c.q.push({j: 0, ev: eventName, obj: obj, h: null});
      try {
        // Sort events by using a shared queue
        for (var m; (m = c.q[c.i]); c.i++) {
          if (!m.h) {
            var handlers = this._eventRegistry[m.ev];
            m.h =
              typeof handlers == 'function'
                ? {0: handlers, length: 1}
                : Array.isArray(handlers)
                ? handlers.slice(0)
                : [];
          }
          for (; m.j < m.h.length; ) {
            m.h[m.j++].call(null, m.obj); //can recursively call outer loop
            if (m.obj && m.obj.propagationStopped) break;
          }
        }
      } finally {
        c.q.pop();
        c.i = c.q.length;
      }
      return obj;
    },
    /**
     * Trigger an event that can be delayed or repeated.
     * Used for destructor events.
     */
    asyncTrigger: function (eventName, props, onTasksHandled) {
      var task = Object.assign({}, props);
      var counter,
        tokens = [];
      task.tags = Object.create(null);
      task.repeat = function () {
        task.isDelayed = false;
        counter = Utils.createCounter(onTasksHandled.bind(this, task));
        counter.increment();
        var result = this.trigger(eventName, task);
        counter.decrement();
        return result;
      }.bind(this);
      task.await = function (token, handleToken) {
        if (token === null || tokens.indexOf(token) < 0) {
          tokens.push(token);
          task.isDelayed = true;
          counter.increment();
          handleToken(counter.decrement);
        }
      };
      return task.repeat();
    },

    /**
     * Trigger an event that fires on all present and future listeners.
     */
    triggerForever: function (eventName) {
      this.trigger(eventName, null, true);
      this._eventRegistry[eventName] = true;
    },
    //Clone handlers to prevent counter errors
    on: function (event, func, capture) {
      if (typeof event !== 'string' || !func)
        return debug.error('Invalid event listener: ', event, func);
      var reg = this._eventRegistry;
      if (this.checkEvents && !reg.hasOwnProperty(event)) {
        debug.warn('Failed to register unknown event: ' + event);
        return false;
      }
      //allows use as mixin of other event_emitter implementation
      if (!reg[event] && !this._emit) reg[event] = func;
      else if (reg[event] === true) setImmediate(func);
      else if (typeof reg[event] == 'function') reg[event] = [reg[event], func];
      else if (capture) reg[event].unshift(func);
      else reg[event].push(func);
    },
    off: function (event, func) {
      var reg = this._eventRegistry[event];
      if (!reg || !func) return;
      if (typeof reg == 'function') {
        if (reg == func) this._eventRegistry[event] = null;
      } else if (reg !== true) {
        Utils.removeFrom(reg, func);
      }
    },
    once: function (event, func, capture) {
      var _fired = false,
        self = this;
      var wrapper = function () {
        if (_fired) return; //Does not happen with signal
        _fired = true;
        self.off(event, wrapper);
        func.apply(this, arguments);
      };
      this.on(event, wrapper, capture);
      return wrapper;
    },
    debug: function () {
      ['trigger', 'signal'].forEach(function (e) {
        var m = this[e];
        this[e] = function (eventName, obj) {
          var id = null;
          if (this._debug) {
            switch (eventName) {
              case 'createEditor':
              case 'changeEditor':
              case 'closeEditor':
                id = obj.editor.id;
                break;
              case 'changeTab':
              case 'closeTab':
              case 'tabClosed':
                id = obj.tab;
                break;
              case 'docStatusChanged':
              case 'loadDoc':
              case 'openDoc':
              case 'changeDoc':
              case 'closeDoc':
                id = obj.doc && obj.doc.id;
                break;
              case 'registerFileServer':
                id = obj;
            }
            debug.log(eventName + ':' + (id || ''));
          }
          return m.apply(this, arguments);
        };
      }, this);
    },
  });
  exports.EventsEmitter = EventsEmitter;
}); /*_EndDefine*/