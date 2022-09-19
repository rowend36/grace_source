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
    
    /*Generic class for managing a set of services/workers who produce a list of messages
     * Used for gutter annotations only for now,
     */

    function ServiceManager(channelName, onChannelUpdate, updateEvent, terminateEvent) {
        var providers = Object.create(null);
        /**
         * @type {Record<string,Array<{worker:Worker,session:Session}>}
         */
        var workerList = Object.create(null);
        var EV_UPDATE = updateEvent || 'update';
        var EV_STOP = terminateEvent || 'terminate';
        var CHANNEL = channelName;

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
            var prov = providers[id] || providers[(id = id.$id)];
            if (!prov) return;
            delete providers[id];
        
            var list = workerList[id];
            if (!list) return;
            delete workerList[id];
        
            for (var j in list) {
                list[j].worker.terminate();
            }
        }


        function findRunning(session) {
            var running = Object.create(null);
            for (var workerId in workerList) {
                var list = workerList[workerId];
                if (!list) continue;
                for (var j in list) {
                    var worker_data = list[j];
                    if (worker_data.session === session) {
                        running[workerId] = j;
                        break;
                    }
                }
            }
            return running;
        }

        function gatherMatches(mode, session) {
            var matches = [];
            var maxScore = -Infinity;
            for (var i in providers) {
                var provider = providers[i];
                var score;
                if (provider.getPriority) {
                    //dynamic priority
                    score = provider.getPriority(mode, session);
                    if (!score) continue;
                } else if (i === mode) {
                    //ace mode workers
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


        function updateWorkersForSession(session) {
            var running = findRunning(session);
            var mode = session.getMode().$id;
            var matches = gatherMatches(mode, session);
            var providerId;
            for (providerId in running) {
                if (matches.indexOf(providerId) < 0) {
                    stopWorkerForSession(providerId, session, running[providerId]);
                }
            }
            for (var j in matches) {
                providerId = matches[j];
                if (running[providerId] === undefined)
                    startWorkerForSession(providerId, session);
            }
        }

        function removeWorkersForSession(session) {
            var running = findRunning(session);
            for (var providerId in running) {
                stopWorkerForSession(providerId, session, running[providerId]);
            }
        }

        var handleUpdate = function(id, ev) {
            this.session[CHANNEL][id] = ev.data;
            onChannelUpdate(this.session);
        };
        var handleTerminate = function(id/* ev*/) {
            delete this.session[CHANNEL][id];
            var list = workerList[id];
            var index;
            if (list && (index = list.indexOf(this)) > -1) {
                if (list.length > 0)
                    list.splice(index, 1);
                else workerList[id] = null;
            }
            console.assert(list.indexOf(this),this);
            this.worker.off(EV_UPDATE, this.$handleUpdate);
            this.worker.off(EV_STOP, this.$handleTerminate);
            onChannelUpdate(this.session);
        };

        function startWorkerForSession(providerId, session) {
            if (!session[CHANNEL]) {
                session[CHANNEL] = {};
            }
            session[CHANNEL][providerId] = [];
            var provider = providers[providerId];
            var current = workerList[providerId];
        
            var worker = provider.createWorker();
            if (!current) {
                current = workerList[providerId] = [];
            }
            var item = {
                worker: worker,
                session: session,
            };
            current.push(item);
        
            item.$handleUpdate = handleUpdate.bind(item, providerId);
            item.$handleTerminate = handleTerminate.bind(item, providerId);
            worker.on(EV_UPDATE, item.$handleUpdate);
            worker.on(EV_STOP, item.$handleTerminate);
        
            worker.attachToDocument(session.getDocument());
            session._signal("startWorker", {
                worker: worker,
                id: providerId,
                provider: provider,
            });
        }

        function stopWorkerForSession(providerId, session, index) {
            var current = workerList[providerId];
            if (!current[index] || current[index].session !== session) {
                index = findRunning(session)[providerId];
                if (index === undefined) return;
            }
            var item = current[index];
            handleTerminate.call(item, providerId);
            item.worker.terminate();
        }

        this.updateWorkers = updateWorkersForSession;
        this.registerProvider = registerProvider;
        this.unregisterProvider = unregisterProvider;
        this.removeWorkers = removeWorkersForSession;
        this.listWorkers = function(session) {
            var running = findRunning(session);
            return Object.keys(running).map(function (e) {
                var list = workerList[e];
                return {
                    provider: providers[e],
                    worker: list[running[e]].worker,
                    id: e,
                };
            });
        };
        this.listSessions = function(providerId) {
            var e = workerList[providerId];
            if (!e) return [];
            return e.map(function (item) {
                return item.session;
            });
        };
    }


    var Annotations = new ServiceManager('$annotationChannels',
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
    exports.ServiceManager = ServiceManager;
});