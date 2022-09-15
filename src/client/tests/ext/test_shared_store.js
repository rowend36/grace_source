define(function (require, exports, module) {
  "use strict";
  var expect = require("chai").expect;
  var SharedStore = require("grace/ext/storage/shared_store").SharedStore;
  var Utils = require("grace/core/utils").Utils;
  var Perf = require("grace/ext/profiler");
  var KEY = "SharedStore";
  describe("SharedStore.stack", function () {
    var stack;
    beforeEach(function () {
      stack = new SharedStore().stack;
    });
    it("should insert in right position", function () {
      var nodes = [
        {
          version: "1",
          base: 0,
        },
        {
          version: "2",
          base: "1",
        },
        {
          version: "3",
          base: "1",
        },
      ];
      stack.reset(nodes.shift());
      nodes.forEach(function (node, i) {
        expect(stack.insertChild(node)).to.equal(i + 1);
      });
    });
    //TODO more tests
  });
  describe("SharedStore", function () {
    var DELAY = 120;
    var RERUNS = 1;
    var remoteStore;
    function getRemoteStore(id) {
      var iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      var remoteStorage = iframe.contentWindow.localStorage;
      var store = new SharedStore(KEY);
      store.transport.backend = remoteStorage;
      store.id = id;
      store.transport.connect();
      var onStorage = store.transport.$onStorage;
      store.transport.disconnect();
      store.transport.connect = function () {
        iframe.contentWindow.addEventListener("storage", onStorage);
      };
      store.transport.disconnect = function () {
        iframe.contentWindow.removeEventListener("storage", onStorage);
      };
      store.destroy = function () {
        store.transport.disconnect();
        iframe.remove();
        iframe = store = null;
      };
      return store;
    }
    before(function () {
      remoteStore = getRemoteStore("remote");
      remoteStore.transport.connect();
    });
    beforeEach(function () {
      remoteStore._hasRead = false;
      remoteStore.stack.events = [];
      remoteStore.onEdit = Utils.noop;
      console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n\n");
    });
    after(function () {
      remoteStore.destroy();
    });
    function getStore(id) {
      var a = new SharedStore(KEY);
      a.id = id;
      return a;
    }
    for (var i = 0; i < RERUNS; i++) {
      it("should receive events", function (done) {
        var a = new SharedStore(KEY);
        a.onEdit = function (changes, isLocal) {
          if (!isLocal) {
            try {
              expect(changes).to.deep.have.members([
                { type: -1, items: ["none"] },
                { type: 1, items: ["text"] },
              ]);
              done();
            } catch (e) {
              done(e);
            } finally {
              a.transport.disconnect();
            }
          }
        };
        a.id = "events";
        //set all remotes to the same value
        remoteStore.set(["none"]);
        a.set(["none"]);
        a.transport.connect();
        remoteStore.set(["text"]);
      });
      it("should resolve sequential changes", function (done) {
        var a = getStore("sequential");
        a.onEdit = function (changes, isLocal) {
          if (!this._current || isLocal) return;
          try {
            expect(this.getStore()).to.deep.have.members(this._current[0][2]);
            expect(remoteStore.getStore()).to.deep.have.members(this._current[0][2]);
            var cb = this._current[2];
            this._current = null;
            cb();
          } catch (e) {
            _print(this.stack.nodes);
            _print(remoteStore.stack.nodes);
            if (done) {
              done(e);
              a.transport.disconnect();
              done = null;
            }
          }
        };
        //set all remotes to the same value
        a.set(["none"]);
        remoteStore.set(["none"]);
        a.transport.submitNode = remoteStore.onRemoteNode.bind(remoteStore);
        a.transport.connect();
        Utils.asyncForEach(
          [
            ["set", ["test1"], ["test1"]],
            ["remoteSet", ["test2"], ["test1", "test2"]],
            ["set", ["test2"], ["test2"]],
            ["remoteSet", ["test5", "test4"], ["test5", "test4"]],
          ],
          function (e, i, n) {
            if (e[0] == "set") {
              a.set(e[1]);
              expect(a.getStore()).to.have.members(e[2]);
              expect(remoteStore.getStore()).to.have.members(e[2]);
              n();
            } else {
              a._current = arguments;
              remoteStore.set(e[1]);
            }
          },
          function () {
            done();
            a.transport.disconnect();
          }
        );
      });
      it("should resolve parallel changes", function (done) {
        var a = getStore("parallel");
        a.transport.connect();
        //Otherwise it might read data synchronously
        remoteStore.set([]);
        a.set([]);
        remoteStore._origin = "zzz"; //force it to win in conflicts
        a.onEdit = Utils.debounce(function () {
          try {
            expect(a.getStore()).to.deep.have.members(remoteStore.getStore());
            expect(a.getStore()).to.deep.have.members(["test5", "test4"]);
            done();
          } catch (e) {
            done(e);
          }
          a.transport.disconnect();
        }, DELAY);
        [
          ["set", ["test1"]],
          ["remoteSet", ["test2"]],
          ["set", ["test2"]], //added test2
          ["remoteSet", ["test5", "test4"]], //removed test2
        ].forEach(function (e) {
          (e[0][4] ? remoteStore : a).set(e[1]);
        });
      });
      it("should resolve conflicting changes", function (done) {
        var a = getStore("conflicting");
        //set all remotes to the same value
        a.transport.connect();

        a.onEdit = Utils.debounce(function () {
          try {
            expect(a.getStore()).to.deep.have.members(remoteStore.getStore());
            expect(a.getStore()).to.deep.not.have.members([
              "test3",
              "test2",
              "test1",
            ]);
            done();
          } catch (e) {
            done(e);
          }
          a.transport.disconnect();
        }, DELAY);
        [
          ["set", ["test1"]],
          ["remoteSet", ["test2"]],
          ["set", ["test1", "test3"]], //add test1
          ["set", ["test2", "test3"]], //replace test1 with test2
          ["remoteSet", ["test1"]], //replace test2 with test1
        ].forEach(function (e) {
          (e[0][4] ? remoteStore : a).set(e[1]);
        });
      });

      it("should resolve onesided changes", function (done) {
        var a = getStore("onesided");
        a.set(["test1"]);
        //set all remotes to the same value
        a.transport.connect();
        a.onEdit = Utils.debounce(function () {
          try {
            expect(a.getStore()).to.deep.have.members(remoteStore.getStore());
            expect(a.getStore()).to.deep.have.members(["test2"]);
            done();
          } catch (e) {
            done(e);
          }
          a.transport.disconnect();
        }, DELAY);
        Utils.asyncForEach(
          [
            ["remoteSet", ["test1"]],
            ["remoteSet", ["test2"]], //replace test2 with test1
          ],
          function (e, i, n) {
            (e[0][4] ? remoteStore : a).set(e[1]);
            setTimeout(n, 50);
          }
        );
      });
      it("should allow no delete", function (done) {
        var a = getStore("nodelete");
        var t = getRemoteStore("control");
        var count = 0,
          local = 0;
        var resolve = Utils.debounce(function (item) {
          try {
            console.log(
              item.stack.nodes.length,
              "nodes ",
              local,
              " corrections / ",
              count,
              " changes"
            );
            expect(a.getStore()).to.include.members(a.get());
            expect(t.getStore()).to.include.members(t.get());
            expect(t.getStore()).to.have.members(a.getStore());
            expect(remoteStore.getStore()).to.have.members(a.getStore());
            expect(t.getStore()).to.have.members("abcdef".split(""));
            done();
          } catch (e) {
            done(e);
          } finally {
            t.destroy();
            a.transport.disconnect();
          }
        }, DELAY);

        remoteStore.onEdit = a.onEdit = t.onEdit = function nodelete(
          changes,
          isLocal
        ) {
          _check(this.stack.nodes);
          if (!isLocal) {
            changes.forEach(function (e) {
              if (e.type === -1) {
                e.items.forEach(function (e) {
                  if (this.get().indexOf(e) > -1) {
                    this.onClientChange([{ type: 1, items: [e] }]);
                    local++;
                  }
                }, this);
              }
            }, this);
          }
          count++;
          resolve(this);
        };

        a.set(["a", "b", "c"]);
        t.set(["d", "e", "f"]);
        a.transport.connect();
        t.transport.connect();
        remoteStore.set(["b", "d", "f", "g", "i"]);
        remoteStore.set([]); //clear all
      });
      it("should resolve lots of clients", function (done) {
        var remotes = [];
        var values = [];
        var COUNT = 10;
        for (var i = 0; i < COUNT; i++) {
          var a = getRemoteStore("a" + i);
          a.transport.connect();
          a.set([]); //to ensure it does not read other values
          remotes.push(a);
        }
        Perf.profileObject(remotes[0]);
        Perf.profileObject(remotes[0].stack);
        var resolve = Utils.debounce(function resolve() {
          try {
            remotes.forEach(function (e) {
              expect(e.getStore()).to.deep.have.members(values);
            });
            done();
          } catch (e) {
            done(e);
          } finally {
            Perf.displayResults();
            remotes.forEach(function (e) {
              e.destroy();
            });
          }
        }, DELAY);
        for (var j = 0; j < COUNT; j++) {
          values.push("a" + j);
          remotes[j].set([values[j]]);
          remotes[j].onEdit = resolve;
        }
      });
    }
  });
  function _check(nodes) {
    var last = nodes[0];
    var lasts = [{version:nodes[0].base}];
    for (var i = 1; i < nodes.length; i++) {
      while (nodes[i].base != last.version) {
        last = lasts.pop();
        var node = nodes[i];
        if (!last) {
          _print(nodes);
          throw new Error(
            "Bad stack " + node.version + " with base " + node.base
          );
        }
      }
      lasts.push(last);
      last = nodes[i];
      if (nodes[i].loserNode) {
        //Enforce order:
        //node,
        //[node.reverserNode],
        //node.loserNode.rebaseNode,
        //node.loserNode,
        //node.loserNode.reverserNode
        var l = nodes[i].reverserNode ? 1 : 0;
        if (
          !nodes[i + l + 1] ||
          nodes[i + l + 1] !== nodes[i].loserNode.rebaseNode
        ) {
          _print(nodes.slice(i, i + l + 8));
          throw new Error("wrong vnode", i);
        }
        if (nodes[i + l + 2] && nodes[i + l + 2] !== nodes[i].loserNode) {
          _print(nodes.slice(i, i + l + 8));
          throw new Error("wrong lost node " + i);
        }
        if (
          nodes[i + l + 3] &&
          nodes[i + l + 3] !== nodes[i].loserNode.reverserNode
        ) {
          _print(nodes.slice(i, i + l + 8));
          throw new Error("wrong reverse node");
        }
      } else if (nodes[i].isVirtual && !nodes[i].isForwarder) {
        //Enforce order
        //node.loserNode.rebaseNode,
        //node.loserNode,
        //node.loserNode.reverserNode
        if (nodes[i + 1] && nodes[i + 1].rebaseNode) {
          if (nodes[i + 1].rebaseNode !== nodes[i]) {
            _print(nodes.slice(i, i + 8));
            throw new Error("isjsue with virtual node");
          }
        } else if (
          (nodes[i].reverserNode || nodes[i - 1].reverserNode) !==
          (nodes[i].reverserNode ? nodes[i + 1] : nodes[i])
        ) {
          _print(nodes.slice(i - 1, i + 8));
          throw new Error("issue with reverse node");
        }
      }
    }
  }
  function _print(nodes) {
    console.log(
      nodes.map((e) => [
        e.base,
        e.version,
        e.patches && JSON.stringify(e.patches),
        e.value.join(""),[
        e.isMerge?"*":"",
        e.isVirtual?"?":"",
        e.isForwarder?"->":""].join("")
      ])
    );
  }
  window._check = _check;
});