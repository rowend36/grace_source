/*globals $, M*/
/*Port jquery features to cash-dom and shave a few kb of dependencies*/
["click", "mousedown", "change", "submit"].forEach(function (a) {
  $.fn[a] = function (cb) {
    if (arguments.length === 0) {
      return this.trigger(a);
    } else {
      if (cb === false) {
        cb = function (ev) {
          ev.preventDefault();
        };
      }
      return this.on(a, cb);
    }
  };
});
["focus", "blur"].forEach(function (a) {
  $.fn[a] = function (cb) {
    if (!this.length) return;
    if (arguments.length === 0) {
      return this[0].focus();
    } else {
      if (cb === false) {
        cb = function (ev) {
          ev.preventDefault();
        };
      }
      return this.on(a, cb);
    }
  };
});
$.fn.remove = (function (_default) {
  return function () {
    //off descendant elements too
    this.filter.apply(this, arguments).find("*").off();
    _default.apply(this, arguments);
    return this;
  };
})($.fn.remove);
$.fn.html = (function (_default) {
  return function () {
    this.find("*").off();
    return _default.apply(this, arguments);
  };
})($.fn.html);
$.fn.attr = (function (_default) {
  return function (attr, val) {
    if (arguments.length > 1) {
      if (!val) {
        switch (attr) {
          case "checked":
          case "disabled":
            return this.removeAttr(attr);
        }
      }
    }
    return _default.apply(this, arguments);
  };
})($.fn.attr);
$.fn.toArray = function () {
  return this.get();
};
(function () {
  var queues = new Map();
  var _proceed = function (queue) {
    try {
      var next = queue.shift();
      if (!next) {
        return queues.delete(this);
      } else next.call(this, _proceed.bind(this, queue), queue);
    } catch (e) {
      setTimeout(function () {
        throw e;
      });
      queue.length = 0;
      queues.delete(queue);
    }
  };
  $.fn.$enqueue = function (next, fn) {
    var _self = this,
      _count = this.length;
    if (_count < 1) return fn.call(_self), _self;
    function finish(next) {
      if (--_count === 0) fn.call(_self);
      next();
    }
    this.each(function () {
      //add the callback function
      var queue = queues.get(this) || [];
      if (next) queue.push(next);
      if (fn) queue.push(finish);
      //Start the queue
      if (!queues.has(this)) {
        queues.set(this, queue);
        _proceed.call(this, queue);
      }
    });
    return this;
  };
  $.fn.finish = function () {
    var pending = this.filter(function () {
      return queues.has(this);
    });
    if (pending.length === 0) return this;
    var start = [],
      i = pending.length;
    pending
      .$enqueue(function (next) {
        //Wait for all queues to finish before calling start
        if (--i === 0)
          start.forEach(function (e) {
            e();
          });
        next();
      })
      .each(function () {
        var queue = queues.get(this);
        //should always be true
        if (queue) {
          queues.delete(this);
          queue._finished = true;
          if (queue._current) {
            queue._current.seek(queue._current.duration);
          }
        }
      });
    return this.$enqueue(function (next) {
      if (i === 0) next();
      else start.push(next);
    });
  };
})();
$.fn.animate = function (props, speed, fn) {
  if (typeof speed === "function") fn = speed;
  function go(next, queue) {
    var target = this;
    var options = Object.assign({}, props, {
      targets: target,
    });
    queue._current = M.anime(
      Object.assign(
        {
          duration:
            speed === "fast" || speed === undefined
              ? 200
              : speed === "slow"
              ? 600
              : isNaN(speed)
              ? 400
              : Number(speed),
          complete: next,
        },
        options,
        queue._finished ? {duration: 0} : null
      )
    );
  }

  return this.$enqueue(go, fn);
};
$.fn.fadeIn = function (speed, cb) {
  return this.$enqueue(function (next) {
    if ($(this).css("display") === "none") $(this).css("opacity", 0).show();
    next();
  }).animate(
    {
      opacity: 1,
      easing: "linear",
    },
    speed,
    cb
  );
};
$.fn.fadeOut = function (speed, cb) {
  return this.animate(
    {
      opacity: 0,
      easing: "linear",
    },
    speed,
    function () {
      $(this).hide();
      cb && cb.apply(this);
    }.bind(this)
  );
};

$.fn.delay = function (duration) {
  return this.animate({
    duration: duration,
  });
};
$.fn.jquery = "grace";