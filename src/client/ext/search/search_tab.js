define(function (require, exports, module) {
    'use strict';
    /*globals $, ace*/
    require('grace/ext/file_utils/glob');
    require('css!./search_tab.css');
    var ProjectView =
        require('grace/ext/fileview/recycler_browser').RProjectView ||
        require('grace/ext/fileview/file_browser').ProjectView;
    var appEvents = require('grace/core/app_events').AppEvents;
    var bind = require('grace/ui/ui_utils').createSearch;
    var FindFileServer = require('grace/ext/fs/find_fs').FindFileServer;
    //var ViewportVisualizer = require("grace/ui/recycler").ViewportVisualizer;
    var Utils = require('grace/core/utils').Utils;
    var Actions = require('grace/core/actions').Actions;
    var setImmediate = Utils.setImmediate;
    var plural = Utils.plural;
    var Docs = require('grace/docs/docs').Docs;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var MAX_FILE_SIZE = Utils.parseSize('10mb');
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var AutoCloseables = require('grace/ui/auto_closeables').AutoCloseables;
    var Notify = require('grace/ui/notify').Notify;
    var globToRegex = FileUtils.globToRegex;
    var styleCheckbox = require('grace/ui/ui_utils').styleCheckbox;
    var genQuickFilter = FileUtils.genQuickFilter;
    var SearchResults, SearchReplace, SearchList;
    var Doc = require('grace/docs/document').Doc;

    var configure = require('grace/core/config').Config.configure;
    var ConfigEvents = require('grace/core/config').Config;
    var searchConfig = require('grace/core/config').Config.registerAll(
        {
            searchTabFilter: '**',
            searchTabExclude: '**/.*git/',
            searchOpenDocs: true,
            maxSingleSearchTimeout: '2s',
            searchTimeout: '30s',
            searchThreshold: 200,
            matchBaseName: false,
            useSearchWorker: false,
            resultsAutoShowLines: 40,
            lastSearch: '',
            lastSearchOpts: 0,
            syntaxHighlightSearchResults: true,
            useRecyclerViewForSearchResults: true,
        },
        'search'
    );
    var useRecycler = searchConfig.useRecyclerViewForSearchResults;

    require('grace/core/config').Config.registerInfo(
        {
            searchThreshold:
                'Maximum number of results to get at a go before pausing',
            matchBaseName:
                'Allows globs to match basenames. When enabled, it allows *.ext to match a/b/a.ext. Normally that would require **\\/*.ext. If using this option, ensure you update searchTabExclude so as not to slow down searches by traversing unneeded directories.',
            searchTimeout: {
                doc: 'Controls how long search continues before giving up',
                type: 'time',
            },
            lastSearch: 'no-user-config',
            lastSearchOpts: 'no-user-config',
            resultsAutoShowLines:
                'Maximum number of lines to automatically unfold',
            searchOpenDocs:
                'Whether search should be performed on open tabs \n or in current project folder',
            useSearchWorker: 'Only use this if searches appear slow',
            useRecyclerViewForSearchResults:
                '*Experimental feature to allow search to display long results more efficiently(needs reload)',
            maxSingleSearchTimeout: 'no-user-config',
        },
        'search'
    );
    /*Largest closure in the history of closures*/
    var SearchTab = function (el) {
        el.html(require('text!./search_tab.html')).css('padding', '15px');
        var self = this;
        var project;

        //region Setup
        /*Load configuration*/
        this.search = new (require('ace!search').Search)();
        var regExpOption = el.find('#toggleRegex');
        var caseSensitiveOption = el.find('#caseSensitive');
        var wholeWordOption = el.find('#toggleWholeWord');
        searchConfig.lastSearchOpts = parseInt(searchConfig.lastSearchOpts);
        if (searchConfig.lastSearchOpts & 4) regExpOption.addClass('checked');
        if (searchConfig.lastSearchOpts & 2)
            caseSensitiveOption.addClass('checked');
        if (searchConfig.lastSearchOpts & 1)
            wholeWordOption.addClass('checked');
        this.searchInput = el.find('#searchInput');
        this.replaceInput = el.find('#replaceInput');
        this.searchInput[0].value = searchConfig.lastSearch;

        /*Setup controls*/
        var moreEl = el.find('#showMoreResults');
        var loadEl = el.find('#searchStatus');
        var stopBtn = loadEl.find('#searchStop');
        var undoButton = $('#undoReplaceBtn');
        var searchInfo = el.find('#searchInfo');
        var emptyEl = el.find('.no-results');
        loadEl.hide();
        emptyEl.hide();
        moreEl.hide();
        undoButton.hide();
        //endregion Setup

        /*region File filtering*/
        var searchOpenDocs = (this.searchOpenDocs = function (val) {
            configure('searchOpenDocs', !!val, 'search', true);
        });
        var searchInFolder = (this.searchInFolder = function (folder, server) {
            project = {
                rootDir: folder,
                fileServer: server,
            };
            if (searchResults) searchResults.server = server;
            if (self.SearchList) {
                stopSearch();
                self.SearchList = null;
            }
            searchedDocs.length = 0;
            if (self.previewBrowser) {
                self.previewBrowser.fileServer = project.fileServer;
                self.previewBrowser.setRootDir(project.rootDir);
            }
        });
        var quickFilter, includeFilter, excludeFilter;

        function filterFiles(name, path) {
            var rel = relative(project.rootDir, path + name);
            var isDirectory = FileUtils.isDirectory(rel);
            if (searchConfig.matchBaseName) {
                return (
                    (isDirectory ||
                        !includeFilter ||
                        includeFilter.test(name) ||
                        includeFilter.test(rel)) &&
                    !(
                        excludeFilter &&
                        (excludeFilter.test(name) || excludeFilter.test(rel))
                    )
                );
            }
            return (
                (isDirectory
                    ? quickFilter.test(rel)
                    : !includeFilter || includeFilter.test(rel)) &&
                !(excludeFilter && excludeFilter.test(rel))
            );
        }
        this.init = function () {
            var project = FileUtils.getProject();
            if (project.fileServer) {
                searchInFolder(project.rootDir, project.fileServer);
            }
            includeFilter =
                searchConfig.searchTabFilter &&
                globToRegex(searchConfig.searchTabFilter);
            quickFilter = genQuickFilter(searchConfig.searchTabFilter);
            excludeFilter = globToRegex(searchConfig.searchTabExclude);
        };

        /*region Search filtering modal*/
        var filterInput,
            excludeInput,
            modalEl,
            searchInTabs,
            searchConfigChanged;
        var openModal = function () {
            if (!project) {
                Notify.info('No Project Folder!!', 500);
                return;
            }
            if (!modalEl) {
                modalEl = createModal(self);
                self.previewBrowser = new ProjectView(
                    modalEl.find('.fileview'),
                    project.rootDir,
                    project.fileServer
                );
                self.previewBrowser.setShowFileInfo(false);
                self.previewBrowser.setRootDir(project.rootDir);
                self.previewBrowser.folderDropdown = 'search-dropdown';
                self.previewBrowser.childFolderDropdown = 'search-dropdown';
                self.previewBrowser.fileDropdown = 'search-file-dropdown';
                self.previewBrowser.foldersToIgnore = [];
                self.previewBrowser.menuItems = {
                    'search-dropdown': Object.create(
                        self.previewBrowser.menuItems[
                            self.previewBrowser.nestedFolderDropdown
                        ]
                    ),
                    'search-file-dropdown': Object.create(
                        self.previewBrowser.menuItems[
                            self.previewBrowser.nestedFileDropdown
                        ]
                    ),
                };
                filterInput = modalEl.find('#filterInput');
                excludeInput = modalEl.find('#excludeInput');
                filterInput.on('input', updatePreview);
                excludeInput.on('input', updatePreview);
                searchInTabs = modalEl.find('#includeOpenDocs')[0];
                $(searchInTabs).on('change', function (e) {
                    var val = e.target.checked;
                    if (!val) {
                        self.previewBrowser.stub.show();
                        updatePreview(true);
                    } else {
                        self.previewBrowser.stub.hide();
                    }
                    searchConfigChanged = true;
                    modalEl
                        .find('input[type=text]')
                        .attr('disabled', searchConfig.searchOpenDocs);
                    searchOpenDocs(val);
                });
                modalEl.modal({
                    dismissible: false,
                    inDuration: 0,
                    outDuration: 30,
                    startingTop: 0,
                    endingTop: '5%',
                    onCloseStart: function () {
                        if (updateTimeout) {
                            clearTimeout(updateTimeout);
                            updateTimeout = null;
                        }
                        if (FileUtils.activeFileBrowser) {
                            FileUtils.activeFileBrowser.menu.hide();
                        }
                        self.previewBrowser.inFilter &&
                            self.previewBrowser.stopFind();
                        if (searchConfigChanged && runningSearches > 0) {
                            searchConfigChanged = false;
                            find();
                        }
                    },
                    onOpenEnd: AutoCloseables.onOpenEnd,
                    onCloseEnd: AutoCloseables.onCloseEnd,
                });
                document.body.appendChild(modalEl[0]);
            }
            modalEl.modal('open');
            var dotstar = require('grace/core/config').Config.allConfigs.files
                .dotStar;
            if (dotstar) {
                modalEl.find('#dot-star-status').html('enabled');
            } else modalEl.find('#dot-star-status').html('disabled');
            if (searchConfig.matchBaseName) {
                modalEl.find('#basename-status').html('enabled');
            } else modalEl.find('#basename-status').html('disabled');

            searchInTabs.checked = searchConfig.searchOpenDocs;
            modalEl
                .find('input[type=text]')
                .attr('disabled', searchConfig.searchOpenDocs);

            filterInput.val(searchConfig.searchTabFilter);
            excludeInput.val(searchConfig.searchTabExclude);
            if (searchConfig.searchOpenDocs) {
                self.previewBrowser.stub.hide();
            } else {
                self.previewBrowser.stub.show();
                self.previewBrowser.findFile(filterFiles);
            }
        };
        var updateTimeout;
        var updatePreview = function (ev) {
            if (searchConfig.searchOpenDocs) return;
            searchConfigChanged = true;
            if (this == filterInput[0]) {
                configure('searchTabFilter', $(this).val(), 'search', true);
            } else if (this == excludeInput[0]) {
                configure('searchTabExclude', $(this).val(), 'search', true);
            }
            if (self.previewBrowser.inFilter) {
                self.previewBrowser.stopFind();
            }
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = (ev ? setTimeout : setImmediate)(function () {
                self.previewBrowser.findFile(filterFiles);
                updateTimeout = null;
            }, 2000);
        };
        //endregion
        //endregion

        //region Start search
        var searchTimeout;
        var beginSearch = function (filename, useServer) {
            var doc = Docs.forPath(
                filename,
                useServer === false ? undefined : project && project.fileServer
            );
            if (doc) {
                showSearching(filename, 'Searching');
                var ranges = self.search.findAll(doc.session);
                if (ranges.length) {
                    searchedDocs.push(filename);
                }
                possibleNewSearch();
                renderResults(doc, ranges);
            } else
                doSearch(
                    filename,
                    project.fileServer,
                    currentTimeout,
                    searchId
                );
        };
        var lastResult,
            currentTimeout,
            runningSearches,
            searchedDocs = [];
        var found, targetFinds;
        var searchId = 0;
        var find = function () {
            searchId += 1;
            runningSearches = 0;
            if (self.SearchList) self.SearchList.waiting = [];
            lastResult = false;
            lastSearchServer = project && project.fileServer.id;
            found = 0;
            targetFinds = parseInt(searchConfig.searchThreshold);
            var opts =
                (regExpOption.hasClass('checked') ? 4 : 0) +
                (caseSensitiveOption.hasClass('checked') ? 2 : 0) +
                (wholeWordOption.hasClass('checked') ? 1 : 0);
            self.search.setOptions({
                needle: self.searchInput.val(),
                wrap: false,
                regExp: opts & 4,
                caseSensitive: opts & 2,
                wholeWord: opts & 1,
            });
            searchResults.clear();
            searchedDocs.length = 0;
            searchInfo.text('');
            try {
                self.search.$assembleRegExp(self.search.$options);
            } catch (e) {
                showSearchStarted();
                return showSearching(
                    ' ',
                    "<span class='error-text'>" + e.message + '</span>'
                );
            }
            useWorker = searchConfig.useSearchWorker;
            configure('lastSearch', self.searchInput.val(), 'search');
            configure('lastSearchOpts', opts, 'search');
            searchTimeout = Utils.parseTime(searchConfig.searchTimeout);
            showSearchStarted();
            if (!project || searchConfig.searchOpenDocs) {
                Docs.forEach(function (doc) {
                    runningSearches++;
                    //no project specified, multiple filenames might give error
                    //but use search in folder if needed
                    beginSearch(doc.getPath(), false);
                });
                lastResult = true;
                showSearchStopped();
            } else {
                var rootDir = project.rootDir;
                if (rootDir != self.rootDir || !this.SearchList) {
                    var server = new FindFileServer(project.fileServer);
                    server.setFilter(filterFiles);
                    self.SearchList = new SearchList(rootDir, server);
                    self.SearchList.onDir = onDir;
                    self.rootDir = rootDir;
                }
                self.SearchList.reset();
                currentTimeout = new Date().getTime() + searchTimeout;
                for (var i = 0; i < 10; i++) {
                    runningSearches++;
                    self.SearchList.getNext(beginSearch, empty);
                }
            }
        };
        var moreResults = function () {
            targetFinds = found + searchConfig.searchThreshold;
            currentTimeout = new Date().getTime() + searchTimeout;
            showSearchStarted();
            showSearching(null, 'Finding files');
            for (var i = 0; i < 10; i++) {
                runningSearches++;
                self.SearchList.getNext(beginSearch, empty);
            }
        };

        function renderResults(doc, ranges) {
            //todo handle when a single range is too long
            if (ranges && ranges.length > 0) {
                found += ranges.length;
                searchInfo.text(
                    'Found ' +
                        found +
                        ' results in ' +
                        plural(searchedDocs.length, 'file')
                );
                searchResults.render(doc, ranges);
            }
            if (--runningSearches === 0) {
                if (lastResult) {
                    showSearchStopped();
                } else {
                    showSearchPaused();
                }
            }
        }
        var searchResults, searchReplace;
        //Make this bit load asynchronously
        find = require('grace/core/depend').after(function (cb) {
            require([
                './search_list',
                './search_results',
                './search_replace',
            ], function (_searchList, _searchResults, _searchReplace) {
                SearchResults = _searchResults.SearchResults;
                SearchReplace = _searchReplace.SearchReplace;
                SearchList = _searchList.SearchList;
                searchResults = new SearchResults(
                    el.children('#searchResults'),
                    useRecycler
                );
                searchResults.searchConfig = searchConfig;
                if (project && project.fileServer)
                    searchResults.server = project.fileServer;
                searchResults.afterLineClicked = function () {
                    getEditor().session.highlight(self.search.getOptions().re);
                };
                searchReplace = new SearchReplace({
                    onUndoFinished: function (refs) {
                        SearchReplace.$defaultOpts.onUndoFinished(refs);
                        undoButton.hide();
                    },
                    getRanges: function (doc /*, path*/) {
                        return self.search.findAll(
                            doc.session,
                            undefined,
                            undefined,
                            true
                        );
                    },
                    getReplacer: self.search.replace.bind(self.search),
                });
                cb();
            });
        }, find);

        //endregion

        //region Replace

        var lastReplace = '',
            lastReplaced = '',
            lastSearchServer;
        var replace = function () {
            if (searchedDocs.length) {
                lastReplace = self.replaceInput.val();
                lastReplaced = searchConfig.lastSearch;
                Notify.ask(
                    'Replace all instances of ' +
                        lastReplaced +
                        ' with ' +
                        lastReplace +
                        '?',
                    function () {
                        searchReplace.setServer(
                            FileUtils.getFileServer(lastSearchServer)
                        );
                        undoButton.show();
                        searchReplace.replace(searchedDocs, lastReplace);
                    }
                );
            }
        };
        var undoReplace = function () {
            var a = searchReplace.getDeltas();
            if (a && a.length) {
                Notify.ask(
                    'Undo replacement of ' +
                        lastReplaced +
                        ' with ' +
                        lastReplace +
                        '?',
                    function () {
                        searchReplace.undo();
                    }
                );
            }
        };
        //endregion replace

        //File Searching
        var lastWarnedBinaryFile = -1;

        function possibleNewSearch() {
            if (
                runningSearches &&
                runningSearches < (useWorker ? 5 : 2) &&
                found < targetFinds &&
                new Date().getTime() < currentTimeout
            ) {
                runningSearches++;
                self.SearchList.getNext(beginSearch, empty);
            }
        }

        function handleResults(path, doc, ranges) {
            if (ranges.length) {
                showSearching(path, 'Found ' + ranges.length + ' results');
                searchedDocs.push(doc.getSavePath());
            }
            possibleNewSearch();
            renderResults(doc, ranges);
            doc.unref(self);
        }

        function doSearch(path, fileServer, timeout, id) {
            if (id != searchId) return;
            var doc;
            var search = useWorker ? workerSearch : asyncSearch;
            if ((doc = Docs.forPath(path, fileServer))) {
                search(path, doc);
                return;
            }
            FileUtils.readFile(path, fileServer, function (res, err) {
                if (id != searchId) return;
                if (err === 'binary') {
                    if (lastWarnedBinaryFile != id) {
                        Notify.error('Unable to open binary file');
                        lastWarnedBinaryFile = id;
                    }
                    possibleNewSearch();
                    renderResults();
                    return;
                }
                if (err || res.length > MAX_FILE_SIZE) {
                    Notify.error('Error reading ' + path);
                    possibleNewSearch();
                    renderResults();
                    return;
                }
                if (new Date().getTime() > timeout) {
                    //stop search if timeout
                    //this implies that on a slow connection
                    //or for large files<MAX_FILE_SIZE, search may
                    //never happen but instead files are repeatedly
                    //downloaded. Caching can fix this though
                    self.SearchList.eatBack(path);
                    renderResults();
                    return;
                }
                showSearching(path, 'Searching');
                var mode = null;
                if (searchConfig.syntaxHighlightSearchResults) {
                    mode = Docs.autoMode(path);
                }
                doc = new Doc(res, path, mode, null);
                doc.ref(self);
                search(path, doc);
            });
        }

        //region Search worker
        var useWorker;

        function clearDocs(/*e*/) {
            Docs.forEach(function (doc) {
                doc.unref(self);
            });
        }
        var searchWorker;
        var terminate = Utils.debounce(function () {
            var a = searchWorker;
            if (a) {
                searchWorker = null;
                a.terminate();
                clearDocs();
                console.debug('Worker Terminated');
            }
        }, 60000);

        var createWorker; // :D All this work to save one event loop.
        var workerSearch = require('grace/core/depend').after(
            function (cb) {
                require(['./search_worker'], function (mod) {
                    createWorker = mod.createWorker;
                });
            },
            function (path, doc) {
                searchWorker =
                    searchWorker || createWorker(handleWorkerResult, clearDocs);
                terminate();
                searchWorker.postMessage({
                    re:
                        self.search.$options.re ||
                        self.search.$assembleRegExp(self.search.$options),
                    id: doc.id,
                    len: doc.getSize(),
                    path: doc.getSavePath(),
                });
            }
        );

        function handleWorkerResult(e) {
            terminate();
            var doc = Docs.get(e.data.id);
            if (!doc) return;
            switch (e.data.message) {
                case 'results':
                    handleResults(doc.getPath(), doc, e.data.ranges);
                    break;
                case 'getFile':
                    searchWorker.postMessage({
                        re:
                            self.search.$options.re ||
                            self.search.$assembleRegExp(self.search.$options),
                        id: doc.id,
                        text: doc.getValue(),
                        path: doc.getSavePath(),
                    });
            }
        }
        //endregion Searchworker

        //region Async search
        function asyncSearch(path, doc) {
            try {
                var ranges = self.search.findAll(doc.session);
                handleResults(path, doc, ranges);
            } catch (e) {
                handleResults(path, doc, []);
            }
        }
        //endregion Search Async

        /*States done|running|paused*/

        var empty = function () {
            lastResult = true;
            if (--runningSearches === 0) showSearchStopped();
        };

        var showSearchPaused = function () {
            showSearching.cancel();
            loadEl.hide();
            moreEl.attr('disabled', false);
            moreEl.show();
        };
        var onDir = function (dir) {
            showSearching(dir || '', 'Iterating ');
        };
        var dot = 0;
        var showSearching = Utils.delay(function (name, status) {
            dot = (dot + 1) % 4;
            var path = name || ' .' + Utils.repeat(dot, '.');
            path = '<li class=clipper >' + path + '</li>';
            loadEl.children('#searchStatusOp').html(status);
            loadEl.children('#searchStatusFile').html(path);
            require('grace/ui/ui_utils').styleClip(loadEl.children().eq(1));
        }, 100);
        var showSearchStarted = function () {
            moreEl.show();
            moreEl.attr('disabled', true);
            loadEl.show();
            emptyEl.hide();
        };
        var showSearchStopped = function () {
            loadEl.hide();
            moreEl.hide();
            showSearching.cancel();
            if (found < 1) {
                emptyEl.show();
            }
        };
        var stopSearch = function () {
            searchId += 1;
            runningSearches = 0;
            if (self.SearchList) self.SearchList.waiting = [];
            showSearchStopped();
            clearDocs();
        };

        //region Event Listeners
        undoButton.click(undoReplace);
        el.find('#searchConfig').click(openModal);
        el.find('.ace_search_options')
            .children()
            .click(function () {
                $(this).toggleClass('checked');
            });
        this.find = find;
        moreEl.click(moreResults);
        stopBtn.click(stopSearch);
        el.find('#toggleReplace').click(function () {
            el.toggleClass('show_replace');
            $(this).toggleClass(
                'btn-toggle__activated',
                el.hasClass('show_replace')
            );
        });
        bind('#searchInput', '#searchBtn', find);
        bind('#replaceInput', '#replaceBtn', replace);
        appEvents.on('changeProject', function (e) {
            searchInFolder(e.project.rootDir, e.project.fileServer);
        });
        Actions.addAction({
            caption: 'Search in folder',
            showIn: ['fileview.header', 'fileview.folder'],
            handle: function (ev) {
                searchInFolder(ev.filepath, ev.fs);
                searchOpenDocs(false);
                ev.preventDefault();
            },
        });
        searchOpenDocs(searchConfig.searchOpenDocs);
        $('#search_tab').show();
        ConfigEvents.on('search', function (ev) {
            switch (ev.config) {
                case 'searchOpenDocs':
                    el.find('#searchConfig').toggleClass(
                        'color-inactive',
                        !!ev.value()
                    );
                    if (ev.value()) {
                        stopSearch();
                    }
                    break;
                case 'searchTabFilter':
                    includeFilter =
                        searchConfig.searchTabFilter &&
                        globToRegex(searchConfig.searchTabFilter);
                    quickFilter = genQuickFilter(searchConfig.searchTabFilter);
                /*fall through*/
                case 'searchTabExclude':
                    if (ev.config === 'searchTabExclude')
                        excludeFilter = globToRegex($(this).val());
                    if (!searchConfigChanged && runningSearches > 0) {
                        find();
                    }
                    break;
            }
        });
        //endregion
    };

    function relative(b, l) {
        if (l.startsWith(b)) return './' + l.slice(b.length, l.length);
        else {
            return null;
        }
    }
    var createModal = function () {
        var modalEl = $(document.createElement('div'));
        modalEl.addClass('modal modal-large modal-fixed-height');
        modalEl.html(
            '\
<button class="close-icon material-icons h-30">close</button>\
<h6 class="modal-header">Filter Files</h6>\
<div class="panel-container">\
<div class="panel border-inactive">\
<div class="mb-10"><i><span class="blue-text">Dotstar</span> globbing is <span id = "dot-star-status">disabled</span>.</i>\
</div>\
<div class="mb-10"><i><span class="blue-text">Basename</span> matching is <span id = "basename-status">enabled</span>.</i>\
</div>\
<div class="h-30">\
    <input id="includeOpenDocs" type="checkbox" checked="true" /><span>Search in open files</span>\
</div>\
<label>Enter glob pattern:</label>\
<div class="input-field inline">\
    <input id="filterInput" placeholder="Enter patterns separated by comma" type="text" class="">\
</div>\
<label>Folders to ignore:</label>\
<div class="input-field inline">\
    <input id="excludeInput" placeholder="Search for" type="text" class="">\
</div>\
</div>\
<ul class="fileview">\
</ul>\
</div>'
        );
        styleCheckbox(modalEl);
        modalEl.find('.close-icon').click(function () {
            modalEl.modal('close');
        });
        return modalEl;
    };

    exports.SearchTab = SearchTab;
    var Tabs = require('grace/setup/setup_sideview').SideViewTabs;
    Tabs.insertTab(
        Tabs.indexOf('hierarchy_tab') + 1,
        'search_container',
        'search'
    );
    var SearchPanel = new SearchTab($('#search_container'));
    SearchPanel.init(require('grace/setup/setup_sideview').SideView);
}); /*_EndDefine*/