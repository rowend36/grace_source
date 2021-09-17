#!/data/data/io.tempage.dorynode/files/usr/bin/env node

let main = (() => {
  var _ref = _asyncToGenerator(function* ({
    _: [cmd],
    p,
    d
  }) {
    switch (cmd) {
      case 'start':
        {
          if (d) require('daemonize-process')();

          const cmd = require.resolve('micro/bin/micro.js');

          const args = [cmd, `--listen=tcp://0.0.0.0:${p || 9999}`];
          let server = spawn('node', args, {
            stdio: 'inherit',
            windowsHide: true,
            cwd: __dirname
          });
          fs.writeFileSync(path.join(process.cwd(), 'cors-proxy.pid'), String(process.pid), 'utf8');
          process.on('exit', server.kill);
          return;
        }

      case 'stop':
        {
          let pid;

          try {
            pid = fs.readFileSync(path.join(process.cwd(), 'cors-proxy.pid'), 'utf8');
          } catch (err) {
            console.log('No cors-proxy.pid file');
            return;
          }

          pid = parseInt(pid);
          console.log('killing', pid);
          kill(pid, function (err) {
            if (err) {
              console.log(err);
            } else {
              fs.unlinkSync(path.join(process.cwd(), 'cors-proxy.pid'));
            }
          });
        }
    }
  });

  return function main(_x) {
    return _ref.apply(this, arguments);
  };
})();

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

const fs = require('fs');

const path = require('path');

const {
  spawn
} = require('child_process');

const kill = require('tree-kill');

const minimisted = require('minimisted');

minimisted(main);