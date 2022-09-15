//When I started grace, I deliberately chose not to use promises as
//then I felt they were a bit of a new thing,
//Isomorphic git changed my mind on this. Grace core is officially
//the last thing I'm writing without promises
define(function (require, exports, module) {
    /*Manage cpu time in a single threaded language*/
    var UIThread = {
        //when true, tasks can run as long as they want
        isIdle: true,
        idlePromise: null,
    };
    var setIdle;
    var hadMousedown = false;
    //make app cycle toggle even in loops
    UIThread.toggle = require("grace/core/utils").Utils.delay(function () {
        toggleT = 0;
        if (!UIThread.isIdle) {
            //check if user is still using the ui
            if (hadMousedown) {
                hadMousedown = false;
                return UIThread.toggle.later(100);
            }
            //if not, notify all tasks awaiting
            //the promise that thread is now free
            setIdle(true);
            UIThread.isIdle = true;
            setIdle = null;
            UIThread.idlePromise = null;
            window.removeEventListener("mousedown", UIThread.blockIdle);
            window.removeEventListener("touchmove", UIThread.blockIdle);
        } else {
            UIThread.isIdle = false;
            UIThread.idlePromise = new Promise(function (r) {
                setIdle = r;
            });
            window.addEventListener("mousedown", UIThread.blockIdle);
            window.addEventListener("touchmove", UIThread.blockIdle);
            UIThread.toggle();
        }
    }, 30);
    var toggleT = 0;
    UIThread.awaitIdle = function () {
        if (UIThread.isIdle) {
            if (toggleT) {
                //check sync
                if (Date.now() > toggleT) {
                    UIThread.toggle.now();
                }
            } else {
                //check async
                toggleT = Date.now() + 50;
                UIThread.toggle();
            }
        }
        return UIThread.idlePromise;
    };

    UIThread.blockIdle = function () {
        hadMousedown = true;
    };
    exports.UiThread = UIThread;
});