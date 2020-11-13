(function(global) {
    "use strict";
    var configure = global.configure;
    var appConfig = global.registerAll({
        "searchTabFilter": "{*/,*/*/,*/*/*/}{*.js,*.html,*.css}",
        "searchTabExclude": "**/.git/",
        "searchOpenDocs": true,
        'maxSingleSearchTimeout': "2s",
        'searchTimeout': "5s",
        'useSearchWorker': false,
        'lastSearch': "",
        'syntaxHighlightSearchResults': true,
        'useRecyclerViewForSearchResults': true
    }, "search");
    global.registerValues({
        "lastSearch": "no-user-config",
        "searchOpenDocs": "Whether search should be performed on open tabs \n or in current project folder",
        'useSearchWorker': "Experimental: Only use this if searches appear slow",
        "useRecyclerViewForSearchResults": "*Experimental feature to allow search to display long results more efficiently(needs reload)",
        "maxSingleSearchTimeout": "no-user-config"
    }, "search");
    var useRecycler = appConfig.useRecyclerViewForSearchResults;
    var RecyclerViewHolder = global.RecyclerViewHolder;
    var RecyclerViewCache = global.RecyclerViewCache;
    var Hierarchy = global.RHierarchy || global.Hierarchy;
    var RangeRenderer = global.RangeRenderer;
    var SearchTree = global.SearchTree;
    var FindFileServer = global.FindFileServer;
    var braceExpand = global.braceExpand;
    //var ViewportVisualizer = global.ViewportVisualizer;
    var Utils = global.Utils;
    var RecyclerRenderer = global.RecyclerRenderer;
    var docs = global.docs;
    var Doc = global.Doc;
    var FileUtils = global.FileUtils;
    var closeDoc = global.closeDoc;
    var switchToDoc = global.Functions.switchToDoc;
    var ScrollSaver = global.ScrollSaver;
    var getEditor = global.getEditor;
    var AutoCloseable = global.AutoCloseable;
    var Notify = global.Notify;
    var MAX_FILE_SIZE = Utils.parseSize('10mb');
    var MAX_KEEP_LINES_RANGE_LENGTH = 500;


    var SearchTab = function(el) {
        const self = this;
        var renderer = new RangeRenderer();
        var project;
        this.search = new(ace.require("ace/search").Search)();

        this.regExpOption = el.find("#toggleRegex");
        this.regExpOption.addClass('checked');
        this.caseSensitiveOption = el.find("#caseSensitive");
        this.wholeWordOption = el.find("#toggleWholeWord");
        this.searchInput = el.find("#searchInput");
        this.replaceInput = el.find("#replaceInput");
        this.searchInput[0].value = appConfig.lastSearch;

        var results = el.children("#searchResults");

        var moreEl = el.find("#showMoreResults");
        var loadEl = el.find("#loading");
        var stopBtn = loadEl.children(".red");
        var undoButton = $("#undoReplaceBtn");
        var searchInfo = el.find('#searchInfo');

        undoButton.hide();
        var replaceBtn = $("#replaceBtn");

        var searchInFolder = this.searchInFolder = function(folder, server) {
            project = {
                rootDir: folder,
                fileServer: server
            };
            if (self.searchTree) {
                stopSearch();
                self.searchTree = null;
            }
            if (searchedDocs)
                searchedDocs.length = 0;
            if (self.previewBrowser) {
                self.previewBrowser.fileServer = project.fileServer;
                self.previewBrowser.setRootDir(project.rootDir);
            }
        };
        var quickFilter, includeFilter, excludeFilter;
        var filterFiles = function(i, path) {
            var rel = relative(project.rootDir, path + i);
            var isDirectory = FileUtils.isDirectory(rel);
            return (isDirectory ?
                    quickFilter.test(rel) :
                    (!includeFilter || includeFilter.test(rel))) &&
                !(excludeFilter && excludeFilter.test(rel));
        };

        var init = this.init = function() {
            var project = FileUtils.getProject();
            if (project.fileServer) {
                searchInFolder(project.rootDir, project.fileServer);
            }
            includeFilter = globToRegex(appConfig.searchTabFilter);
            quickFilter = genQuickFilter(appConfig.searchTabFilter);
            excludeFilter = globToRegex(appConfig.searchTabExclude);
        };


        //region modal
        var filterInput, excludeInput, modalEl;
        var openModal = function() {
            if (!project) {
                Notify.info("No Project Folder!!", 500);
                return;
            }
            if (!modalEl) {
                modalEl = createModal(self);
                self.previewBrowser = new Hierarchy(modalEl.find(".fileview"), project.rootDir, new FindFileServer(project.fileServer));
                self.previewBrowser.setRootDir(project.rootDir);
                self.previewBrowser.folderDropdown = "search-dropdown";
                self.previewBrowser.childFolderDropdown = "search-dropdown";
                self.previewBrowser.fileDropdown = "search-file-dropdown";
                self.previewBrowser.foldersToIgnore = [];
                self.previewBrowser.menuItems = {
                    "search-dropdown": Object.create(self.previewBrowser.menuItems[self.previewBrowser.nestedFolderDropdown]),
                    "search-file-dropdown": Object.create(self.previewBrowser.menuItems[self.previewBrowser.nestedFileDropdown])
                };

                filterInput = modalEl.find("#filterInput");
                excludeInput = modalEl.find("#excludeInput");

                filterInput.on("input", updatePreview);
                excludeInput.on("input", updatePreview);
                var searchInTabs = modalEl.find("#includeOpenDocs")[0];
                $(searchInTabs).on("change", function(e) {
                    var val = e.target.checked;
                    if (!val) {
                        self.previewBrowser.stub.show();
                        updatePreview(true);
                    }
                    else {
                        self.previewBrowser.stub.hide();
                    }
                    configure("searchOpenDocs", val, "search");
                });
                modalEl.modal({
                    dismissible: false,
                    inDuration: 0,
                    outDuration: 30,
                    onCloseStart: function() {
                        if (updateTimeout) {
                            clearTimeout(updateTimeout);
                            updateTimeout = null;
                        }
                        if (FileUtils.activeFileBrowser) {
                            FileUtils.activeFileBrowser.menu.hide();
                        }
                        if (self.searchTree)
                            self.searchTree.reset(true);
                        self.previewBrowser.inFilter && self.previewBrowser.stopFind();
                    },
                    onOpenEnd: AutoCloseable.onOpenEnd,
                    onCloseEnd: AutoCloseable.onCloseEnd
                });
                searchInTabs.checked = appConfig.searchOpenDocs;
                document.body.appendChild(modalEl[0]);
            }
            modalEl.modal("open");
            filterInput.val(appConfig.searchTabFilter);
            excludeInput.val(appConfig.searchTabExclude);

            if (appConfig.searchOpenDocs) {
                self.previewBrowser.stub.hide();
            }
            else {
                self.previewBrowser.findFile(filterFiles);
            }
        };
        var updateTimeout;
        var updatePreview = function(ev) {
            if (appConfig.searchOpenDocs)
                return;
            if (this == filterInput[0]) {
                configure("searchTabFilter", $(this).val(), "search");
                includeFilter = globToRegex(appConfig.searchTabFilter);
                quickFilter = genQuickFilter(appConfig.searchTabFilter);
            }
            else if (this == excludeInput[0]) {
                excludeFilter = globToRegex($(this).val());
                configure("searchTabExclude", $(this).val(), "search");
            }
            if (self.previewBrowser.inFilter) {
                self.previewBrowser.stopFind();
            }
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(function() {
                self.previewBrowser.findFile(filterFiles);
                updateTimeout = null;
            }, ev ? 2000 : 0);
        };
        //endregion

        //region search
        var searchTimeout;

        var beginSearch = function(filename, useServer) {
            var doc = Doc.forPath(filename, (useServer === false) ? undefined : (project && project.fileServer));
            if (doc) {
                showSearching(filename, 'Searching');
                var ranges = self.search.findAll(doc.session);
                if (ranges.length) {
                    searchedDocs.push(filename);
                }
                possibleNewSearch();
                inflateResults(doc, ranges, results);
            }
            else
                (useWorker ? workerSearch : asyncSearch)(filename, project.fileServer, currentTimeout, searchId);
        };

        var empty = function() {
            lastResult = true;
            showSearchStopped();
        };

        var lastResult, currentTimeout,
            searching, count, searchedDocs;
        var found = 0;
        var searchId = 0;
        var find = function() {
            searchId += 1;
            searching = 0;
            lastResult = false;
            results.find(".search_line").each(function(i, e) {
                e.searchData = null;
            });
            if (useRecycler) {
                recycler.detach();
                recycler.views = [];
                //sessions should automatically cleaned
                //results[0].appendChild(visualizer.el);
            }
            else {
                results.find(".searchResultTitle").each(function(i, e) {
                    e.searchData = null;
                });
                //clear searchline data??
                results.html("");
            }
            found = 0;
            renderer.config.width = results.width() - 20;
            renderer.config.themeClass = $('.editor')[0].className;
            self.search.setOptions({
                needle: self.searchInput.val(),
                wrap: false,
                regExp: self.regExpOption.hasClass("checked"),
                caseSensitive: self.caseSensitiveOption.hasClass("checked"),
                wholeWord: self.wholeWordOption.hasClass("checked"),
            });
            useWorker = appConfig.useSearchWorker;
            configure("lastSearch", self.searchInput.val(), "search");
            searchTimeout = Utils.parseTime(appConfig.searchTimeout);
            showSearchStarted();
            searchedDocs = [];
            if (!project || appConfig.searchOpenDocs) {
                lastResult = true;
                for (var doc in docs) {
                    searching++;
                    //no server specified, multiple filenames might give error
                    //but use search in folder if needed
                    beginSearch(docs[doc].getPath(), false);
                }
            }
            else {
                var rootDir = project.rootDir;
                if (rootDir != self.rootDir || !this.searchTree) {
                    var server = new FindFileServer(project.fileServer);
                    server.setFilter(filterFiles);
                    self.searchTree = new SearchTree(rootDir, server);
                    self.rootDir = rootDir;
                }
                self.searchTree.reset();
                currentTimeout = new Date().getTime() + searchTimeout;
                for (var i = 0; i < 10; i++) {
                    searching++;
                    self.searchTree.getNext(beginSearch, empty);
                }
                count = i;
            }
        };
        var moreResults = function() {
            if (!count) return find();
            currentTimeout = new Date().getTime() + searchTimeout;
            for (var i = count; i < count + 10; i++) {
                searching++;
                self.searchTree.getNext(beginSearch, empty);
            }
            count = i;
            showSearchStarted();
            showSearching(null, "Finding files");
        };

        //endregion

        //region replace
        var $tryReplace = function(session, range, replacement) {
            var input = session.getTextRange(range);
            replacement = self.search.replace(input, replacement, range.match);
            if (replacement !== null) {
                range.end = session.replace(range, replacement);
                return range;
            }
            else {
                return null;
            }
        };

        var undoDeltas = [];

        function revertDelta(doc, info) {
            //doc.saveCheckpoint('undo')
            if (doc.getChecksum() != info.checksum) {
                Notify.error("Document " + info.path + " has changed, cannot undo");
                return false;
            }
            var deltas = info.deltas;
            try {
                for (var i in deltas) {
                    doc.session.undoChanges(deltas[i], true);
                }
                return true;
            }
            catch (e) {
                Notify.error('Failed to undo changes ' + info.path);
                /*try{
                    doc.revert("undo")
                }
                catch(e){}*/
            }
        }
        var undoReplace = function() {
            var refs = 0;

            function next() {
                if (undoDeltas.length < 1) {
                    Notify.info('Undone changes in ' + refs + ' files');
                    undoButton.hide();
                    return;
                }
                var info = undoDeltas.pop();
                var e = info.path;
                var server = FileUtils.getFileServer(info.server, true);
                var doc = Doc.forPath(e, /*error-prone server might change*/ server);
                if (doc) {
                    if (revertDelta(doc, info)) {
                        refs++;
                    }
                    next();
                }
                else project.fileServer.readFile(e, FileUtils.encodingFor(e, server), function(err, res) {
                    if (err) {
                        Notify.error('Unable to read file ', e);
                        return next();
                    }
                    doc = new Doc(res, e);
                    if (revertDelta(doc, info)) {
                        doc.save(function(doc, err) {
                            //no recovery after this
                            if (err) Notify.error("Unable to save file ", e);
                            else refs++;
                            if (!doc.bound) closeDoc(doc.id);
                            next();
                        });
                    }
                });

            }
            next();
        };

        var replaceRanges = function(doc, replacement, path, server) {
            var ranges = self.search.findAll(doc.session, undefined, undefined, true);
            var replacements = 0;
            var manager = doc.session.$undoManager;
            if (!manager) {
                manager = new ace.UndoManager();
                doc.session.setUndoManager(manager);
            }
            var rev = manager.startNewGroup();
            for (var i = ranges.length - 1; i >= 0; --i) {
                var delta;
                if ((delta = $tryReplace(doc.session, ranges[i], replacement))) {
                    replacements++;
                }
            }
            var deltas = manager.getDeltas(rev);
            //to do if deltas.length
            if (deltas) {
                undoDeltas.push({
                    path: path,
                    server: (server || project.fileServer).id,
                    checksum: doc.getChecksum(),
                    deltas: deltas
                });
            }
            return replacements;
        };
        var replace = function() {
            if (!searchedDocs.length) return;
            undoDeltas = [];
            var replaced = 0;
            var refs = 0;
            var replacement = self.replaceInput.val();
            if (appConfig.searchOpenDocs) {
                for (var i in searchedDocs) {
                    var doc = Doc.forPath(searchedDocs[i]);
                    var result = replaceRanges(doc, replacement, doc.getPath(), doc.getFileServer());
                    if (result > 0) {
                        refs++;
                        replaced += result;
                    }
                }
                searchedDocs = [];
                Notify.info('Replaced ' + replaced + ' instances in ' + refs + ' files');
            }
            else {
                var p = -1;

                var next = function() {
                    p += 1;
                    if (searchedDocs.length < 1) {
                        Notify.info('Replaced ' + replaced + ' instances in ' + refs + ' files');

                        return;
                    }
                    var e = searchedDocs.pop();
                    var doc = Doc.forPath(e, project && project.fileServer);
                    if (doc) {
                        replaced += replaceRanges(doc, replacement, e);
                        refs++;
                        next();
                    }
                    else project.fileServer.readFile(e, FileUtils.encodingFor(e, project.fileServer), function(err, res) {
                        if (err) {
                            Notify.error('Unable to read file ', e);
                            return next();
                        }
                        doc = new Doc(res, e);
                        replaced += replaceRanges(doc, replacement, e);
                        refs++;
                        var id = doc.id;
                        doc.save(function(doc, err) {
                            if (err) Notify.error("Unable to save file ", e);
                            if (!doc.bound) closeDoc(id);
                            next();
                        });
                    });
                };
                next();
            }
            undoButton.show();
        };
        //endregion
        this.renderRanges = function(doc, ranges) {
            searchId += 1;
            searching = 0;
            lastResult = false;
            results.html("");
            found = 0;
            if (useRecycler) {
                recycler.detach();
                recycler.views = [];
                //results[0].appendChild(visualizer.el);
            }
            renderer.config.width = results.width() - 20;
            renderer.config.themeClass = $('.editor')[0].className;
            inflateResults(doc, ranges);
        };

        function inflateResults(doc, ranges) {
            var lastLine = -1;
            if ((--searching) === 0) {
                if (lastResult) {
                    showSearchStopped();
                }
                else {
                    showSearchPaused();
                }
            }
            if (ranges && ranges.length > 0) {
                found += ranges.length;
                searchInfo.text('Found ' + found + ' results in ' + searchedDocs.length + ' files');
                var header;
                if (useRecycler) {
                    var holder = getHolder(doc, ranges);
                    header = new HeaderViewHolder(holder, recycler);
                    while (holder.start < ranges.length) {
                        var list = new ResultViewHolder(holder, recycler);
                        holder.views.push(list);
                    }
                }
                else {
                    header = headerCache.pop();
                    setTitle(header[0], doc.getPath(), ranges.length);
                    var body = renderer.render(ranges, doc.session);
                    bindClickListeners(body.children, ranges, doc.getPath());
                    header.searchData = $(body);
                    results[0].appendChild(body);
                }
            }
        }

        function possibleNewSearch() {
            if (searching && searching < (useWorker ? 5 : 2) && new Date().getTime() < currentTimeout) {
                searching++;
                self.searchTree.getNext(beginSearch, empty);
            }
        }
        var useWorker;

        function clearDocs(e) {
            for (var i in docs) {
                if (docs[i].searchWillClear) {
                    if (docs[i].bound)
                        docs[i].searchWillClear = false;
                    else closeDoc(i);
                }
            }
        }
        var searchWorker;
        var terminate = Utils.debounce(function() {
            var a = searchWorker;
            if (a) {
                searchWorker = null;
                a.terminate();
                a = WORKER_BLOB_URL;
                WORKER_BLOB_URL = null;
                URL.revokeObjectURL(a);
                clearDocs();
                console.debug('Worker Terminated');
            }
        }, 60000);

        function handleResult(e) {
            terminate();
            var doc = docs[e.data.id];
            if (!doc) return;
            switch (e.data.message) {
                case 'results':
                    var ranges = e.data.ranges;
                    if (ranges.length) {
                        showSearching(doc.getPath(), "Found " + ranges.length + " results");
                        searchedDocs.push(doc.getSavePath());
                    }
                    possibleNewSearch();
                    inflateResults(doc, ranges, results);
                    if (doc.searchWillClear && !doc.bound)
                        closeDoc(doc.id);

                    break;
                case 'getFile':
                    searchWorker.postMessage({
                        re: self.search.$options.re || self.search.$assembleRegExp(self.search.$options),
                        id: doc.id,
                        text: doc.getValue(),
                        path: doc.getSavePath()
                    });
            }

        }

        function workerSearch(path, fileServer, timeout, id) {
            searchWorker = searchWorker || createSearchWorker(handleResult, clearDocs);
            terminate();

            var callback = function(doc, ck, clear) {
                if (!doc) {
                    if (ck == "binary")
                        Notify.error('Unable to open binary file');
                    possibleNewSearch();
                    inflateResults();
                    return;
                }
                showSearching(path, "Searching");
                var mode = null;
                searchWorker.postMessage({
                    re: self.search.$options.re || self.search.$assembleRegExp(self.search.$options),
                    id: doc.id,
                    len: doc.getSize(),
                    path: doc.getSavePath()
                });

                if (!clear) {
                    if (appConfig.syntaxHighlightSearchResults) {
                        mode = ace.require("ace/ext/modelist").getModeForPath(path).mode;
                    }
                    doc.session.setMode(mode);
                    doc.searchWillClear = true;
                }
            };
            var has = Doc.forPath(path, fileServer);
            if (has) callback(has, null, true);
            FileUtils.getDoc(path, fileServer, callback);
        }

        function asyncSearch(path, fileServer, timeout, id) {
            if (id != searchId) return;
            var doc;
            var search = function() {
                var find = self.search.getSearchIterator(doc.session, true).findNext;
                ////var ranges = self.search.findAll(doc.session);
                var ranges = [];
                find(function(a, b, c, d) {
                    ranges.push({
                        start: {
                            row: a,
                            column: b
                        },
                        end: {
                            row: c,
                            column: d
                        }
                    });
                });
                if (ranges.length) {
                    showSearching(path, "Found " + ranges.length + " results");
                    searchedDocs.push(doc.getSavePath());
                }
                possibleNewSearch();
                inflateResults(doc, ranges, results);
            };
            if ((doc = Doc.forPath(path, fileServer))) {
                search();
                return;
            }
            if (FileUtils.isBinaryFile(path)) {
                Notify.error('Unable to open binary file');
                possibleNewSearch();
                inflateResults();
                return;
            }
            fileServer.readFile(path, FileUtils.encodingFor(path, fileServer), function(err, res) {
                if (id != searchId) return;
                if (err || res.length > MAX_FILE_SIZE) {
                    Notify.error('Error reading ' + path);
                    possibleNewSearch();
                    inflateResults();
                    return;
                }
                if (new Date().getTime() > timeout) {
                    //stop search if timeout
                    //this implies that on a slow connection
                    //or for large files<MAX_FILE_SIZE, search may
                    //never happen but instead files are repeatedly
                    //downloaded. Caching can fix this though
                    self.searchTree.eatBack(path);
                    inflateResults();
                    return;
                }
                showSearching(path, "Searching");
                var mode = null;
                if (appConfig.syntaxHighlightSearchResults) {
                    mode = ace.require("ace/ext/modelist").getModeForPath(path).mode;
                }
                doc = new Doc(res, path, mode, null);
                try {
                    search();
                }
                catch (e) {
                    console.error(e); //new Error('Error during async search'))
                }
                closeDoc(doc.id);
            });

        }
        var showSearchPaused = function() {
            loadEl.hide();
            moreEl.show();
        };
        var showSearching = function(name, status) {
            status = status + ' ' + (name || ' ....');
            status = '<li class=clipper >' + status + '</li>';
            loadEl.children().eq(0).html(status);
        };
        var showSearchStarted = function() {
            moreEl.hide();
            loadEl.show();
        };
        var showSearchStopped = function() {
            loadEl.hide();
            moreEl.hide();
        };
        var stopSearch = function() {
            searchId += 1;
            searching = 0;
            if (self.searchTree)
                self.searchTree.waiting = [];
            showSearchStopped();
            clearDocs();
        };


        var headerCache = new RecyclerViewCache(function() {
            var div = document.createElement("div");
            div.className = "searchResultTitle";
            div.innerHTML = "<h6 class='clipper searchResultFile'></h6>" +
                "<div class='edge_box-1 h-30'>" +
                "<i class='fill_box center numRanges'></i>" +
                "<i class='material-icons side-1 foldResult'>keyboard_arrow_up</i>" +
                "</div>";
            div.style.width = '100%';
            if (useRecycler) div.style.position = 'absolute';
            return $(div);
        }, results[0]);
        var recycler, lineCache, getHolder;
        if (useRecycler) {
            results.css('position', 'relative');
            lineCache = new RecyclerViewCache(function() {
                var div = document.createElement("div");
                div.style.width = '100%';
                div.className = renderer.config.themeClass;
                div.style.position = 'absolute';
                return $(div);
            }, results[0]);
            var holder_props = {
                css: function(i) {
                    if (i != 'display') {
                        console.warn('Unimplemented property ' + i);
                    }
                    else if (this.hidden) {
                        return 'none';
                    }
                    else {
                        return 'block';
                    }
                },
                show: function() {
                    this.hidden = false;
                    for (var i in this.views) {
                        this.views[i].show();
                    }
                },
                hide: function() {
                    this.hidden = true;
                    for (var i in this.views) {
                        this.views[i].hide();
                    }
                },
                renderer: renderer,
                headerCache: headerCache,
                lineCache: lineCache
            };
            getHolder = function(doc, ranges) {
                var endLine = 0;
                var mode = ace.config.$modes[doc.session.$modeId];
                var lines;

                //Better syntax highlighting if context is not lost
                //But no keeping large documents because of that
                if (doc.session.$modeId != "ace/mode/text" && mode && ranges[ranges.length - 1].end.row < MAX_KEEP_LINES_RANGE_LENGTH) {
                    endLine = ranges[ranges.length - 1].end.row;
                    lines = doc.session.getLines(0, endLine);
                }
                else {
                    var value = [];
                    for (var i in ranges) {
                        var start = ranges[i].start.row;
                        var reset = "*/\"\"\"-->";
                        while (start > endLine) {
                            value.push(reset);
                            endLine++;
                            if (reset) reset = "";
                        }
                        if (start == endLine) {
                            endLine = ranges[i].end.row;
                            value.push.apply(value, (doc.session.getLines(start, endLine)));
                            endLine++;
                        }
                    }
                    lines = value;
                }
                var session = new ace.EditSession(lines, mode);
                var holder = Object.assign({
                    ranges: ranges,
                    lastLine: endLine,
                    session: session,
                    path: doc.getPath(),
                    config: renderer.config,
                    //ranges are split into line chunks of maxHeight for renderering
                    maxHeight: 5,
                    start: 0,
                    hidden: false,
                    views: []
                }, holder_props);
                holder.session.setUseWorker(false);
                return holder;
            };
            recycler = new RecyclerRenderer();
            //var visualizer = ViewportVisualizer.create(results[0], recycler);
            var scrollers = ScrollSaver.getScrollingElements(results);
            recycler.beforeRender = function() {
                results.css('height', recycler.height);
                if (results.css('height') != recycler.height + "px") {
                    var store = ScrollSaver.saveScroll(scrollers);
                    results.css('height', recycler.height + 'px');
                    if (store._5sum != ScrollSaver.getScroll(scrollers)) {
                        ScrollSaver.restoreScroll(scrollers, els);
                    }
                }
                //visualizer.update();
            };
            //recycler.viewport = recycler.INFINITE_VIEWPORT;
            //load everything at once?
            var doScroll = function(e) {
                var y = ScrollSaver.getScroll(scrollers);
                recycler.scrollTo(y);
            };
            scrollers.on('scroll', doScroll);
            doScroll();
        }

        undoButton.click(undoReplace);
        el.find("#searchConfig").click(openModal);
        el.find(".ace_search_options").children().click(function() {
            $(this).toggleClass("checked");
        });
        results.on('click', '.search_line', function(e) {
            switchToDoc(this.searchData.path, this.searchData.range.start, this.searchData.range.end, true, function() {
                getEditor().findAll("", self.search.getOptions());
            });
            e.stopPropagation();
        });
        this.find = find;
        this.moreResults = moreResults;
        this.beginSearch = beginSearch;

        moreEl.click(moreResults);
        stopBtn.click(stopSearch);

        el.on("click", ".foldResult", function() {
            var a = $(this).closest(".searchResultTitle")[0].searchData;
            if (a.css("display") == "none") {
                a.show();
                $(this).html("keyboard_arrow_up");
            }
            else {
                a.hide();
                $(this).html("keyboard_arrow_down");
            }
        });
        el.find("#toggleReplace").click(function() {
            if (el.hasClass("show_replace")) {
                el.removeClass('show_replace');
                $(this).text("keyboard_arrow_down");
            }
            else {
                el.addClass('show_replace');
                $(this).text("keyboard_arrow_up");
            }
        });
        var go = function(e) {
            var ENTER = 13,
                ESC = 27;
            switch (e.keyCode) {
                case ENTER:
                    $(this).trigger("go", e);
                    break;
            }
        };
        var bind = function(input, btn, func) {
            $(btn).on('click', func);
            $(input).on('go', func);
            $(input).on('keypress', go);
        };
        bind("#searchInput", "#searchBtn", find);
        bind("#replaceInput", "#replaceBtn", replace);
        bind = null;

        FileUtils.on('change-project', function(e) {
            searchInFolder(e.project.rootDir, e.project.fileServer);
        });
        var searchInFolderOption = {
            id: "search-in-folder",
            caption: "Search In Folder",
            onclick: function(ev) {
                searchInFolder(
                    ev.filepath,
                    ev.browser.fileServer
                );
                ev.preventDefault();
            }
        };
        FileUtils.registerOption("files", ["folder", "create"], "search-in-folder", searchInFolderOption);

    };

    function relative(b, l) {
        if (l.startsWith(b))
            return "./" + l.slice(b.length, l.length);
        else {
            return null;
        }
    }

    function bindClickListeners(elements, ranges, path) {
        for (var i = 0, j = 0; i < elements.length; j++) {
            var range = ranges[j];
            if (!range) {
                console.warn('Renderer error more elements than ranges');
                break;
            }
            var data = {
                path: path,
                range: range
            };
            //if you use renderPlain, diff is always 1
            //because results ar.e merged
            //var diff = 1
            var diff = (range.end.row - range.start.row + 1);

            for (var k = 0; k < diff; k++, i++) {
                elements[i].className += ' search_line';
                elements[i].searchData = data;
            }
        }
    }
    var WORKER_BLOB_URL;
    var MAX_CACHE_SIZE = Utils.parseSize('15mb');
    var createSearchWorker = function(cb, e) {
        if (!WORKER_BLOB_URL) WORKER_BLOB_URL = URL.createObjectURL(new Blob(["(" + inlineWorker.toString().replace("$MAX_CACHE_SIZE", MAX_CACHE_SIZE) + ")()"], { type: 'text/javascript' }));
        const worker = new Worker(WORKER_BLOB_URL);
        worker.onmessage = cb;
        worker.onerror = e;

        function inlineWorker() {
            /* eslint-disable no-restricted-globals */
            var createCounter = function(text) {
                var line = -1,
                    nextLinePos = 0,
                    lastLinePos = -1;
                var newLine = /\r\n|\r|\n/g;
                return function getPos(offset) {
                    var match;
                    if (offset < lastLinePos) {
                        line = -1,
                            nextLinePos = 0,
                            lastLinePos = -1;
                        newLine = /\r\n|\r|\n/g;
                    }
                    while (offset >= nextLinePos) {
                        lastLinePos = nextLinePos;
                        line++;
                        match = newLine.exec(text);
                        if (match) {
                            nextLinePos = match.index + match[0].length;
                        }
                        else nextLinePos = Infinity;
                    }
                    return {
                        row: line,
                        column: offset - lastLinePos
                    };

                };
            };

            function findAll(re, text, path) {
                var matches = [];
                var counter = createCounter(text);
                text.replace(re, function(str) {
                    var pos = arguments[arguments.length - 2];
                    matches.push({
                        start: counter(pos),
                        end: counter(pos + str.length)
                    });
                });
                self.postMessage({ id: path, message: 'results', ranges: matches });
            }

            var cached = {};
            var cachedSize = 0;
            var MAX_CACHE_SIZE = $MAX_CACHE_SIZE;

            function cache(path, res) {
                if (res.length > MAX_CACHE_SIZE * 0.75) return;
                cachedSize += res.length;
                cached[path] = res;
                if (cachedSize > MAX_CACHE_SIZE) {
                    var keys = Object.keys(cached);
                    keys.sort(function(e, l) {
                        return cached[l].length - cached[e].length;
                    });
                    while (cachedSize > MAX_CACHE_SIZE * 0.75) {
                        var a = keys.pop();
                        cachedSize -= cached[a].length;
                        delete cached[a];
                    }
                }
            }

            function fromCache(path) {
                if (cached.hasOwnProperty(path)) {
                    return cached[path];
                }
                return null;
            }
            onmessage = function(e) {
                if (e.data.hasOwnProperty('text')) {
                    try {
                        cache(e.data.path, e.data.text);
                    }
                    catch (e) {}
                    findAll(e.data.re, e.data.text, e.data.id);
                }
                else {
                    var text = fromCache(e.data.path);
                    if (text === null || text.length != e.data.len) {
                        self.postMessage({ id: e.data.id, message: 'getFile' });
                    }
                    else {
                        findAll(e.data.re, text, e.data.id);
                    }
                }
            };
        }
        return worker;
    };
    var isNotSpace = function(t) {
        return !/^\s*$/.test(t);
    };
    var createModal = function(self) {
        var modalEl = $(document.createElement('div'));
        modalEl.addClass('modal');
        modalEl.html(
            '\
<div class="modal-content">\
    <div class="h-30">\
        <h5>Filter Files<button class="close-icon material-icons">close</button></h5>\
    </div>\
    <div class="h-30">\
        <input id="includeOpenDocs" class="" type="checkbox" checked="true" /><span>Search in open files</span>\
    </div>\
    <h6>Enter glob pattern:</h6>\
    <div class="input-field inline">\
        <input id="filterInput" placeholder="Enter patterns separated by comma" type="text" class="">\
    </div>\
    <h6>Folders to ignore:</h6>\
    <div class="input-field inline">\
        <input id="excludeInput" placeholder="Search for" type="text" class="">\
    </div>\
    <div class="fileview-container">\
        <ul class="fileview">\
        </ul>\
    </div>\
</div>');
        modalEl.find('input').filter('[type=checkbox]').next().click(function(e) { $(this).prev().click() });

        modalEl.find(".close-icon").click(function() {
            modalEl.modal('close');
        });
        return modalEl;
    };

    function genQuickFilter(g) {
        if (/\{|\}/.test(g)) {
            g = braceExpand("{" + g + ",}").join(",");
        }
        g = FileUtils.normalize(g);
        var globs = g.split(",").filter(isNotSpace);
        var plainText = /^(?:\.\/)?([-\w\.\$\(\)@]+)(?:\/([-\w\.\$\(\)@]+))?(?:\/([-\w\.\$\(\)@]+))?(?:\/([-\w\.\$\(\)@]+))?/;
        var a = [];
        var t;
        for (var i in globs) {
            var start = "^";
            var nest = 0;
            //./*.js causes hidden folders to be checked
            if ((t = plainText.exec(globs[i])) && t[1] !== ".") {
                start += "(?:\.\/)?" + Utils.regEscape(t[1]);
                nest++;
                while (t[nest + 1]) {
                    start += "(\/?$|\/" + Utils.regEscape(t[nest + 1]);
                    nest++;
                }
            }
            if (globs[i].indexOf("**") < 0) {
                start += "([^\/]*\/){0," + (globs[i].split("/").length - nest - 1) + "}[^\/]*\/?$";
            }
            else if (!t)
                return alwaysTrue;

            for (var k = nest - 1; k > 0; k++) {
                start += ")";
            }
            a.push(start);
        }
        if (a.length)
            return new RegExp(a.join("|"));
        return alwaysTrue;
    }
    var alwaysTrue = {
        test: function() { return true }
    };

    function globToRegex(g) {
        if (/\{|\}/.test(g)) {
            g = braceExpand("{" + g + ",}").join(",");
        }
        g = FileUtils.normalize(g);
        var globs = g.split(",").filter(isNotSpace);
        var regexStr = "";
        var singleLetter = "[^\/]";
        var star = singleLetter + "*";
        var dotstar = appConfig.dotStar ? star : "([^\.\/]*|[^\/\.][^\/]*)";
        var DOUBLE_STAR = "62727HOLDER39393";
        var curdir = "(^(?:\.\/)?";
        var DOT_STAR = "39EHD8EN3IDJD3";
        var DEDOUBLE_STAR = new RegExp(DOUBLE_STAR, "g");
        var DEDOT_STAR = new RegExp(DOT_STAR, "g");
        var doublestar = "(.*\/)*";
        for (var i in globs) {
            globs[i] = curdir + Utils.regEscape(globs[i])
                .replace(/\\\?/g, singleLetter)
                .replace(/\\\[\\\!/, "[^")
                .replace(/\\\]/g, "]")
                .replace(/\\\*\\\*\//g, DOUBLE_STAR)
                .replace(/\\\/\\\*/g, DOT_STAR)
                .replace(/\\\*/g, star)
                .replace(DEDOUBLE_STAR, doublestar)
                .replace(DEDOT_STAR, dotstar) + "\/?$)";
        }
        if (!globs.length) return null;
        return new RegExp(globs.join("|"));

    }


    function setTitle(el, path, c) {
        el = $(el);
        el.find(".searchResultFile").text(path);
        el.find(".numRanges").text(c + " results");
    }

    global.SearchTab = SearchTab;

    if (useRecycler) {
        var HeaderViewHolder = function(holder, renderer) {
            /*todo calculate header size*/
            RecyclerViewHolder.apply(this, [holder.headerCache, renderer, 65]);
            renderer.register(Infinity, this);
            this.path = holder.path;
            this.numResults = holder.ranges.length;
            this.holder = holder;
        };
        HeaderViewHolder.prototype = Object.create(RecyclerViewHolder.prototype);
        HeaderViewHolder.prototype.bindView = function() {
            setTitle(this.view, this.path, this.numResults);
            this.view[0].searchData = this.holder;
            if (this.holder.hidden) {
                this.view.find('.foldResult').html("keyboard_arrow_down");
            }
            else {
                this.view.find('.foldResult').html("keyboard_arrow_up");
            }
        };
        HeaderViewHolder.prototype.detach = function() {
            if (this.view)
                this.view[0].searchData = null;
            RecyclerViewHolder.prototype.detach.apply(this, arguments);
        };
        var ResultViewHolder = function(holder, renderer) {
            RecyclerViewHolder.apply(this, [holder.lineCache, renderer, 0]);
            var start = holder.start || 0;
            this.holder = holder;
            this.renderer = renderer;
            this.height = 0;
            this.range = holder.ranges;
            if (holder.maxHeight <= 0) {
                throw 'Error Invalid maxHeight';
            }
            for (var i = start; this.height < holder.maxHeight && i < holder.ranges.length; i++) {
                this.height += this.range[i].end.row - this.range[i].start.row + 1;
            }
            var end = i;
            this.range = holder.ranges.slice(start, end);
            holder.start = i;
            this.height *= holder.config.lineHeight;
            renderer.register(Infinity, this);
        };
        ResultViewHolder.prototype = Object.create(RecyclerViewHolder.prototype);

        ResultViewHolder.prototype.compute = function() {
            return this.hidden ? 0 : this.height;
        };
        ResultViewHolder.prototype.bindView = function() {
            //quite unfortunate,
            this.view[0].innerHTML = "";
            //maybe later we can reuse
            //the lineelements
            var ranges = this.range;
            this.view.css('height', this.height + 'px');
            this.holder.renderer.render(ranges, this.holder.session, null, this.view[0], this.holder.lastLine);
            bindClickListeners(this.view[0].children, ranges, this.holder.path);
        };
    }
})(Modules);