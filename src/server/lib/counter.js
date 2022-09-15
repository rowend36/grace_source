module.exports = function createCounter(callback) {
  var counter = {};
  counter.callback = callback;
  counter.count = 0;
  counter.errors = [];
  counter.error = function (e) {
    counter.errors.push(e);
    counter.decrement(e.from);
  };
  counter.increment = function (/*name*/) {
    counter.count++;
  };
  counter.decrement = function (/*name*/) {
    counter.count--;
    //console.log(counter.count);
    if (counter.count === 0 && counter.callback) {
      if (counter.errors.length < 1) counter.callback();
      else this.callback(counter.errors);
    } else if (counter.count < 0) {
      throw new Error('Counter error less than 0');
    }
  };
  return counter;
};