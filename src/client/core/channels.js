define(function (require, exports, module) {
  'use strict';
  /**
   * Like events, channels allow one to fire events
   * that will be handled by other parts of code.
   * However, now these parts might not even be loaded yet!
   * This is mostly used by factories but can also be for using
   * code without loading it, e.g setting fileview options.
   */
  var EventsEmitter = require('./events_emitter').EventsEmitter;
  /** @type {EventsEmitter & Any} */
  var channels = new EventsEmitter();
  //Don't warn for unknown channels
  channels.frozenEvents = false;
  channels.handlers = {};
  exports.Channels = {
    ownChannel: function (channel, owner) {
      if (channels.handlers[channel]) {
        throw 'Channel ' + channel + ' already has owner';
      }
      channels.handlers[channel] = owner;
      channels.triggerForever(channel);
    },
    channelHasPending: function (id) {
      return (
        channels._eventRegistry[id] &&
        channels._eventRegistry[id] !== true
      );
    },
    postChannel: function (channel, arg1, arg2, arg3, arg4) {
      channels.once(channel, function () {
        var handler = channels.handlers[channel];
        handler.call(null, arg1, arg2, arg3, arg4);
      });
    },
  };
});