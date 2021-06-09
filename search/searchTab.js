_Define(function(global) {
    "use strict";
    var configure = global.configure;
    var appConfig = global.registerAll({
        "searchTabFilter": "**",
        "searchTabExclude": "**/.*git/",
        "searchOpenDocs": true,
        'maxSingleSearchTimeout': "2s",
        'searchTimeout': "30s",
        'searchThreshold': 200,
        "matchBaseName": false,
        'useSearchWorker': false,
        'lastSearch': "",
        'lastSearchOpts': 0,
        'syntaxHighlightSearchResults': true,
        'useRecyclerViewForSearchResults': true
    }, "search");
    global.registerValues({
        "searchThreshold": "Maximum number of results to get at a go before pausing",
        "matchBaseName": "Allows globs to match basenames. When enabled, it allows *.ext to match a/b/a.ext. Normally that would require **\\/*.ext. If using this option, ensure you update searchTabExclude so as not to slow down searches traversing unneeded directories",
        "searchTimeout": "Controls how long search continues before giving up",
        "lastSearch": "no-user-config",
        "lastSearchOpts": "no-user-config",
        "searchOpenDocs": "Whether search should be performed on open tabs \n or in current project folder",
        'useSearchWorker': "Experimental: Only use this if searches appear slow",
        "useRecyclerViewForSearchResults": "*Experimental feature to allow search to display long results more efficiently(needs reload)",
        "maxSingleSearchTimeout": "no-user-config"
    }, "search");
    var useRecycler = appConfig.useRecyclerViewForSearchResults;
    var Hierarchy = global.RHierarchy || global.Hierarchy;
    var SearchList = global.SearchList;
    var FindFileServer = global.FindFileServer;
    //var ViewportVisualizer = global.ViewportVisualizer;
    var Utils = global.Utils;
    var setImmediate = Utils.setImmediate;
    var plural = Utils.plural;
    var docs = global.docs;
    var Docs = global.Docs;
    var FileUtils = global.FileUtils;
    var closeDoc = global.closeDoc;
    var MAX_FILE_SIZE = Utils.parseSize('10mb');
    var getEditor = global.getEditor;
    var AutoCloseable = global.AutoCloseable;
    var Notify = global.Notify;
    var globToRegex = FileUtils.globToRegex;
    var styleCheckbox = global.styleCheckbox;
    var genQuickFilter = FileUtils.genQuickFilter;
    var SearchResults = global.SearchResults;
    var SearchReplace = global.SearchReplace;
    var Doc = global.Doc;
    var SearchTab = function(el) {
        var self = this;
        var project;
        this.search = new(ace.require("ace/search").Search)();
        this.regExpOption = el.find("#toggleRegex");
        this.caseSensitiveOption = el.find("#caseSensitive");
        this.wholeWordOption = el.find("#toggleWholeWord");
        appConfig.lastSearchOpts = parseInt(appConfig.lastSearchOpts);
        if (appConfig.lastSearchOpts & 4) this.regExpOption.addClass('checked');
        if (appConfig.lastSearchOpts & 2) this.caseSensitiveOption.addClass('checked');
        if (appConfig.lastSearchOpts & 1) this.wholeWordOption.addClass('checked');
        this.searchInput = el.find("#searchInput");
        this.replaceInput = el.find("#replaceInput");
        this.searchInput[0].value = appConfig.lastSearch;
        var moreEl = el.find("#showMoreResults");
        var loadEl = el.find("#loading");
        var stopBtn = loadEl.children(".red");
        var undoButton = $("#undoReplaceBtn");
        var searchInfo = el.find('#searchInfo');
        undoButton.hide();
        var searchInFolder = this.searchInFolder = function(folder, server) {
            project = {
                rootDir: folder,
                fileServer: server
            };
            searchResults.server = server;
            if (self.SearchList) {
                stopSearch();
                self.SearchList = null;
            }
            searchedDocs.length = 0;
            if (self.previewBrowser) {
                self.previewBrowser.fileServer = project.fileServer;
                self.previewBrowser.setRootDir(project.rootDir);
            }
            configure("searchOpenDocs", false, "search");
        };
        var quickFilter, includeFilter, excludeFilter;
        var filterFiles = function(name, path) {
            var rel = relative(project.rootDir, path + name);
            var isDirectory = FileUtils.isDirectory(rel);
            if (appConfig.matchBaseName) {
                return (isDirectory || (!includeFilter || includeFilter.test(name) || includeFilter.test(rel))) && !(
                    excludeFilter && (excludeFilter.test(name) || excludeFilter.test(rel)));
            }
            return (isDirectory ? quickFilter.test(rel) : (!includeFilter || includeFilter.test(rel))) && !(
                excludeFilter && excludeFilter.test(rel));
        };
        var init = this.init = function() {
            var project = FileUtils.getProject();
            if (project.fileServer) {
                searchInFolder(project.rootDir, project.fileServer);
            }
            includeFilter = appConfig.searchTabFilter && globToRegex(appConfig.searchTabFilter);
            quickFilter = genQuickFilter(appConfig.searchTabFilter);
            excludeFilter = globToRegex(appConfig.searchTabExclude);
        };
        //region modal
        var filterInput, excludeInput, modalEl, searchInTabs;
        var openModal = function() {
            if (!project) {
                Notify.info("No Project Folder!!", 500);
                return;
            }
            if (!modalEl) {
                modalEl = createModal(self);
                self.previewBrowser = new Hierarchy(modalEl.find(".fileview"), project.rootDir, project
                    .fileServer);
                self.previewBrowser.setRootDir(project.rootDir);
                self.previewBrowser.folderDropdown = "search-dropdown";
                self.previewBrowser.childFolderDropdown = "search-dropdown";
                self.previewBrowser.fileDropdown = "search-file-dropdown";
                self.previewBrowser.foldersToIgnore = [];
                self.previewBrowser.menuItems = {
                    "search-dropdown": Object.create(self.previewBrowser.menuItems[self.previewBrowser
                        .nestedFolderDropdown]),
                    "search-file-dropdown": Object.create(self.previewBrowser.menuItems[self.previewBrowser
                        .nestedFileDropdown])
                };
                filterInput = modalEl.find("#filterInput");
                excludeInput = modalEl.find("#excludeInput");
                filterInput.on("input", updatePreview);
                excludeInput.on("input", updatePreview);
                searchInTabs = modalEl.find("#includeOpenDocs")[0];
                $(searchInTabs).on("change", function(e) {
                    var val = e.target.checked;
                    if (!val) {
                        self.previewBrowser.stub.show();
                        updatePreview(true);
                    } else {
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
                        if (self.SearchList) self.SearchList.reset(true);
                        self.previewBrowser.inFilter && self.previewBrowser.stopFind();
                    },
                    onOpenEnd: AutoCloseable.onOpenEnd,
                    onCloseEnd: AutoCloseable.onCloseEnd
                });
                document.body.appendChild(modalEl[0]);
            }
            modalEl.modal("open");
            searchInTabs.checked = appConfig.searchOpenDocs;
            filterInput.val(appConfig.searchTabFilter);
            excludeInput.val(appConfig.searchTabExclude);
            if (appConfig.searchOpenDocs) {
                self.previewBrowser.stub.hide();
            } else {
                self.previewBrowser.stub.show();
                self.previewBrowser.findFile(filterFiles);
            }
        };
        var updateTimeout;
        var updatePreview = function(ev) {
            if (appConfig.searchOpenDocs) return;
            if (this == filterInput[0]) {
                configure("searchTabFilter", $(this).val(), "search");
                includeFilter = appConfig.searchTabFilter && globToRegex(appConfig.searchTabFilter);
                quickFilter = genQuickFilter(appConfig.searchTabFilter);
            } else if (this == excludeInput[0]) {
                excludeFilter = globToRegex($(this).val());
                configure("searchTabExclude", $(this).val(), "search");
            }
            if (self.previewBrowser.inFilter) {
                self.previewBrowser.stopFind();
            }
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = (ev ? setTimeout : setImmediate)(function() {
                self.previewBrowser.findFile(filterFiles);
                updateTimeout = null;
            }, 2000);
        };
        //endregion
        //region search
        var searchTimeout;
        var beginSearch = function(filename, useServer) {
            var doc = Docs.forPath(filename, (useServer === false) ? undefined : (project && project.fileServer));
            if (doc) {
                showSearching(filename, 'Searching');
                var ranges = self.search.findAll(doc.session);
                if (ranges.length) {
                    searchedDocs.push(filename);
                }
                possibleNewSearch();
                renderResults(doc, ranges);
            } else(useWorker ? workerSearch : asyncSearch)(filename, project.fileServer, currentTimeout,
            searchId);
        };
        var empty = function() {
            lastResult = true;
            showSearchStopped();
        };
        var lastResult, currentTimeout,
            searching, searchedDocs = [];
        var found, targetFinds;
        var searchId = 0;
        var find = function() {
            searchId += 1;
            searching = 0;
            lastResult = false;
            found = 0;
            targetFinds = parseInt(appConfig.searchThreshold);
            var opts = (self.regExpOption.hasClass("checked") ? 4 : 0) + (self.caseSensitiveOption.hasClass(
                "checked") ? 2 : 0) + (self.wholeWordOption.hasClass("checked") ? 1 : 0);
            self.search.setOptions({
                needle: self.searchInput.val(),
                wrap: false,
                regExp: opts & 4,
                caseSensitive: opts & 2,
                wholeWord: opts & 1,
            });
            searchResults.clear();
            searchedDocs.length = 0;
            searchInfo.text("");
            try{
                self.search.$assembleRegExp(self.search.$options);
            }
            catch(e){
               showSearchStarted();
               return showSearching(" ","<span class='red-text'>"+e.message+"</span>");
            }
            useWorker = appConfig.useSearchWorker;
            configure("lastSearch", self.searchInput.val(), "search");
            configure("lastSearchOpts", opts, "search");
            searchTimeout = Utils.parseTime(appConfig.searchTimeout);
            showSearchStarted();
            if (!project || appConfig.searchOpenDocs) {
                lastResult = true;
                for (var doc in docs) {
                    searching++;
                    //no server specified, multiple filenames might give error
                    //but use search in folder if needed
                    beginSearch(docs[doc].getPath(), false);
                }
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
                    searching++;
                    self.SearchList.getNext(beginSearch, empty);
                }
            }
        };
        var moreResults = function() {
            targetFinds = found + appConfig.searchThreshold;
            currentTimeout = new Date().getTime() + searchTimeout;
            for (var i = 0; i < 10; i++) {
                searching++;
                self.SearchList.getNext(beginSearch, empty);
            }
            showSearchStarted();
            showSearching(null, "Finding files");
        };
        //endregion
        //region replace
        var searchResults = new SearchResults(el.children("#searchResults"), useRecycler);
        searchResults.afterLineClicked = function() {
            getEditor().session.highlight(self.search.getOptions().re);
        };
        var searchReplace = new SearchReplace({
            onUndoFinished: function(refs) {
                SearchReplace.$defaultOpts.onUndoFinished(refs);
                undoButton.hide();
            },
            getRanges: function(doc, path) {
                return self.search.findAll(doc.session, undefined, undefined, true);
            },
            getReplacer: self.search.replace.bind(self.search)
        });
        var lastReplace = "",
            lastReplaced = "";
        var replace = function() {
            if (searchedDocs.length) {
                lastReplace = self.replaceInput.val();
                lastReplaced = appConfig.lastSearch;
                Notify.ask("Replace all instances of " + lastReplaced + " with " + lastReplace + "?", function() {
                    undoButton.show();
                    searchReplace.replace(searchedDocs, lastReplace);
                });
            }
        };
        var undoReplace = function() {
            var a = searchReplace.getDeltas();
            if (a && a.length) {
                Notify.ask("Undo replacement of " + lastReplaced + " with " + lastReplace + "?", function() {
                    searchReplace.undo();
                });
            }
        };

        function renderResults(doc, ranges) {
            if ((--searching) === 0) {
                if (lastResult) {
                    showSearchStopped();
                } else {
                    showSearchPaused();
                }
            }
            //todo handle when a single range is too long
            if (ranges && ranges.length > 0) {
                found += ranges.length;
                searchInfo.text('Found ' + found + ' results in ' + plural(searchedDocs.length, 'file'));
                searchResults.render(doc, ranges);
            }
        }

        function possibleNewSearch() {
            if (searching && searching < (useWorker ? 5 : 2) && found < targetFinds && new Date().getTime() <
                currentTimeout) {
                searching++;
                self.SearchList.getNext(beginSearch, empty);
            }
        }
        var useWorker;

        function clearDocs(e) {
            for (var i in docs) {
                if (docs[i].searchWillClear) {
                    if (docs[i].bound) docs[i].searchWillClear = false;
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
                    renderResults(doc, ranges);
                    if (doc.searchWillClear && !doc.bound) closeDoc(doc.id);
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
                    if (ck == "binary" && lastWarned!=id){
                        Notify.error('Unable to open binary file');
                        lastWarned = id;
                    }
                    else Notify.error("Error Reading "+path);
                    possibleNewSearch();
                    renderResults();
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
                        mode = global.modelist.getModeForPath(path).mode;
                    }
                    doc.session.setMode(mode);
                    doc.searchWillClear = true;
                }
            };
            var has = Docs.forPath(path, fileServer);
            if (has) callback(has, null, true);
            FileUtils.getDoc(path, fileServer, callback);
        }
        var lastWarned = -1;
        function asyncSearch(path, fileServer, timeout, id) {
            if (id != searchId) return;
            var doc;
            var search = function() {
                var ranges = self.search.findAll(doc.session);
                if (ranges.length) {
                    showSearching(path, "Found " + ranges.length + " results");
                    searchedDocs.push(doc.getSavePath());
                }
                possibleNewSearch();
                renderResults(doc, ranges);
            };
            if ((doc = Docs.forPath(path, fileServer))) {
                search();
                return;
            }
            if (FileUtils.isBinaryFile(path)) {
                if(lastWarned != id){
                Notify.error('Unable to open binary file');
                lastWarned = id;
                }
                possibleNewSearch();
                renderResults();
                return;
            }
            fileServer.readFile(path, FileUtils.encodingFor(path, fileServer), function(err, res) {
                if (id != searchId) return;
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
                showSearching(path, "Searching");
                var mode = null;
                if (appConfig.syntaxHighlightSearchResults) {
                    mode = global.modelist.getModeForPath(path).mode;
                }
                doc = new Doc(res, path, mode, null);
                try {
                    search();
                } catch (e) {
                    console.error(e); //new Error('Error during async search'))
                }
                closeDoc(doc.id);
            });
        }
        /*done|running|paused*/
        var showSearchPaused = function() {
            loadEl.hide();
            moreEl.attr('disabled', false);
            moreEl.show();
        };
        var onDir = function(dir){
            showSearching(dir||"","Iterating ");
        };
        var dot = 0;
        var showSearching = Utils.delay(function(name, status) {
            dot = (dot+1)%4;
            var path  = (name || ' .'+Utils.repeat(dot,"."));
            path = '<li class=clipper >' + path + '</li>';
            loadEl.children().eq(0).html(status);
            loadEl.children().eq(1).html(path);
            global.styleClip(loadEl.children().eq(1));
        },30);
        var showSearchStarted = function() {
            moreEl.attr('disabled', true);
            loadEl.show();
        };
        var showSearchStopped = function() {
            loadEl.hide();
            moreEl.hide();
        };
        var stopSearch = function() {
            searchId += 1;
            searching = 0;
            if (self.SearchList) self.SearchList.waiting = [];
            showSearchStopped();
            clearDocs();
        };
        undoButton.click(undoReplace);
        el.find("#searchConfig").click(openModal);
        el.find(".ace_search_options").children().click(function() {
            $(this).toggleClass("checked");
        });
        this.find = find;
        this.moreResults = moreResults;
        this.beginSearch = beginSearch;
        moreEl.click(moreResults);
        stopBtn.click(stopSearch);
        el.find("#toggleReplace").click(function() {
            if (el.hasClass("show_replace")) {
                el.removeClass('show_replace');
                $(this).text("keyboard_arrow_down");
            } else {
                el.addClass('show_replace');
                $(this).text("keyboard_arrow_up");
            }
        });
        var go = function(e) {
            var ENTER = 13;
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
                searchInFolder(ev.filepath, ev.browser.fileServer);
                ev.preventDefault();
            }
        };
        FileUtils.registerOption("files", ["folder", "create"], "search-in-folder", searchInFolderOption);
        $("#search_tab").show();
        
    };

    function relative(b, l) {
        if (l.startsWith(b)) return "./" + l.slice(b.length, l.length);
        else {
            return null;
        }
    }
    var WORKER_BLOB_URL;
    var MAX_CACHE_SIZE = Utils.parseSize('15mb');
    var createSearchWorker = function(cb, e) {
        if (!WORKER_BLOB_URL) WORKER_BLOB_URL = URL.createObjectURL(new Blob(["(" + inlineWorker.toString().replace(
            "$MAX_CACHE_SIZE", MAX_CACHE_SIZE) + ")()"], {
            type: 'text/javascript'
        }));
        var worker = new Worker(WORKER_BLOB_URL);
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
                        } else nextLinePos = Infinity;
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
                self.postMessage({
                    id: path,
                    message: 'results',
                    ranges: matches
                });
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
                    cache(e.data.path, e.data.text);
                    findAll(e.data.re, e.data.text, e.data.id);
                } else {
                    var text = fromCache(e.data.path);
                    if (text === null || text.length != e.data.len) {
                        self.postMessage({
                            id: e.data.id,
                            message: 'getFile'
                        });
                    } else {
                        findAll(e.data.re, text, e.data.id);
                    }
                }
            };
        }
        return worker;
    };
    var createModal = function() {
        var modalEl = $(document.createElement('div'));
        modalEl.addClass('modal');
        modalEl.html('\
<div class="modal-content">\
    <div class="h-30">\
        <h5>Filter Files<button class="close-icon material-icons">close</button></h5>\
    </div>\
<i><span class="blue-text">DotStar</span> globbing is disabled. Hidden files will not be matched unless explicitly included.</i>\
    <div class="h-30">\
        <input id="includeOpenDocs" type="checkbox" checked="true" /><span>Search in open files</span>\
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
        styleCheckbox(modalEl);
        modalEl.find(".close-icon").click(function() {
            modalEl.modal('close');
        });
        return modalEl;
    };
    global.SearchTab = SearchTab;
}) /*_EndDefine*/