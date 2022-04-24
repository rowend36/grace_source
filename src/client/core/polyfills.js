/*globals $, M*/
["click", "mousedown", "submit"].forEach(function(a) {
  $.fn[a] = function(cb) {
    if (arguments.length === 0) {
      return this.trigger(a);
    } else {
      if (cb === false) {
        cb = function(ev) {
          ev.preventDefault();
        };
      }
      return this.on(a, cb);
    }
  };
});
["focus", "blur"].forEach(function(a) {
  $.fn[a] = function(cb) {
    if (!this.length) return;
    if (arguments.length === 0) {
      return this[0].focus();
    } else {
      if (cb === false) {
        cb = function(ev) {
          ev.preventDefault();
        };
      }
      return this.on(a, cb);
    }
  };
});
$.fn.remove = (function(_default) {
  return function() {
    _default.apply(this, arguments);
    //off descendant elements too
    this.filter.apply(this, arguments).find("*").off();
    return this;
  };
})($.fn.remove);
$.fn.toArray = function() {
  return Array.from(this);
};
var queues = new WeakMap();
var _proceed = function(queue) {
  var next = queue.shift();
  if (!next) {
    queues.delete(this);
  } else next.call(this, _proceed);
};
$.fn.animate = function(props, speed, fn) {
  var _self = this,
    _count = this.length;
  if (typeof speed === 'function') fn = speed;
  this.each(function() {
    var queue = queues.get(this) || [];
    queue.push(function(next) {
      var target = this;
      var options = Object.assign({}, props, {
        targets: target,
      });
      queue._current = M.anime(
        Object.assign({
            duration: queue._finished ?
              0 : speed === "fast" || speed === undefined ?
              200 : speed === "slow" ?
              600 : isNaN(speed) ?
              400 : Number(speed),
            complete: function() {
              next.call(target, queue);
            },
          },
          options
        )
      );

    });

    //add the callback function
    if (fn) {
      queue.push(
        function(n) {
          if (--_count === 0)
            fn.call(_self);
          n.call(this, queue);
        }.bind(this)
      );
    }
    //Start the queue
    if (!queues.has(this)) {
      queues.set(this, queue);
      _proceed.call(this, queue);
    }
  });
  return this;
};
$.fn.fadeIn = function(speed, cb) {
  this.css("opacity", 0).show();
  return this.animate({
      opacity: 1,
      easing: "linear",
    },
    speed,
    cb
  );
};
$.fn.fadeOut = function(speed, cb) {
  return this.animate({
      opacity: 0,
      easing: "linear",
    },
    speed,
    function() {
      $(this).hide();
      cb && cb.apply(this);
    }.bind(this)
  );
};
$.fn.delay = function(duration) {
  return this.animate({
    duration: duration,
  });
};
$.fn.finish = function() {
  this.each(function() {
    var queue = queues.get(this);
    if (queue) {
      queues.delete(this);
      queue._finished = true;
      if (queue._current) {
        queue._current.seek(100);
      }
    }
  });
  return this;
};
$.fn.jquery = "test";