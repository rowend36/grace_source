define(function (require, exports, module) {
  'use strict';
  var Utils = require('./utils').Utils;
  var debug = console;
  var setImmediate = Utils.setImmediate;
  /** @typedef {null|Array<Function>|Function} Handlers */

  /**
   * @constructor
   * @typedef {{
   *  i: number,
   *  q: Array<({j: number, ev: string, obj: any, h: null|Function[]})>
   }} EventQueue
   */
  function EventsEmitter(parent) {
    /**
     * @type {Record<string,Handlers|true>}
     */
    this._eventRegistry = {};
    this.debug();
    this._debug = false;
    if (parent)
      throw 'Removed API. Subclass event emitter to use parent emitters';
  }
  EventsEmitter.prototype._debug = false;
  /** @type {EventQueue} */
  EventsEmitter.prototype._eventQueue = undefined;
  /**
   * Prevent registering of events that are not
   * explicitly added in _eventRegistry.
   **/
  EventsEmitter.prototype.checkEvents = false;
  EventsEmitter.prototype.preventDefault = function () {
    this.defaultPrevented = true;
  };
  EventsEmitter.prototype.stopPropagation = function () {
    this.propagationStopped = true;
  };
  EventsEmitter.prototype.createEvent = function (props) {
    return Object.assign(
      {
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault: this.preventDefault,
        stopPropagation: this.stopPropagation,
      },
      props,
    );
  };
  EventsEmitter.prototype.trigger = function (eventName, obj, noEventProps) {
    var reg = this._eventRegistry;
    if (this.checkEvents && !reg.hasOwnProperty(eventName)) {
      debug.warn('Failed to trigger unknown event: ' + eventName);
      return false;
    }
    if (!noEventProps) obj = this.createEvent(obj);
    var handlers = /** @type {Function|Function[]} */ (this._eventRegistry[
      eventName
    ]);
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
  };
  /**
     Trigger an event in a way guarantees arrival order among
     other signalled events similar to using setImmediate.
     Useful for transitioned/changed events.
     One caveat though:
       a->b,[[a->b,a->b], b->c]
       This would have triggered as a->b(3 times) then b->c.
       But with signal, it is in fact a->b(2), b->c,a->b: so a continuity check might also be required.
    */
  EventsEmitter.prototype.signal = function (eventName, obj, addEventProps) {
    var reg = this._eventRegistry;
    if (this.checkEvents && !reg.hasOwnProperty(eventName)) {
      debug.warn('Failed to signal unknown event: ' + eventName);
      return false;
    }
    if (addEventProps) obj = this.createEvent(obj);
    if (!this._eventQueue) this._eventQueue = {i: 0, q: []};
    var c = this._eventQueue;
    c.q.push({j: 0, ev: eventName, obj: obj, h: null});
    try {
      // Sort events by using a shared queue
      for (var m; (m = c.q[c.i]); c.i++) {
        if (!m.h) {
          var handlers = this._eventRegistry[m.ev];
          m.h =
            typeof handlers == 'function'
              ? [handlers]
              : Array.isArray(handlers)
              ? handlers.slice(0)
              : [];
        }
        for (; m.j < m.h.length; ) {
          if (m.obj && m.obj.propagationStopped) break;
          m.h[m.j++].call(null, m.obj); //can recursively finish outer loops
        }
      }
    } finally {
      c.q.pop();
      c.i = c.q.length;
    }
    return obj;
  };
  /**
   * Trigger an event that can be delayed(or repeated).
   * Used for destructor events.
   */
  EventsEmitter.prototype.asyncTrigger = function (
    eventName,
    props,
    onTasksHandled,
  ) {
    var task = Object.assign({}, props);
    var counter,
      tokens = [];
    task.tags = Object.create(null);
    task.repeat = function () {
      task.isDelayed = false;
      var ev = this.createEvent(task);
      counter = Utils.createCounter(onTasksHandled.bind(this, ev));
      //Can use signal or trigger. Use signal because of closeTab instead of flush.
      this.signal(eventName, ev, false);
      counter.increment();
      counter.decrement();
      return ev;
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
  };
  /**
   * Trigger an event that fires on all present and future listeners.
   */
  EventsEmitter.prototype.triggerForever = function (eventName) {
    if (this._eventRegistry[eventName] !== true)
      this.trigger(eventName, null, true);
    this._eventRegistry[eventName] = true;
  };
  //Clone handlers to prevent counter errors
  EventsEmitter.prototype.on = function (event, func, capture) {
    if (typeof event !== 'string' || !func)
      return debug.error('Invalid event listener: ', event, func);
    var reg = this._eventRegistry;
    if (this.checkEvents && !reg.hasOwnProperty(event)) {
      debug.warn('Failed to register unknown event: ' + event);
      return false;
    }
    //_emit check allows use as mixin of other event_emitter implementation
    var old = reg[event];
    if (!old) {
      // @ts-ignore - _emit is not a property
      if (!this._emit) reg[event] = func;
      else reg[event] = [func];
    } else if (old === true) setImmediate(func);
    else {
      if (typeof old == 'function') old = reg[event] = [old];
      if (capture) old.unshift(func);
      else old.push(func);
    }
  };
  EventsEmitter.prototype.off = function (event, func) {
    var reg = this._eventRegistry[event];
    if (!reg || !func) return;
    if (typeof reg == 'function') {
      if (reg == func) this._eventRegistry[event] = null;
    } else if (reg !== true) {
      Utils.removeFrom(reg, func);
    }
  };
  EventsEmitter.prototype.once = function (event, func, capture) {
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
  };
  EventsEmitter.prototype.debug = function () {
    if (this._debug) return;
    this._debug = true;
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
  };
  exports.EventsEmitter = EventsEmitter;
}); /*_EndDefine*/