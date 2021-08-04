_Define(function(global) {
    //When I started grace, I deliberately chose not to use promises as
    //then I felt they were a bit of a new thing,
    //Isomorphic git changed mind on this. Grace core is officially
    //the last thing I'm writing without promises
    var Cycle = {
        //when true, tasks can run as long as they want
        isIdle: true,
        idlePromise: null
    };
    var setIdle;
    var hadMousedown = false;
    //make app cycle toggle even in loops
    Cycle.toggle = global.Utils.delay(function() {
        toggleT = 0;
        if (!Cycle.isIdle) {
            //check if user is still using the ui
            if (hadMousedown) {
                hadMousedown = false;
                return Cycle.toggle.later(100);
            }
            //if not, notify all tasks awaiting 
            //the promise that thread is now free
            setIdle(true);
            Cycle.isIdle = true;
            setIdle = null;
            Cycle.idlePromise = null;
            window.removeEventListener('mousedown', blockIdle);
            window.removeEventListener('touchmove', blockIdle);
        } else {
            Cycle.isIdle = false;
            Cycle.idlePromise = new Promise(function(r) {
                setIdle = r;
            });
            window.addEventListener('mousedown', blockIdle);
            window.addEventListener('touchmove', blockIdle);
            Cycle.toggle();
        }
    }, 30);
    var toggleT = 0;
    Cycle.awaitIdle = function() {
        if (Cycle.isIdle) {
            if (toggleT) {
                //check sync
                if (Date.now() > toggleT) {
                    Cycle.toggle.now();
                }
            } else {
                //check async
                toggleT = Date.now() + 50;
                Cycle.toggle();
            }
        }
        return Cycle.idlePromise;
    };
    
    function blockIdle() {
        hadMousedown = true;
    }
    Cycle.blockIdle = blockIdle;
    global.UiThread = Cycle;
});