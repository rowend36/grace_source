const proxy = postMessage => {
  'use strict';
  const stringify = typeof printObject ? printObject : () => {};
  let console = self.console;
  let nextId = 0;
  let waiting = Object.create(null);
  const truncate = (str, len) =>
    str.length > len ? str.slice(0, len - 3) + '[...]' : str;
  let remoteCall = (ref, method, args) => {
    let _id = ++nextId;
    postMessage({
      _id,
      obj: ref && Ref.serialize(ref),
      method,
      args: args.map(Ref.serialize),
      type: 'proxyMethod',
    });
    let stack = new Error().stack;
    return new Promise((r, j) => {
      waiting[_id] = [r, j, stack];
    });
  };
  let handleMessage = data => {
    if (!data) return false;
    if (data.type === 'sendMessage') return Ref.parse(data.res);
    else if (data.type === 'proxyMethod' || data.type === 'proxyResponse') {
      _handleMessage(data);
      return true;
    } else return false;
  };
  let _handleMessage = async data => {
    if (data.type === 'proxyMethod') {
      const {method, args, obj, _id} = data;
      let res, error;
      try {
        const params = await Promise.all(args.map(e => Ref.parse(e).toValue()));
        const ctx = await (obj ? Ref.parse(obj) : Ref.of(self));
        if (nextId > 500) {
          if (params[0] === 'constructor' || params[0] === '__proto__')
            console.log(ctx.res.val);
          console.assert(ctx.isLocal());
          console.log(method, params);
        }
        res = await ctx[method](...params);
        if (nextId > 500) {
          if (params[0] === 'constructor' || params[0] === '__proto__')
            console.log(
              method,
              ctx.res.val,
              params[0],
              res,
              typeof res || 'undefined'
            );
        }
      } catch (e) {
        error = e;
      }
      postMessage({
        type: 'proxyResponse',
        _id,
        error: error && Ref.serialize(error),
        res: data.method === 'listProps' ? res : Ref.serialize(res),
      });
    } else if (data.type === 'proxyResponse') {
      let m = waiting[data._id];
      let [error, res] = [
        data.error ? await Ref.parse(data.error).toValue(1) : undefined,
        data.error ? undefined : Ref.parse(data.res),
      ];
      if (m) {
        delete waiting[data._id];
        m[error ? 1 : 0](
          error ? ((error.stack += '\n===\n' + m[2]), error) : res
        );
      }
    }
  };
  let sendMessage = obj => {
    postMessage({
      type: 'sendMessage',
      res: Ref.serialize(obj),
    });
  };
  class Ref {
    /**
     * A ref is an object shared by two or more processes.
     * It is either a remote object, a local object or a combination of both.
     */
    constructor(res) {
      this.res = res;
    }
    static serialize(obj) {
      let m = Ref._serialize(obj);
      if (!obj && m.val) throw 'Bad serial';
      return m;
    }
    static _serialize(obj) {
      if (builtins.indexOf(obj) > -1)
        return {
          type: 'builtin',
          index: builtins.indexOf(obj),
        };
      else if (obj instanceof Ref) {
        return obj.isLocal()
          ? Ref.serialize(obj.res.val)
          : {type: 'ref', id: obj.res.id, preview: obj.res.preview};
      } else if (typeof obj === 'function' || typeof obj === 'object')
        return obj === null
          ? {val: null}
          : {
              type: typeof obj,
              preview: truncate(stringify(obj) || '', 40),
              id: getRefId(obj),
            };
      return {val: obj};
    }
    static parse(res) {
      if (res.type === 'builtin') return Ref.of(builtins[res.index]);
      if (res.type === 'ref') {
        let ref = getRef(res.id);
        if (!ref) throw new Error('Missing Ref ' + res.preview + ' #' + res.id);
        return Ref.of(ref);
      }
      return new Ref(res);
    }
    static of(res) {
      return new Ref({val: res});
    }
    isLocal() {
      return !this.res.id;
    }
    /** @returns {Promise<Ref>} */
    async call(prop, ...args) {
      if (this.isLocal()) return Ref.of(this.res.val[prop](...args));
      return await remoteCall(this, 'call', [prop, ...args]);
    }
    /** @returns {Promise<Ref>} */
    async getProp(name) {
      if (this.isLocal()) {
        try {
          return Ref.of(safeGet(this.res.val, name));
        } catch (e) {
          return Ref.of('<incompatible_getter>');
        }
      }
      return await remoteCall(this, 'getProp', [name]);
    }
    /** @returns {Promise<void>} */
    async setProp(name, val) {
      if (this.isLocal()) return (this.res.val[name] = val), undefined;
      return await remoteCall(this, 'setProp', [name, val]);
    }
    /** @returns {Promise<Array<String>>} */
    async listProps() {
      if (this.isLocal()) return Object.getOwnPropertyNames(this.res.val);
      return (await remoteCall(this, 'listProps', [])).res;
    }
    toString() {
      return this.isLocal() ? String(this.res.val) : this.res.preview;
    }
    async _addProps(obj, props, depth, counter, cache) {
      if (depth < 1) return;
      let HOLE = {};
      //This is done first before the Ref might be garbage collected.
      console.warn('Getting props ' + props.length);
      let vals = await Promise.all(
        props.map(e => {
          try {
            return this.getProp(e);
          } catch (e) {
            return HOLE;
          }
        })
      );
      try {
        console.warn('Getting shallow values');
        await Promise.all(
          vals.map(async (prop, i) => {
            let val;
            if (prop === HOLE) {
              cache.depth = 0;
              return;
            }
            try {
              val = await prop.toValue(0, counter);
            } catch (e) {
              if (
                e.message === Ref.MAX_RECURSION ||
                e.message.startsWith('Missing Ref')
              ) {
                cache.depth = 0;
              }
              return;
            }
            let propCache = getCache(prop.res.id);
            if (propCache && cache.depth > propCache.depth + 1) {
              cache.depth = propCache.depth + 1;
            }
            try {
              obj[props[i]] = val;
            } catch (e) {}
          })
        );

        console.warn('Getting deep values');
        if (depth > 1)
          await Promise.all(
            vals.map(async (prop, i) => {
              if (obj.hasOwnProperty(props[i]))
                prop.toValue(depth - 1, counter);
            })
          );
      } catch (e) {
        console.error('Failed to deepen: ' + (e.stack || e));
      }
    }
    static MAX_RECURSION = 'Max recursion for toValue exceeded!!!';
    /**
     * Recursively copy a remote object over to this process.
     * Throws if the ref(or its constructor) has been garbage collected.
     * Will stop adding properties once counter.count or depth <1.
     *
     */
    async toValue(depth = 1, counter = {count: SEG_SIZE * 2}) {
      if (this.isLocal()) return this.res.val;
      let cache = getCache(this.res.id);
      if (cache) {
        let {obj, depth: _depth} = cache;
        if (_depth < depth) {
          let props = _depth > 0 ? Object.keys(obj) : await this.listProps();
          cache.depth = depth;
          await this._addProps(obj, props, depth, counter, cache);
        }
        return obj;
      }
      if (--counter.count < 1 || depth < 0) throw new Error(Ref.MAX_RECURSION);
      let constructor = await this.getProp('constructor');

      let obj;
      if (
        false &&
        constructor.isLocal() &&
        (await constructor.toValue()) === Array
      ) {
        obj = [];
        obj.length = await (await this.getProp('length')).toValue(0, counter);
      } else {
        switch (this.res.type) {
          case 'object':
            let proto = constructor.isLocal()
              ? await constructor.getProp('prototype')
              : await this.getProp('__proto__');
            let val;
            try {
              val =
                proto.res.id === this.res.id
                  ? Object.prototype
                  : await proto.toValue(Math.max(0, depth - 1), counter);
            } catch (e) {}
            obj =
              val === undefined || typeof val === 'string'
                ? {}
                : Object.create(val);
            break;
          case 'function':
            let name = await (await constructor.getProp('name')).toValue(
              1,
              counter
            );
            if (name === 'AsyncFunction')
              obj = Ref.asyncInvoke.bind(null, this);
            else {
              obj = Ref.syncInvoke.bind(null, this);
            }
            Object.defineProperty(obj, 'name', {
              value: String(
                await (await this.getProp('name')).toValue(0, counter)
              ),
            });
            try {
              obj._toString = await (await this.call('toString')).toValue(
                1,
                counter
              );
              obj.toString = _toString;
            } catch (e) {}
        }
      }

      let props = await this.listProps();
      cache = {depth: depth, obj};
      setCache(this.res.id, cache);
      await this._addProps(obj, props, depth, counter, cache);
      return obj;
    }
    static async asyncInvoke(self, ...args) {
      const p = await self.call('call', this, ...args);
      return new Promise((r, j) => {
        p.call('then', r, j);
      });
    }
    static syncInvoke(self, ...args) {
      return self.call('call', this, ...args).then(e => e.toValue());
    }
  }
  const _toString = function () {
    return this._toString;
  };
  const AsyncFunction = (async () => {}).constructor;
  const builtins = [
    Object,
    Number,
    String,
    RegExp,
    Array,
    Symbol,
    Function,
    AsyncFunction,
    ArrayBuffer,
    Error,
    DataView,
    // typeof window ? window : 'Window',
    // typeof window ? NaN : 'globalThis',
    Object.prototype,
  ];
  let ids = new WeakMap();
  const getRefId = obj => {
    if (nextId > 1000) throw new Error('No space for ' + stringify(obj));
    let oldId = ids.get(obj);
    if (oldId && getRef(oldId)) return oldId;
    ids.set(obj, ++nextId);
    setRef(nextId, obj);
    return nextId;
  };
  const safeGet = (val, name) => {
    let p = val[name];
    if (p && typeof p.then === 'function') {
      p.catch(() => {});
    }
    return p;
  };
  //Primitive Timed Garbage Collector
  const memory = {
    /** @type {Object.<number, any>} */
    local: [0, 1, 2, 3, 4].map(e => Object.create(null)),
    /** @type {Object.<number, {depth:number,obj:any}>} */
    cached: [0, 1, 2, 3, 4].map(e => Object.create(null)),
  };
  let count = {local: 0, cached: 0};
  const SEG_SIZE = 10;
  let timers = {local: null, cached: null};
  const gc = (seg, force) => {
    if (!force && count[seg] < SEG_SIZE) {
      count[seg]++;
      if (count[seg] === 0)
        timers[seg] = setTimeout(gc.bind(null, seg, true), 30000);
      return;
    }
    clearTimeout(timers[seg]);
    timers[seg] = null;
    count[seg] = 0;
    memory[seg].splice(1, 1);
    memory[seg].push(Object.create(null));
    console.log(seg, Object.keys(memory[seg][3]).join(','));
  };
  const read = (seg, id, block) => {
    if (typeof block !== 'number') block = 4;
    if (memory[seg][block][id]) {
      if (block !== 4) write(seg, id, memory[seg][block][id]);
      return memory[seg][4][id];
    } else if (block > 0) return read(seg, id, block - 1);
  };
  const write = (seg, id, obj) => {
    gc(seg);
    memory[seg][4][id] = obj;
  };
  const getRef = read.bind(null, 'local');
  const setRef = write.bind(null, 'local');
  const getCache = read.bind(null, 'cached');
  const setCache = write.bind(null, 'cached');
  return [handleMessage, sendMessage, remoteCall];
};
