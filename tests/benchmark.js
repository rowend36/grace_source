function collateAndPush(arr) {
    var uniq = {};
    for (var i = 0; i < arr.length; i++) {
        uniq[arr[i]] = true;
    }
    var res = [];
    for (var k in uniq) res.push(k);
    return res;
}

function checkAndPush(arr) {
    var res = [];
    var uniq = {};
    for (var i = 0; i < arr.length; i++) {
        if (!uniq[arr[i]]) {
            uniq[arr[i]] = true;
            res.push(arr[i]);
        }
    }
    return res;
}

function checkInPlace(arr) {
    var uniq = {};
    var t = 0;
    for (var i = 0; i < arr.length; i++) {
        if (!uniq[arr[i]]) {
            uniq[arr[i]] = true;
            arr[t] = arr[i];
            t++;
        }
    }
    arr.length = t;
    return arr;
}

function checkAndSplice(arr) {
    var res = arr.concat([]);
    var uniq = {};
    t = 0;
    for (var i = 0; i < arr.length; i++) {
        if (uniq[arr[i]]) {
            res.splice(i - t, 1);
            t++;
        }
        else uniq[arr[i]] = true;
    }
    return res;
}

function indexOf(arr) {
    var res = [];
    for (var i = 0; i < arr.length; i++) {
        if (res.indexOf(arr[i]) < 0) res.push(arr[i]);
    }
    return res.sort();
}

function indexOfInPlace(arr) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) {
        if (t < 1 || arr.lastIndexOf(arr[i], t - 1) < 0) arr[t++] = arr[i];
    }
    arr.length = t;
    return arr.sort();
}

function sortAndPush(a, sorted) {
    sorted || a.sort();
    var b = [];
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== a[i - 1]) {
            b.push(a[i]);
        }
    }
    return b;
}

function sortInPlace(a, sorted) {
    sorted || a.sort();
    var t = 0;
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== a[i - 1]) {
            a[t++] = a[i];
        }
    }
    a.length = t;
    return a;
}

function sortAndSplice(arr, sorted) {
    sorted || arr.sort();
    var spliced = 0;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == arr[i - 1]) {
            arr.splice(i, 1);
            spliced++;
            i--;
        }
    }
    return arr;
}
/*/Conclusion
->checks are the fastest for non-unique but only good for strings
->sorts are the next best (up to 10x slower for non-unique,1.5-2x faster for unique)
-->or the best if the list is already unique
->indexOf are the goto(1.5x-2.5x) slower if the list order should be kept and is not sorted
-->However their performance reduces exponentially with the resulting list size
->splices are the worst for any sufficiently non-unique list 
--->and not much better than in place for unique
->inplace methods have little/no impact unless in indexOf
--->where the native indexOf seems faster than lastIndexOf
->collects were my first implementation of checks
   Conclusion: Use sorts 90% of the time
   especially if you need a sorted list at the end
   They have a more constant performance
   checks are super powered for strings
/*/

function genUnique(size) {
    var item = 0;
    var arr = [];
    for (var i = 0; i < size; i++)
        arr.push("item" + i);
    return arr;
}

function genDuplicate(size) {
    var arr = size > 300 ? genDuplicate(size / 2) : genUnique(size / 2);
    for (var b = arr.length; b-- > 0;) {
        arr.push(arr[b]);
    }
    return arr;

}

function test(func, each, done, timeframe) {
    var t = new Date().getTime();
    func();
    func();
    var duration = ((new Date().getTime() - t) || 1) * 0.5;
    var size = Math.floor(1000 / duration);
    var times = 0;
    var runs = 0;
    var toDiscard = 3;
    var finishT = t + (timeframe || 5000);

    function burst() {
        runs++;
        var start = new Date();
        for (var i = 0; i < size; i++) {
            func();
        }
        var end = new Date();

        var time = (end.getTime() - start.getTime());
        times += time;
        each && each(time, size, runs, times, runs < toDiscard);
        if (end.getTime() > finishT) done(times, size * runs, runs);
        else {
            if (runs == toDiscard) {
                runs = 0;
                times = 0;
                toDiscard = -1;
            }
            setTimeout(burst, duration * 5);
        }
    }
    burst();
}

function profile(case1, case2, etc) {
    console.log("Starting....");
    var cases = Array.prototype.slice.apply(arguments, [0]);
    var state = 0;
    var last = 0;
    function next() {
        console.log(cases[state].name);
        cases[state].start && cases[state].start()
        test(cases[state].func, function(batchTime, batchSize, numBatches, totalTime, willDiscard) {
            if (totalTime - last > 1000) {
                last = totalTime;
                //console.log("Run " + numBatches + "] time:" + (batchTime/batchSize)*1000 + "ms");
            }
        }, function() {
            cases[state].end && cases[state].end.apply(null,arguments);
            if (paused) {
                console.error("Paused");
                waiting = true;
            }
            else {
                if (++state < cases.length)
                    setTimeout(next);
            }
        });
    }
    var paused = false;
    var waiting = false;

    function pause() {
        paused = !paused;
        alert();
        if (paused) {
            console.log("Pausing.....");
        }
        else if (waiting) {
            waiting = false;
            next();
        }
    }
    setTimeout(next);
    return pause;
}
function createCase(func,gen,size,name){
    name = name || func.name+":"+gen.name+"  "+size;
    var args = gen(size);
    return {
        name: name,
        func: function(){
            func(args)
        },
        end: function(totalTime, totalSize, numBatches){
            console.log("Total runs:" + totalSize + " in " + totalTime + " ms |- " + (totalTime / totalSize) * 1000 / size + "ms/1000el");
        }
    }
}
var pause = profile(createCase(checkInPlace, genUnique,50),
    createCase(sortInPlace, genUnique,50),
    createCase(checkInPlace, genDuplicate,50),
    createCase(sortInPlace, genDuplicate,50),
    createCase(checkInPlace, genUnique,5000),
    createCase(sortInPlace, genUnique,5000),
    createCase(checkInPlace, genDuplicate,5000),
    createCase(sortInPlace, genDuplicate,5000));
window.addEventListener("click", pause);