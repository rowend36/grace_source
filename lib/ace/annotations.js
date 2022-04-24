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

define(function(require, exports, module) {
    "use strict";
    
    /*Generic class for managing a set of workers who produce a list of messages
     * Used for gutter annotations only for now,
     * TODO Perharps polyfill using Array.isArray
     * Duplicate functionality with that in ext/completions.js
     */

    function ChannelManager(channelName, onChannelUpdate, updateEvent, terminateEvent) {
        var providers = Object.create(null);
        var workerList = Object.create(null);
        var EV_UPDATE = updateEvent || 'update';
        var EV_STOP = terminateEvent || 'terminate';
        var CHANNEL = channelName;

        /*
            Assumes session.id is constant. changing the id of a session will make it
            almost impossible to remove workers leading to nasty memory leaks
            
            Changing provider.isGlobal will do nothing 
            while there is at least one existing worker
            If you do change it, you can close the workers by calling
            ChannelManager.registerProvider again
            
            calls to terminate() invert control ie, the channel will not remove the
            document until it gets the 'terminate' event. This means until we discover any bugs,
            the 'terminate' can safely be ignored or triggered asynchronously(care should be taken for
            multiple session workers as calls to addDocument can come after terminate has been called).
            
            The worker list is something like this:
            { 
                globalProviderId: {
                    worker:worker,
                    sessions:{id:session1,id2:session2.....}
                },
                providerId: [
                    {worker:worker,session:session}
                    .....
                    ]
        */

        function registerProvider(provider, options) {
            function isNonNull(id) {
                if (id === undefined || id === null) return false;
                return true;
            }
            var id = (options && isNonNull(options.id)) ? options.id :
                isNonNull(provider.$id) ? provider.$id :
                "#" + Math.random() + "#";

            if (providers[id]) {
                unregisterProvider(id);
            }
            providers[id] = provider;
            return id;
        }

        function unregisterProvider(id) {
            var prov = providers[id] || providers[(id=id.$id)];
            if (!prov) return;
            delete providers[id];

            var list = workerList[id];
            if (!list) return;
            delete workerList[id];

            if (Array.isArray(list)) {
                for (var j in list) {
                    list[j].worker.terminate();
                }
            } else list.worker.terminate();
        }


        function findRunning(session) {
            var running = Object.create(null);
            for (var workerId in workerList) {
                var list = workerList[workerId];
                if (!list) continue;
                if (Array.isArray(list)) {
                    //one worker per session
                    for (var j in list) {
                        var worker_data = list[j];
                        if (worker_data.session === session) {
                            running[workerId] = j;
                            break;
                        }
                    }
                } else {
                    //single worker for all sessions
                    if (list.sessions[session.id])
                        running[workerId] = session.id;
                }
            }
            return running;
        }

        function gatherMatches(mode, session, opts) {
            var matches = [];
            var maxScore = -Infinity;
            for (var i in providers) {
                var provider = providers[i];
                var score;
                if (provider.canHandle) {
                    //dynamic priority
                    score = provider.canHandle(mode, session, opts);
                    if (!score) continue;
                } else if (provider.supportedModes) {
                    if (provider.supportedModes.indexOf(mode) > -1) {
                        //fixed priority
                        score = provider.priority || 1;
                    }
                } else if (i === mode) {
                    //old ace mode workers
                    score = 1;
                } else continue;
                if (score > maxScore || (!provider.isSupport && score == maxScore)) {
                    maxScore = score;
                    if (matches[0] && !providers[matches[0]].isSupport) {
                        matches.shift();
                    }
                    matches.unshift(i);
                } else if (provider.isSupport) {
                    matches.push(i); //TODO sort by priority
                }
            }
            return matches;
        }


        function updateWorkersForSession(session, opts) {
            var running = findRunning(session);
            var mode = (opts && opts.mode) || session.getMode().$id;
            var matches = gatherMatches(mode, session, opts);
            var providerId;
            for (providerId in running) {
                if (matches.indexOf(providerId) < 0) {
                    stopWorkerForSession(providerId, running[providerId]);
                }
            }
            for (var j in matches) {
                providerId = matches[j];
                if (running[providerId] === undefined)
                    startWorkerForSession(providerId, session, opts);
            }
        }

        function removeWorkersForSession(session) {
            var running = findRunning(session);
            for (var providerId in running) {
                stopWorkerForSession(providerId, running[providerId]);
            }
        }

        var handleGlobalUpdate = function(id, ev) {
            var sessId = ev.data.doc;
            var session = this.sessions[sessId];
            if (session) {
                session[CHANNEL][id] = ev.data.data;
                onChannelUpdate(session);
            }
        };
        var handleGlobalTerminate = function(id, ev) {
            if (this.sessions) {
                for (var sId in this.sessions) {
                    var session = this.sessions[sId];
                    delete session[CHANNEL][id];
                    onChannelUpdate(session);
                }
                if (workerList[id] === this)
                    delete workerList[id];
                this.worker.off(EV_UPDATE, this.$handleUpdate);
                this.worker.off(EV_STOP, this.$handleTerminate);
            }
        };

        var handleUpdate = function(id, ev) {
            this.session[CHANNEL][id] = ev.data;
            onChannelUpdate(this.session);
        };
        var handleTerminate = function(id, ev) {
            delete this.session[CHANNEL][id];
            onChannelUpdate(this.session);
            var list = workerList[id];
            var index;
            if (list && (index = list.indexOf(this)) > -1) {
                if (list.length > 0)
                    list.splice(index, 1);
                else workerList[id] = null;
            }
            this.worker.off(EV_UPDATE, this.$handleUpdate);
            this.worker.off(EV_STOP, this.$handleTerminate);
        };

        function startWorkerForSession(providerId, session, opts) {
            if (!session[CHANNEL]) {
                session[CHANNEL] = {};
            }
            session[CHANNEL][providerId] = [];
            var provider = providers[providerId];
            var current = workerList[providerId];
            /*This value should not change without reregistering the provider*/
            /*There should be an element of load managing
            * Such an implementation would
            * - have a way to query current number of workers
              - have a way to remove documents from global workers
                  on the worker side without going around the manager
            * For now, we manage the following,
            * - Providers can call terminate on any worker directly
            * - Global providers can use canHandle and ChannelManager.updateWorkers to remove individual sessions
            */
            if (provider.isGlobal && !Array.isArray(current)) {
                if (!current) {
                    current = workerList[providerId] = {
                        worker: provider.createWorker(),
                        sessions: Object.create(null),
                        num: 0
                    };
                    current.$handleUpdate = handleGlobalUpdate.bind(current, providerId);
                    current.$handleTerminate = handleGlobalTerminate.bind(current,
                        providerId);
                    current.worker.on(EV_UPDATE, current.$handleUpdate);
                    current.worker.on(EV_STOP, current.$handleTerminate);
                }
                current.sessions[session.id] = session;
                current.num++;

                current.worker.addDocument(session.id, session.getDocument(), opts);
                session._signal("startWorker", {
                    worker: current.worker,
                    id: providerId,
                    provider:provider,
                    isGlobal: true
                });
            } else {
                var worker = provider.createWorker();
                if (!current) {
                    current = workerList[providerId] = [];
                }
                var item = {
                    worker: worker,
                    session: session
                };
                current.push(item);

                item.$handleUpdate = handleUpdate.bind(item, providerId);
                item.$handleTerminate = handleTerminate.bind(item, providerId);
                worker.on(EV_UPDATE, item.$handleUpdate);
                worker.on(EV_STOP, item.$handleTerminate);

                worker.attachToDocument(session.getDocument(), opts);
                session._signal("startWorker", {
                    worker: worker,
                    id: providerId,
                    provider:provider,
                });
            }
        }

        /*How do we expose this api to providers
        Something like on('removeDoc',(id)=>if(this.sessions[id])stopWorkerForSession(...))
        */
        function stopWorkerForSession(providerId, sessionId_or_index /*unchecked*/ ) {
            var current = workerList[providerId];
            if (Array.isArray(current)) {
                var index = sessionId_or_index;
                current[index].worker.terminate();
            } else {
                var sessionId = sessionId_or_index;
                //Terminate worker if this is the last session
                if (current.num < 2) {
                    current.worker.terminate();
                } else {
                    current.worker.removeDocument(sessionId,current.sessions[sessionId]);
                    delete current.sessions[sessionId][CHANNEL][providerId];
                    onChannelUpdate(current.sessions[sessionId]);
                    delete current.sessions[sessionId];
                    current.num--;
                }
            }
        }

        this.updateWorkers = updateWorkersForSession;
        this.registerProvider = registerProvider;
        this.unregisterProvider = unregisterProvider;
        this.removeWorkers = removeWorkersForSession;
        this.listWorkers = function(session) {
            var running = findRunning(session);
            return Object.keys(running).map(function(e) {
                var list = workerList[e];
                return {
                    provider:providers[e],
                    worker:Array.isArray(list)?list[running[e]].worker:list.worker,
                    id: e
                };
            });
        };
        this.listSessions = function(providerId) {
            var e = workerList[providerId];
            if (e) {
                if (Array.isArray(e)) return e.map(function(item) {
                    return item.session;
                });
                else {
                    var arr = [];
                    for (var i in e.sessions) {
                        arr.push(e.sessions[i]);
                    }
                    return arr;
                }
            }
            return [];
        };
    }


    var Annotations = new ChannelManager('$annotationChannels',
        function onChannelUpdate(session) {
            /*For less than 100 channels, this is by far the fastest way*/
            var flat = [];
            for (var i in session.$annotationChannels) {
                flat = flat.concat(session.$annotationChannels[i]);
            }
            if (session.annotationFilters) {
                session.annotationFilters.forEach(function(e) {
                    flat = e(flat);
                });
            }
            session.setAnnotations(flat);
        }, 'annotate');
    exports.Annotations = Annotations;
    exports.ChannelManager = ChannelManager;
});