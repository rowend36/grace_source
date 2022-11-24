define(function (require, exports, module) {
    exports.SwipeDetector = function SwipeDetector(bottomBar, updateBar) {
        "use strict";
        var startTimeT = 0;
        var startX = 0,
            startY = 0,
            originalStartY = 0;
        var swipeConfig = {
            swipeThreshold: 0.7,
            distanceThreshold: 30,
            dragThreshold: 100,
            failThreshold: 100,
        };
        var swipeDetected = false;
        var swipeFailed = false;

        function startSwipe(e) {
            if (e.touches) {
                e = e.touches[0];
            }
            originalStartY = e.clientY;
            startTimeT = e.timeStamp;
            startY = originalStartY;
            startX = e.clientX;
            swipeDetected = false;
            swipeFailed = false;
        }

        function detectSwipe(e) {
            if (swipeFailed || swipeDetected) {
                return;
            }
            var t = e.timeStamp;
            if (e.touches) {
                e = e.touches[0];
            }
            var l = e.clientY;
            var m = e.clientX;
            if (t - startTimeT < 500) {
                var dy = l - startY;
                var dx = m - startX;
                var dragT = Math.abs(l - originalStartY);
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (Math.abs(dx) > Math.abs(dy) * 3) swipeFailed = true;
                    //
                } else if (dragT > swipeConfig.distanceThreshold) {
                    var vt = Math.abs(dy / (t - startTimeT));
                    if (vt > swipeConfig.swipeThreshold || dragT > swipeConfig.dragThreshold) {
                        swipeDetected = true;
                        if (dy < 0 && !bottomBar.hasClass("toolbar-unfold")) {
                            bottomBar.addClass("toolbar-unfold");
                            updateBar(true);
                        } else if (dy > 0 && bottomBar.hasClass("toolbar-unfold")) {
                            bottomBar.removeClass("toolbar-unfold");
                            updateBar(false);
                        }
                    }
                }
            }
            startX = m;
            startY = l;
            startTimeT = t;
        }
        return {
            start: startSwipe,
            move: detectSwipe,
        };
    };
});