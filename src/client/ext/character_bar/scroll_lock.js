define(function (require, exports, module) {
    exports.ScrollLock = function ScrollLock() {
        "use strict";
        var scrollData = null;
        var lockTimeout = null;

        function scrollLock(e) {
            if (!scrollData) {
                scrollData = {
                    x: e.target.scrollLeft,
                    vel: 0,
                    orig: e.target.scrollLeft + 20,
                    t: new Date().getTime(),
                    max: 0,
                    detected: false,
                    dir: 0,
                };
                return;
            } else if (scrollData.cancelled) return;
            var detected = scrollData.detected;
            var x = e.target.scrollLeft;
            var dir = x - scrollData.x;
            //change direction
            if (dir * scrollData.dir < 0) {
                if (detected) {
                    clearTimeout(lockTimeout);
                    lockTimeout = null;
                }
                scrollData = null;
                return;
            }
            var t = new Date().getTime();
            var diffT = t - scrollData.t;
            var vel = Math.abs(dir) / diffT;
            scrollData = {
                x: x,
                t: t,
                vel: vel,
                max: Math.max(vel, scrollData.max),
                dir: dir,
                orig: scrollData.orig,
                detected: scrollData.detected,
            };
            if (lockTimeout) {
                if (vel > 0.2) {
                    clearTimeout(lockTimeout);
                    lockTimeout = setTimeout(lockScroll, diffT * 2);
                }
            } else if (scrollData.max > 0.6) {
                //hysterisis 0.2
                scrollData.detected = e.target;
                lockTimeout = setTimeout(lockScroll, diffT * 2);
            }
        }

        function lockScroll() {
            lockTimeout = null;
            var elements = scrollData.detected.getElementsByClassName("scroll-point");
            var scrollLeft = scrollData.detected.scrollLeft;
            var width = scrollData.detected.clientWidth;
            // var right = scrollLeft + width;
            var scrollPointToLeft = 0,
                scrollPointToRight = scrollData.detected.scrollWidth - width;
            for (var i = 0; i < elements.length; i++) {
                var x = elements[i].offsetLeft;
                if (x < scrollLeft) {
                    scrollPointToLeft = x;
                } else {
                    scrollPointToRight = x;
                    break;
                }
            }
            var finalScrollPoint;
            if (scrollData.dir > 0 && scrollPointToLeft <= scrollData.orig) {
                //scrolled left, lock to next
                finalScrollPoint = scrollPointToRight;
            } else if (scrollData.dir < 0 && scrollPointToRight >= scrollData.orig) {
                //scrolled right, lock to previous
                finalScrollPoint = scrollPointToLeft;
            } else {
                //lock to closest since scrollPointToLeft hasn't changed
                if (
                    scrollLeft + scrollData.dir * 2 - scrollPointToLeft <
                    scrollPointToRight - scrollLeft
                ) {
                    finalScrollPoint = scrollPointToLeft;
                } else {
                    finalScrollPoint = scrollPointToRight;
                }
                if (Math.abs(finalScrollPoint - scrollLeft) > width / 2)
                    return (scrollData.cancelled = true);
            }
            animate(scrollLeft, finalScrollPoint - 20);

            scrollData.cancelled = true;
        }
        var animTimeout;

        var ramp = [0, 0.008, 0.032, 0.072, 0.128, 0.2, 0.3, 0.4, 0.5];
        var steps = [];
        for (var j = 0; j < ramp.length - 1; j++) {
            steps.push(ramp[j]);
            steps.push(0.25 * ramp[j + 1] + 0.75 * ramp[j]);
            steps.push(0.5 * (ramp[j] + ramp[j + 1]));
            steps.push(0.25 * ramp[j] + 0.75 * ramp[j + 1]);
        }
        for (var i = steps.length - 2; i >= 0; i--) {
            steps.push(1 - steps[i]);
        }

        var STEPS = steps.length;

        function animate(startX, targetX) {
            var x = 0;
            var delta = targetX - startX;
            var speed = Math.abs(delta) < 100 ? 3 : 1;
            animTimeout = setInterval(function () {
                scrollData.detected.scrollLeft = startX + delta * (STEPS[(x += speed)] | 1);
                if (x >= STEPS) {
                    clearInterval(animTimeout);
                    animTimeout = null;
                }
            }, 13);
        }
        return {
            onScroll: scrollLock,
            onRelease: function () {},
            cancel: function () {
                if (lockTimeout) {
                    clearTimeout(lockTimeout);
                    lockTimeout = null;
                }
                if (animTimeout) {
                    clearInterval(animTimeout);
                    animTimeout = null;
                }
                scrollData = null;
            },
        };
    };
});