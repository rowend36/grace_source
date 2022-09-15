define(function (require, exports, module) {
    'use strict';
    /*globals $*/
    var browserModal;
    var saveMode, saveID;
    var EventsEmitter = require('grace/core/events_emitter').EventsEmitter;
    var Config = require('grace/core/config').Config;
    var getObj = Config.getObj;
    var Notify = require('grace/ui/notify').Notify;
    var Form = require('grace/ui/forms').Forms;
    var putObj = Config.putObj;
    var register = Config.register;
    var viewToServer = getObj('viewToServer');
    var appEvents = require('grace/core/app_events').AppEvents;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Utils = require('grace/core/utils').Utils;
    var Docs = require('grace/docs/docs').Docs;
    var serverFactories = FileUtils.$serverFactories;
    var SideNav;
    var Tabs;
    var needsRecreate = true;
    appEvents.on('registerFileServer', function () {
        needsRecreate = true;
    });
    var _fileBrowsers = {};

    appEvents.on('replaceFileServer', function (ev) {
        for (var i in _fileBrowsers) {
            if (_fileBrowsers[i].fileServer == ev.server) {
                _fileBrowsers[i].fileServer = ev.replacement;
                if (_fileBrowsers[i].tree) {
                    _fileBrowsers[i].tree.fileServer = ev.replacement;
                    for (var c in _fileBrowsers[i].tree.nestedViews) {
                        _fileBrowsers[i].tree.nestedViews[c].fileServer =
                            ev.replacement;
                    }
                }
            }
        }
    });
    var Fileviews = {
        Impl: null,
        initialize: function (container, tabs) {
            Tabs = tabs;
            SideNav = container;
            browserModal = $(
                Notify.modal({
                    header: 'Pick Storage Type',
                    body: "<select id='browserType'></select>",
                    footers: ['Cancel', 'Create'],
                    autoOpen: false,
                    keepOnClose: true,
                    ondismiss: function () {
                        browserModal.detach();
                    },
                    dismissible: false,
                })
            );
            browserModal.detach();
            browserModal.find('select').on('change', function () {
                browserModal.find('.config').hide();
                browserModal
                    .find('.config-' + browserModal.find('select').val())
                    .show();
            });
            browserModal.find('.modal-create').click(function () {
                browserModal.modal('close');
                var params = {};
                params.type = browserModal.find('select').val();
                var e = browserModal.find('.config-' + params.type)[0];
                if (e) {
                    Object.assign(params, Form.parse(e));
                }
                var browser = Fileviews.initBrowser(params);
                if (!browser) {
                    Notify.error('Error Creating Storage');
                } else Tabs.setActive(browser.id, true);
            });
            Fileviews.loadBrowsers();
        },
        newBrowser: function () {
            if (needsRecreate) {
                var e = browserModal.find('.modal-content')[0];
                browserModal.find('.config').detach();
                var select = browserModal.find('select')[0];
                $(select).empty();
                for (var id in serverFactories) {
                    if (id[0] == '!') continue;
                    var factory = serverFactories[id];
                    var option = document.createElement('option');
                    option.setAttribute('name', id);
                    option.setAttribute('value', id);
                    option.innerText = factory.caption || id.toUpperCase();
                    select.appendChild(option);
                    if (factory.config) {
                        var form = Form.create(factory.config);
                        form.className = 'config config-' + id;
                        e.appendChild(form);
                        $(form).submit(false);
                    }
                }
                needsRecreate = false;
            }
            document.body.appendChild(browserModal[0]);
            browserModal.modal('open');
            browserModal.find('.config').hide();
            browserModal
                .find('.config-' + browserModal.find('select').val())
                .show();
        },
        addBrowser: function (filebrowser) {
            if (_fileBrowsers[filebrowser.id]) {
                console.warn('Id already taken');
                _fileBrowsers[Utils.genID(filebrowser.id)] = filebrowser;
            }
            _fileBrowsers[filebrowser.id] = filebrowser;
        },
        createBrowser: function (id, fileServer, rootDir, icon) {
            Tabs.insertTab(
                0,
                id,
                icon ||
                    (fileServer || FileUtils.getFileServer()).icon ||
                    'sd_storage'
            );
            var container = Tabs.pager.getTabEl(id);
            container.addClass('fileview-container');
            return new this.Impl(id, rootDir, fileServer);
        },
        initBrowser: function (params) {
            var server, serverID;
            if (params.server) {
                server = params.server;
                serverID = server.id || undefined;
            } else {
                try {
                    server = FileUtils.createServer(
                        params.type,
                        params,
                        serverID
                    );
                    serverID = server.id || undefined;
                } catch (e) {
                    console.error(e);
                    return null;
                }
            }
            var browser = Fileviews.createBrowser(
                Utils.genID('f'),
                server,
                params.rootDir,
                server.getIcon && server.getIcon()
            );
            viewToServer[browser.id] = serverID || null;
            Fileviews.addBrowser(browser);
            putObj('viewToServer', viewToServer);
            return browser;
        },
        loadBrowsers: function () {
            for (var i in viewToServer) {
                register('root:' + i, 'files');
                register('tree:' + i, 'files');
                register('info:' + i, 'files');
                // register("hidden:" + i, "files");
                var servrId = viewToServer[i];
                if (servrId === 'undefined') viewToServer[i] = undefined;
                var server = FileUtils.getFileServer(servrId);
                var browser = Fileviews.createBrowser(i, server);
                Fileviews.addBrowser(browser);
            }
            if (Object.keys(_fileBrowsers).length < 1) {
                var defaultBrowser = Fileviews.createBrowser(
                    'file-browser',
                    FileUtils.getFileServer()
                );
                viewToServer['file-browser'] = null;
                Fileviews.addBrowser(defaultBrowser);
                putObj('viewToServer', viewToServer);
            }
            Tabs.setActive('hierarchy_tab', true);
        },
        deleteBrowser: function (browserID) {
            if (!viewToServer.hasOwnProperty(browserID))
                throw new Error('deleting unexisting tab');
            var id;
            var serverID = viewToServer[browserID];
            var closeBrowser = function () {
                delete viewToServer[browserID];
                _fileBrowsers[browserID].destroy();
                delete _fileBrowsers[browserID];
                Config.unregister('root:' + browserID, 'files');
                Config.unregister('tree:' + browserID, 'files');
                Config.unregister('info:' + browserID, 'files');

                putObj('viewToServer', viewToServer);
                Tabs.removeTab(browserID);
                //if no other browser, create one
                for (var i in _fileBrowsers) {
                    if (!_fileBrowsers[i].isHierarchy) {
                        return;
                    }
                }
                var defaultBrowser = Fileviews.createBrowser('file-browser');
                viewToServer['file-browser'] = null;
                Fileviews.addBrowser(defaultBrowser);
                putObj('viewToServer', viewToServer);
            };
            if (!serverID) return closeBrowser();
            var server = FileUtils.getFileServer(serverID);
            if (!server) {
                console.error('No server with id ' + typeof id + ':' + id);
                return closeBrowser();
            }
            var hasAlternate = false,
                hasAlternateDisk = null;
            for (var i in _fileBrowsers) {
                if (i == browserID) continue;
                if (_fileBrowsers[i].isHierarchy) continue;
                if (_fileBrowsers[i].fileServer.id === serverID) {
                    hasAlternate = true;
                    break;
                } else if (
                    _fileBrowsers[i].fileServer.getDisk() == server.getDisk()
                ) {
                    hasAlternateDisk = _fileBrowsers[i].fileServer;
                }
            }
            if (hasAlternate) return closeBrowser();
            var openDocs = Fileviews.getOpenDocs(serverID);
            var clear = function () {
                FileUtils.deleteServer(serverID);
                closeBrowser();
                for (var i in openDocs) {
                    delete Docs.get(openDocs[i]).fileServer;
                    Docs.get(openDocs[i]).setPath(null);
                }
            };

            function closeAndSetTemp() {
                Notify.ask(
                    'The following files are still open from this drive:\n' +
                        refs.join('\n') +
                        '\nContinue? (The documents will be marked as unsaved)',
                    clear
                );
            }
            if (openDocs.length > 0) {
                var refs = openDocs.map(function (i) {
                    return Docs.get(i).getSavePath();
                });
                if (hasAlternateDisk) {
                    Notify.ask(
                        'Reconfigure files that are still open from this drive to use available filesystem: ' +
                            hasAlternateDisk.constructor.name +
                            '?',
                        function () {
                            for (var i in openDocs) {
                                Docs.get(openDocs[i]).fileServer =
                                    hasAlternateDisk.id;
                            }
                            openDocs = [];
                            clear();
                        },
                        closeAndSetTemp
                    );
                } else closeAndSetTemp();
            } else clear();
        },
        getOpenDocs: function (id) {
            var openDocs = [];
            Docs.forEach(function (doc) {
                if (doc.fileServer == id) {
                    openDocs.push(doc.id);
                }
            });
            return openDocs;
        },
        beforeClose: function (event, func) {
            var newfunc = Fileviews.once(event, func);
            appEvents.once('sidenavClosed', function () {
                appEvents.off(event, newfunc);
            });
        },
        pickFile: function (info, end, allowNew) {
            if (!SideNav) return;
            if (!SideNav.isOpen) {
                appEvents.once('sidenavOpened', function () {
                    Fileviews.pickFile(info, end, allowNew);
                });
                return SideNav.open();
            }
            var grp = new Utils.groupEvents(Fileviews);
            var dismiss = info ? Notify.direct(info) : Utils.noop;
            grp.on('sidenavClosed', dismiss, appEvents);
            grp.on('sidenavClosed', grp.off, appEvents);
            grp.on('open-file', dismiss);
            grp.once('open-file', end);
            var tab = Tabs.active;
            var browser = _fileBrowsers[tab];
            if (!browser) {
                Tabs.setActive('hierarchy_tab', true);
                browser = _fileBrowsers.projectView;
            }
            if (browser.isClosed) {
                var all = Object.keys(_fileBrowsers);
                var next = all.indexOf(tab);
                next = next > 0 ? next - 1 : next + 1;
                browser = _fileBrowsers[all[next]];
                Tabs.setActive(browser.id, true);
            }
            if (allowNew) {
                grp.on('new-file', dismiss);
                grp.once('new-file', end);
                browser.newFile(saveMode && Docs.getName(saveID));
            }
        },
        saveAs: function (doc) {
            saveMode = true;
            appEvents.once('sidenavClosed', Fileviews.exitSaveMode);
            saveID = doc;
            var onSave = function (event) {
                var save = function () {
                    Docs.saveAs(
                        saveID,
                        event.filepath,
                        event.browser.fileServer
                    );
                    Fileviews.exitSaveMode();
                };
                if (event.id == 'new-file') save();
                else Notify.ask('Overwrite ' + event.filename + '?', save);
                event.preventDefault();
            };
            Fileviews.pickFile(
                'Select a file to overwrite or create a new file',
                onSave,
                true
            );
        },
        inSaveMode: function () {
            return saveMode;
        },
        exitSaveMode: function () {
            if (saveMode) {
                saveMode = false;
            }
            //$("#save-text").css("display", "none");
        },
        freezeEvent: function (event) {
            var stub = event.browser;
            while (stub.parentStub) {
                stub = stub.parentStub;
            }
            return {
                browser: stub.id,
                filename: event.filename,
                filepath: event.filepath,
                rootDir: event.rootDir,
                id: event.id,
            };
        },
        //must be called after setting up fileviews
        unfreezeEvent: function (event) {
            var browser =
                _fileBrowsers[event.browser] || _fileBrowsers.projectView;
            event.browser = browser;
            return event;
        },
    };
    Object.assign(Fileviews, EventsEmitter.prototype);
    Fileviews._debug = true;
    exports.Fileviews = Fileviews;
});