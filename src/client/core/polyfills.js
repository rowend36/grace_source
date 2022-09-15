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
    _default.apply(this, arguments);
    //off descendant elements too
    this.filter.apply(this, arguments).find("*").off();
    return this;
  };
})($.fn.remove);
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
  return Array.from(this);
};
var queues = new Map();
var _proceed = function (queue) {
  var next = queue.shift();
  if (!next) {
    return queues.delete(this);
  } else next.call(this, _proceed.bind(this, queue), queue);
};
$.fn.$enqueue = function (next, fn) {
  var _self = this,
    _count = this.length;

  function finish(next) {
    if (--_count === 0) fn.call(_self);
    next();
  }
  this.each(function () {
    //add the callback function
    var queue = queues.get(this) || [];
    queue.push(next);

    if (fn) {
      queue.push(finish);
    }
    //Start the queue
    if (!queues.has(this)) {
      this._id = this._id || Math.floor(Math.random() * 10);
      queues.set(this, queue);
      _proceed.call(this, queue);
    }
  });
  return this;
};
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
          duration: queue._finished
            ? 0
            : speed === "fast" || speed === undefined
            ? 200
            : speed === "slow"
            ? 600
            : isNaN(speed)
            ? 400
            : Number(speed),
          complete: next,
        },
        options
      )
    );
  }

  return this.$enqueue(go, fn);
};
$.fn.fadeIn = function (speed, cb) {
  return this.$enqueue(function (next) {
    $(this).css("opacity", 0).show();
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
$.fn.finish = function () {
  this.each(function () {
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