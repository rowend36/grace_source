define(function (require, exports, module) {
    /*globals $*/
    var allTools = require('./all_tools').allTools;
    var mods = require('./mods').Mods;
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            repeatingKeyIntervalMs: 20,
            repeatingActionIntervalMs: 100,
            repeatingKeyStartDelayMs: 700,
        },
        'toolbars'
    );
    exports.RepeatDetector = function RepeatDetector(execCommand) {
        'use strict';
        var repeatTimeout;

        function getIdentifier(e) {
            if (e && e.originalEvent && e.changedTouches) {
                return 'touch-' + e.changedTouches[0].identifier;
            }
            return 'repeat';
        }
        var pressedElems = [];

        function startLongPress(e) {
            var target = $(e.target).closest('button');
            if (!target.length) return;
            target.addClass('pressed');
            pressedElems.push(target);
            var key = target.attr('id');
            var targetSpeed, handler;
            if (/shift|alt|ctrl/.test(key)) {
                return mods.startHold(key, getIdentifier(e), target);
            }
            var tool = allTools[key];
            if (!tool) return;
            if (repeatTimeout) return; //should not happen
            if (tool.onhold == 'repeatKey') {
                key = key.slice(2);
                handler = mods.dispatch;
                targetSpeed = appConfig.repeatingKeyIntervalMs;
            } else if (tool.onhold == 'repeat') {
                handler = execCommand;
                targetSpeed = appConfig.repeatingActionIntervalMs;
            } else return;
            if (getIdentifier(e) == 'touch-1') {
                pendingClick = {
                    id: 'touch-1',
                    key: key,
                    func: handler,
                    time: e.timeStamp,
                };
            }
            var speed = targetSpeed * 5;
            var a = function () {
                handler(key);
                speed = speed * 0.7 + targetSpeed * 0.3;
                repeatTimeout = setTimeout(a, speed);
            };
            repeatTimeout = setTimeout(a, appConfig.repeatingKeyStartDelayMs);
        }
        var pendingClick;

        function clearRepeat() {
            mods.stopHold();
            clearTimeouts();
        }

        function clearTimeouts() {
            if (repeatTimeout) {
                for (var i in pressedElems) {
                    pressedElems[i].removeClass('pressed');
                }
                pressedElems.length = 0;
                clearTimeout(repeatTimeout);
                repeatTimeout = null;
            }
        }

        function stopLongPress(e) {
            var identity = getIdentifier(e);
            mods.stopHold(identity);
            if (
                pendingClick &&
                new Date().getTime() - pendingClick.time <
                    appConfig.repeatingKeyStartDelayMs
            ) {
                pendingClick.func(e);
                pendingClick = null;
            }
            setTimeout(mods.update);
            clearTimeouts();
        }

        return {
            end: stopLongPress,
            start: startLongPress,
            cancel: clearRepeat,
        };
    };
});