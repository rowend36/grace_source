const OPEN = '[![+[-';
const CLOSE = '-]+]!]';
const noop = () => {};
const cyclic = () => {
  let p = [];
  let i = 0;
  return function m(key, val) {
    if (val instanceof Promise) val.catch(noop);
    if (++i > 500) return undefined;
    if (typeof val === 'object' && val !== null) {
      if (p.indexOf(val) > -1) return OPEN + '<cyclic>' + CLOSE;
      if (p.length > 500) return OPEN + '<truncated>' + CLOSE;
      p.push(val);
      if (Array.isArray(val)) {
        val =
          val.length > 100
            ? OPEN +
              'Array(' +
              val.length +
              ')' +
              printObject(val.slice(0, 100), m) +
              '...' +
              CLOSE
            : val;
      }
    } else if (typeof val === 'function') {
      return OPEN + val.toString() + CLOSE;
    }
    return val;
  };
};
const printObject = (obj, m) => {
  try {
    return (
      (typeof obj === 'object' &&
      obj &&
      obj.constructor &&
      obj.constructor !== Object
        ? obj.constructor.name
        : '') +
      String(JSON.stringify(obj, m || cyclic(), 2)).replace(
        /"\[\!\[\+\[\-|\-\]\+\]\!\]"/g,
        ''
      )
    );
  } catch (e) {
    return e.message;
  }
};