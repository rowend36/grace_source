/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

if (typeof process !== "undefined") {
    require("amd-loader");
}

define(function(require, exports, module) {
    "use strict";

    var EditSession = require("../edit_session").EditSession;
    var Annotations = require("./annotations").Annotations;
    var EventEmitter = require("../lib/event_emitter").EventEmitter;

    var assert = require("../test/assertions");


    function TestWorker(isGlobal) {
        this.isGlobal = isGlobal;
    }
    TestWorker.prototype = Object.create(EventEmitter);
    TestWorker.prototype.attachToDocument = function(doc) {
        assert.equal(this.isGlobal, false);
        this.doc = doc;
    };
    TestWorker.prototype.terminate = function() {
        this.doc = null;
        this._signal('terminate');
    };
    TestWorker.prototype.$update = function(ev) {
        if (this.isGlobal) {
            for (var i in this.docs) {
                this._emit('annotate', {
                    data: {
                        doc: i,
                        data: ev.data
                    }
                });
            }
        } else this._emit('annotate', ev);
    };
    TestWorker.prototype.addDocument = function(id, doc) {
        assert.equal(this.isGlobal, true);
        if (!this.docs) this.docs = Object.create(null);
        assert.equal(this.docs[id], undefined);
        this.docs[id] = doc;
    };
    TestWorker.prototype.removeDocument = function(id) {
        assert.equal(!!this.docs[id], true);
        delete this.docs[id];
    };

    function WorkerProvider(id, isGlobal) {
        this.$id = id;
        this.isGlobal = !!isGlobal;
    }
    WorkerProvider.prototype.canHandle = function() {
        return 1;
    };
    WorkerProvider.prototype.createWorker = function() {
        return (this.worker = new TestWorker(this.isGlobal));
    };

    module.exports = {
        setUp: function() {},

        "test: register workers": function() {
            this.globalWorker = new WorkerProvider("global", true);
            this.localWorker = new WorkerProvider("local");
            this.session = new EditSession([
                "Pack a punch",
                "If you dare",
                "Toss your coin",
                "But do beware",
                "I'll make you pay",
                "For all your trouble",
                "Do your worst",
                "I'll give you double"
            ]);
            assert.equal(Annotations.listWorkers(this.session).length, 0);
            Annotations.registerProvider(this.globalWorker);
            Annotations.registerProvider(this.localWorker);
            assert.equal(Annotations.listWorkers(this.session).length, 0);
            Annotations.updateWorkers(this.session);
            assert.equal(Annotations.listWorkers(this.session).length, 1);
            assert.equal(Annotations.listWorkers(this.session)[0].id, "local");
            this.localWorker.allowsSupport = true;
            Annotations.updateWorkers(this.session);
            /*Local is not removed so it remains first even though it is now supporting*/
            assert.equal(Annotations.listWorkers(this.session)[0].id, "local");
        },
        "test: annotations": function() {
            this.globalWorker.worker.$update({
                data: ["annotation 1"]
            });
            this.localWorker.worker.$update({
                data: ["annotation 2"]
            });
            assert.equal(this.session.getAnnotations().length, 2);
            this.localWorker.worker.$update({
                data: ["annotation 5","annotation 4","annotation 3"]
            });
            assert.equal(this.session.getAnnotations().length, 4);
        },
        "test: global annotations": function(){
            this.session2 = new EditSession("");
            Annotations.updateWorkers(this.session2);

            this.globalWorker.worker.$update({
                data: ["All docs have this data","and this data"]
            });
            assert.equal(this.session.getAnnotations().length,5);
            assert.equal(this.session2.getAnnotations().length,2);
            assert.equal(this.session.getAnnotations().indexOf("and this data")>-1,true);
            assert.equal(this.session2.getAnnotations().indexOf("and this data")>-1,true);
            assert.equal(this.session2.getAnnotations().indexOf("annotation 4")>-1,false);
        },
        "test: remove workers": function() {
            Annotations.removeWorkers(this.session);
            assert.equal(this.session.getAnnotations().length,0);
            assert.equal(Annotations.listWorkers(this.session).length, 0);
            
            Annotations.removeWorkers(this.session2);
            assert.equal(this.session2.getAnnotations().length,0);
            assert.equal(Annotations.listWorkers(this.session2).length, 0);
        },
        "test: terminate": function(){
            Annotations.updateWorkers(this.session);
            
            //This overrides the value of localWorker.worker
            Annotations.updateWorkers(this.session2);
            
            assert.equal(Annotations.listWorkers(this.session2).length,2);
            
            this.globalWorker.worker.terminate();
            assert.equal(Annotations.listWorkers(this.session2).length,1);
            assert.equal(Annotations.listWorkers(this.session).length,1);
            
            this.localWorker.worker.terminate();
            assert.equal(Annotations.listWorkers(this.session2).length,0);
            assert.equal(Annotations.listWorkers(this.session).length,1);
            
            Annotations.removeWorkers(this.session);
            assert.equal(Annotations.listWorkers(this.session).length,0);
        },
        "test: priority": function(){
            this.localWorker.canHandle = null;
            this.localWorker.supportedModes = ["ace/mode/text"];
            this.localWorker.priority = 2;
            
            Annotations.updateWorkers(this.session2);
            assert.equal(Annotations.listWorkers(this.session2).length,1);
            assert.equal(Annotations.listWorkers(this.session2)[0].id,"local");
            
        },
        "test: listSessions": function(){
            Annotations.updateWorkers(this.session);
            Annotations.updateWorkers(this.session2);
            
            var t = Annotations.listSessions("global");
            assert.equal(t.length,0);
            
            var l = Annotations.listSessions("local");
            assert.equal(l.length,2);
        },
        "test: unregister": function(){
            Annotations.unregisterProvider("local");
            assert.equal(Annotations.listWorkers(this.session2).length,0);
            Annotations.updateWorkers(this.session2);
            assert.equal(Annotations.listWorkers(this.session2).length,1);
            assert.equal(Annotations.listWorkers(this.session2)[0].id,"global");
            
            Annotations.unregisterProvider("global");
            assert.equal(Annotations.listWorkers(this.session2).length,0);
            Annotations.updateWorkers(this.session2);
            assert.equal(Annotations.listWorkers(this.session2).length,0);
                        
        }
    };

});

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
