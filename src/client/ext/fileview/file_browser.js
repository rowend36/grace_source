define(function (require, exports, module) {
    'use strict';
    /*globals $*/
    require('grace/ext/file_utils/glob');
    require('css!./file_browser.css');
    var configure = require('grace/core/config').Config.configure;
    var SideViewTabs = require('grace/setup/setup_sideview').SideViewTabs;
    var table = require('grace/ui/ui_utils').tabulate;
    var unimplemented = require('grace/core/utils').Utils.unimplemented;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var StopSignal = require('grace/ext/stop_signal').StopSignal;
    var Fileviews = require('grace/ext/fileview/fileviews').Fileviews;
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            showHiddenFiles: true,
            markFileOnHold: true,
            showFileInfo: false,
            expandAllFilter: '.git/,node_modules/,build/',
            askBeforeDelete: '**/.*git/**,**/src/,**/node_modules',
            askBeforeDeleteNonEmptyFolders: false,
        },
        'files'
    );
    require('grace/core/config').Config.registerInfo(
        {
            expandAllFilter:
                'Folders to ignore when executing "unfold all" and "find file" operations',
            askBeforeDelete:
                'Files containing any of this fragments need confirmation before delete.\n\
Wildcards are recognised. \n\
Warning: This will not stop the user from deleting parent folders.',
            askBeforeDeleteNonEmptyFolders:
                'Confirm before deleting all non empty folders',
        },
        'files'
    );
    var configEvents = require('grace/core/config').Config;
    var appEvents = require('grace/core/app_events').AppEvents;
    var SEP = FileUtils.sep;
    var Dropdown = require('grace/ui/dropdown').Dropdown;
    var FindFileServer = require('grace/ext/fs/find_fs').FindFileServer;
    var Notify = require('grace/ui/notify').Notify;
    var Docs = require('grace/docs/docs').Docs;
    var setTab = require('grace/setup/setup_tab_host').setTab;
    var Utils = require('grace/core/utils').Utils;
    var setProp = Utils.setProp;
    var toDate = Utils.toDate;
    var setImmediate = require('grace/core/utils').Utils.setImmediate;
    var sort = FileUtils.sort;
    var normalize = require('grace/core/file_utils').FileUtils.normalize;
    var sort_mode = 'folder,code,name';
    var Icons = require('./file_icons').FileIcons;
    //How many files we stat in parallel when reloading directories
    var STAT_BATCH_SIZE = 50;
    configEvents.on('files', function (ev) {
        switch (ev.config) {
            case 'askBeforeDelete':
                try {
                    FileUtils.globToRegex(appConfig.askBeforeDelete);
                } catch (e) {
                    Notify.error('Invalid glob');
                    ev.preventDefault();
                }
        }
    });
    var recentFolders = appConfig.recentFolders;
    /**@constructor*/
    function FileBrowser(id, rootDir, fileServer, noReload) {
        var stub;
        this.fileServer = fileServer;
        /*@type Array<String>*/
        this.$marked = [];
        //the html element of the fileview
        this.stub = null;
        //the fixed header
        this.header = null;
        //the scrollable element
        this.root = null;
        //the current directory
        this.rootDir = null;
        /** @type {Array<string>} - list of filenames */
        this.names = [];
        //Satisfy tslint halfway
        this.tree = this.menu = this.fileStats = this.childViews = this.extraSpace = this.newFiles = this.selected = this.fileNameToSelect = this.headerMode = this.prevHeaderMode = null;
        this.loaderEl = this.backButton = this.topElement = this.bottomElement = this.inlineDialog = this.inlineDialogStub = this.scroller = null;
        this.inSelectMode = this.inFilter = false;
        this.runningTasks = this.pageEnd = this.pageStart = this.preStart = 0;
        //Create server
        if (!this.fileServer) {
            this.fileServer = FileUtils.getFileServer();
        }
        //Create stub
        if (typeof id === 'object') {
            stub = id;
            id = undefined;
        } else stub = $('#' + id);
        if (stub.length < 1) {
            throw new Error('Bad id or selector ' + id);
        }
        //the container element
        this.stub = stub;
        this.id = id;
        this.paddingBottom = this.paddingTop = 0;
        if (rootDir && rootDir.indexOf(this.fileServer.getRoot()) > -1) {
            this.rootDir = rootDir;
        } else if (id && (rootDir = appConfig['root:' + id])) {
            this.rootDir = rootDir;
        } else {
            this.rootDir = this.fileServer.getRoot();
        }
        var showFileInfo = this.showFileInfo;
        if (showFileInfo == null) {
            showFileInfo = appConfig['info:' + id];
            if (showFileInfo == null) {
                showFileInfo = appConfig.showFileInfo;
            }
            this.showFileInfo = showFileInfo;
        }
        this.itemHeight = showFileInfo ? ITEM_HEIGHT_INFO : ITEM_HEIGHT;

        this.setRootDir(FileUtils.normalize(this.rootDir));
        if (stub) this.createView(stub);
        if (!this.isTree && appConfig['tree:' + id]) {
            this.toggleTreeView();
        } else if (!noReload) this.reload();
    }

    FileBrowser.prototype.isTree = false;
    FileBrowser.prototype.setRootDir = function (dir) {
        if (this.tree) return this.tree.setRootDir(dir);
        if (dir[dir.length - 1] != SEP) dir = dir + SEP;
        this.rootDir = dir;
        if (this.id) {
            configure('root:' + this.id, dir, 'files');
        }
        if (this.treeParent) this.treeParent.rootDir = dir;
    };
    // Layout Methods
    var ITEM_HEIGHT = 32;
    var ITEM_HEIGHT_INFO = 48;
    FileBrowser.prototype.destroy = function () {
        this.removeEvents();
        if (this.tree) this.tree.destroy();
        this.stub = null;
    };
    FileBrowser.prototype.pageSize = 300;
    FileBrowser.prototype.setShowFileInfo = function (val, force) {
        if (force !== true && this.treeParent)
            return this.treeParent.setShowFileInfo(val, force);
        if (this.showFileInfo != val) {
            if (this.id) configure('info:' + this.id, !!val, 'files');
            this.showFileInfo = val;
            this.fileStats = null;
            this.itemHeight = val ? ITEM_HEIGHT_INFO : ITEM_HEIGHT;
            if (this.tree) {
                //update tree also
                this.tree.setShowFileInfo(val, true);
            } else {
                //remove old views with wrong item height
                this.removeEvents();
                this.createView(this.stub);
                this.reload();
            }
        } else this.showFileInfo = val;
    };
    FileBrowser.prototype.createHeader = function () {
        this.stub.append(
            '<div class="bg-header fileview-header scroll-hide"></div>'
        );
        this.header = this.stub.children().last();
        this.stub.css('padding-top', '50px');
        this.updateHeader();
    };
    var safeGoto = function (browser, path) {
        if (!path.startsWith(browser.fileServer.getRoot())) {
            return false;
        }
        browser.reload(false, null, path);
    };
    function linkify(path) {
        var paths = path.split(SEP);
        var address = '';
        var el = '';
        for (var i = 0; i < paths.length - 2; i++) {
            var name = Utils.htmlEncode(paths[i]);
            address += name + SEP;
            el +=
                "<button class='nav-breadcrumb' href='#' data-target='" +
                address +
                "' >" +
                (name ||
                    "<i class='nav-breadcrumb-icon material-icons'>home</i>") +
                '</button>';
        }
        el +=
            '<span>' +
            (paths[i]
                ? Utils.htmlEncode(paths[i])
                : "<i class='material-icons'>home</i>") +
            '</span>';
        return el;
    }

    function clip(e, self) {
        var rel = FileUtils.relative(self.rootDir, e, false, true) || e;
        return rel;
    }
    FileBrowser.prototype.updateHeader = function () {
        if (this.inFilter) {
            return;
        }
        var self = this;
        if (!this.header) {
            return this.createHeader();
        }
        //Jquery-compat makes sure all event handlers are removed
        this.header.children().remove();
        switch (this.headerMode) {
            case 'filter':
                this.header.append(
                    '<div class="edge_box-1 h-100">\
                <div class="fill_box"><input type="text" name="search_text" id="search_text" value="" /></div>\
                <span id="cancelSearch" class="side-1 material-icons">close</span>\
            </div>'
                );
                var autoFilter = Utils.delay(function (e) {
                    self.filter(e.target.value);
                });
                this.header.find('#search_text').on('input', autoFilter);
                this.header.find('#cancelSearch').click(function () {
                    self.headerMode = null;
                    self.filter('');
                    self.updateHeader();
                });
                break;
            case 'select':
                this.header.append(
                    '<div class="h-100 edge_box-1-1">\
                    <span id="cancelMark" class="side-1 material-icons">arrow_backward</span>\
                    <div class="flow-text fill_box"><span id = "num_marked" >' +
                        (this.$marked || []).length +
                        '  </span> of <span id = "num_total">' +
                        this.names.length +
                        '</span></div>\
                    <span id="selectAll" class="side-2 material-icons">select_all</span>\
                </div>'
                );
                this.header.find('#cancelMark').click(function () {
                    self.exitSelectMode();
                });
                this.header.find('#selectAll').click(function () {
                    self.selectAll();
                });
                break;
            case null:
                this.header.append(
                    '<div id="filedir-select" class="edge_box-2 h-100">' +
                        '<div class="filenav">' +
                        linkify(self.rootDir) +
                        '</div>' +
                        '<button class="material-icons select side-1">' +
                        'history</button>' +
                        "<button class='side-2 create center material-icons'>more_vert</button>" +
                        '</div>'
                );
                var trigger = this.header.find('.select')[0];
                trigger.onclick = function (/*ev*/) {
                    var e;
                    var options = [];
                    for (var i in recentFolders) {
                        e = recentFolders[i];
                        if (e != self.rootDir && options.indexOf(e) < 0)
                            options.push({
                                icon: 'history',
                                caption:
                                    '<span class="inline-clipper">&nbsp;<span class="clipper-text">' +
                                    clip(e, self) +
                                    '</span></span>',
                                value: e,
                                className: 'list-clip',
                            });
                    }
                    var bookmarks = FileUtils.getBookmarks();
                    for (i in bookmarks) {
                        e = bookmarks[i];
                        if (options.indexOf(e) < 0)
                            options.push({
                                icon: 'star',
                                caption:
                                    '<span class="inline-clipper">&nbsp;<span class="clipper-text">' +
                                    e +
                                    '</span></span>',
                                value: e,
                                sortIndex: 200,
                                className: 'list-clip',
                            });
                    }
                    var dropdown = new Dropdown(false, 'responsive-right');
                    dropdown.setData(options);
                    dropdown.show(this);
                    dropdown.onclick = function (ev, id, element, item) {
                        safeGoto(self, item.value);
                        return true;
                    };
                    dropdown.ondismiss = function (/*ev*/) {
                        dropdown.setData(null);
                    };
                };
                this.header.find('.create').click(function (e) {
                    (self.tree || self).showCtxMenu(
                        (self.tree || self).headerDropdown,
                        $(this)[0]
                    );
                    e.stopPropagation();
                });
                //so many different hacks for one thing
                var makeScroll = function () {
                    $(this).removeClass('clipper-text');
                    $(this).addClass('fill_box');
                    this.scrollLeft = this.scrollWidth - this.clientWidth;
                    $(this).off('mouseover', makeScroll);
                    $(this).off('touchstart', makeScroll);
                };
                var nav = this.header.find('.filenav');
                nav.addClass('clipper-text');
                nav.on('mouseover', makeScroll);
                nav.on('touchstart', makeScroll);
                nav.find('.nav-breadcrumb').click(function () {
                    safeGoto(self, this.getAttribute('data-target'));
                });
                break;
            default:
                this.headerMode = null;
                return this.updateHeader();
        }
    };

    FileBrowser.prototype.setLoading = function (started) {
        if (started) {
            if (this.runningTasks++ > 0) return;
            if (!this.loaderEl)
                this.loaderEl = $(
                    '<span style="position:absolute;top:40px;background:none;margin:0" class="p-15 progress"><span class="indeterminate"></span></span>'
                );
            if (this.header) this.header.after(this.loaderEl);
        } else if (--this.runningTasks === 0) {
            this.loaderEl.remove();
        }
    };

    FileBrowser.prototype.updateTopElements = function () {
        this.paddingTop = 0;
        if (this.names.length < this.pageSize) {
            if (this.topElement) {
                this.topElement.addClass('destroyed');
                // this.topElement = null;
            } else {
                this.topElement = this.root
                    .append("<li class='destroyed fileview-footer'></li>")
                    .children()
                    .last();
            }
        } else {
            this.paddingTop = 40;
            if (this.topElement) {
                this.topElement.removeClass('destroyed');
                // this.topElement = null;
            } else {
                this.topElement = this.root
                    .append("<li class='fileview-footer'></li>")
                    .children()
                    .last();
            }
        }
        if (!this.backButton) {
            this.backButton = this.root
                .append(
                    '<li filename=".." class=\'file-item border-inactive back-button \' tabIndex=0><span>' +
                        "<i class = 'green-text material-icons'>reply</i></span>" +
                        "<span class='filename'>" +
                        '..' +
                        '</span>' +
                        '</li>'
                )
                .children()
                .last();
            this.backButton.click(this.onBackPressed());
        }
        this.paddingTop += this.itemHeight;
    };
    FileBrowser.prototype.updateBottomElements = function () {
        this.paddingBottom = 0;
        if (this.names.length === 0) {
            this.bottomElement =
                this.bottomElement ||
                this.root
                    .append("<li class='fileview-footer'></li>")
                    .children()
                    .last();
            this.bottomElement.html(
                '<h6 style="text-align:center">Empty Folder</h6>'
            );
        } else {
            if (this.pageStart === 0 && this.pageEnd == this.names.length) {
                if (this.bottomElement) {
                    this.bottomElement.detach();
                    this.bottomElement = null;
                }
                return;
            }
            this.bottomElement =
                this.bottomElement ||
                this.root
                    .append("<li class='fileview-footer'></li>")
                    .children()
                    .last();
            var txt = [
                '<h6 style="text-align:center">',
                //Go Left
                '<button class="material-icons arrow_button go_left"',
                this.pageStart > 0 ? '' : ' style="visibility:hidden"',
                '>keyboard_arrow_left</button>',
                //Details
                'Page ',
                Math.floor(this.pageStart / this.pageSize) + 1,
                ' of ',
                Math.floor(this.names.length / this.pageSize) + 1,
                //Go Right
                '<button class="material-icons arrow_button go_right"',
                this.pageEnd < this.names.length
                    ? ''
                    : ' style="visibility:hidden"',
                '>keyboard_arrow_right</button>',
                '</h6>',
            ].join('');
            this.bottomElement.html(txt);
            this.topElement.html(txt);
        }
        this.paddingBottom = this.bottomElement.height();
    };
    FileBrowser.prototype.getScrollingParents = function () {
        var a = [];
        var p = $(this.root).add($(this.root).parents());
        for (var i = 0; i < p.length; i++) {
            var overflow = p.eq(i).css('overflowY');
            if (overflow != 'hidden') {
                a.push(p[i]);
            }
        }
        return $(a);
    };
    FileBrowser.prototype.getItemTop = function (index, init, cumul) {
        if (init === undefined) init = -1;
        if (cumul === undefined) cumul = 0;
        if (index < this.pageStart) index += this.pageStart;
        if (init < this.pageStart) {
            cumul += this.paddingTop;
            init = this.pageStart;
        }
        for (var i = init; i < index; i++) {
            if (this.extraSpace[i]) {
                cumul += this.extraSpace[i];
            }
            cumul += this.itemHeight;
        }
        return cumul;
    };
    FileBrowser.prototype.renderView = function (i, view) {
        var filename = this.names[i];
        var color;
        if (
            filename == this.fileNameToSelect ||
            (this.newFiles && this.newFiles.indexOf(filename) > -1)
        )
            color = 'emphasis';
        else color = '';
        var icon = view.find('.type-icon').attr('class', 'type-icon');
        if (filename[filename.length - 1] == SEP) {
            view.attr('filename', filename);
            view.attr(
                'class',
                'folder-item file-item border-inactive ' + color
            );
            view.attr('tabIndex', 0);
            view.find('.filename').html(
                filename.slice(0, filename.length - 1) + ' '
            );
            if (this.nestedViews) {
                if (
                    this.nestedViews[filename] &&
                    !this.nestedViews[filename].isClosed
                )
                    Icons.renderEl(icon, 'folder_open', filename);
                else Icons.renderEl(icon, 'folder_close', filename);
            } else Icons.renderEl(icon, 'folder', filename);
            view.find('.dropdown-btn').attr('data-target', this.folderDropdown);
        } else {
            view.attr('filename', filename);
            view.attr('class', 'file-item border-inactive ' + color);
            view.attr('tabIndex', 0);
            view.find('.filename').html(filename + ' ');
            Icons.renderEl(icon, 'file', filename);
            view.find('.dropdown-btn').attr('data-target', this.fileDropdown);
        }
        if (this.fileStats)
            view.find('.file-info').text(this.fileStats[i] || 'Timed out');
        else view.find('.file-info').text('');
        if (FileUtils.isBinaryFile(filename)) {
            view.addClass('binary-file');
        }
    };
    FileBrowser.prototype.createView = function (stub) {
        stub.empty();
        if (stub && stub != this.stub) {
            console.warn('Changing stubs is not really supported');
            this.stub = stub;
        } else if (stub.hasClass('fileview')) {
            this.root = this.stub;
        } else {
            this.createHeader();
            this.stub.append('<ul class="fileview"></ul>');
            this.root = stub.children().last();
            this.root.html(
                "<h6 class='no-results color-inactive'>runningTasks files...</h6>"
            );
        }
        this.root.toggleClass('fileview-info', this.showFileInfo);
        this.childViews = [];
        this.backButton = this.topElement = this.bottomElement = null;
        //not used by filebrowser
        //at all except to compute
        //item tops
        this.extraSpace = {};
        this.pageStart = 0;
        this.pageEnd = -1;
        this.attachEvents();
    };
    FileBrowser.prototype.getOrCreateView = function (i) {
        /*i is a visual index
        /*use pageStart+i to get real position
        /*absolute elements are allowed
        if so, either use getItemTop or update
        extraSpace as needed*/
        if (this.childViews[i]) {
            return this.childViews[i];
        } else {
            this.childViews[i] = this.root
                .append(this.viewTemplate)
                .children()
                .last();
            return this.childViews[i];
        }
    };
    FileBrowser.prototype.viewTemplate =
        "<li class=\"file-item border-inactive\"><span><i class = 'type-icon'>folder</i></span><span class='filename'>" +
        '</span><span class="dropdown-btn right" data-target="">' +
        '<i class="material-icons" >more_vert</i>' +
        "</span><span class= 'color-inactive file-info'></span></li>";
    FileBrowser.prototype.updateVisibleItems = function (force) {
        //force implies pagestart changed
        //or pageSize{see getItemTop,update(Bottom|Top)Elements and attachEvents}
        //or new hierarchy
        //false values are hardly ever needed
        if (this.pageStart % this.pageSize) {
            this.pageStart = Math.floor(this.pageStart / this.pageSize);
        }
        var end = Math.min(this.names.length - this.pageStart, this.pageSize);
        var childViews = this.childViews;
        if (force) {
            //must remove any widgets;
            if (this.inlineDialog) this.closeInlineDialog();
            for (var i = Math.min(this.pageEnd, this.pageSize); i > 0; ) {
                childViews[--i].addClass('destroyed');
            }
        }
        for (var j = 0; j < end; j++) {
            this.renderView(this.pageStart + j, this.getOrCreateView(j));
        }
        this.pageEnd = this.pageStart + end;
    };
    FileBrowser.prototype.updateView = function (names, highlightNewFiles) {
        if (this.tree) return this.tree.updateView(names, highlightNewFiles);
        this.root.find('.no-results').remove();

        if (this.inSelectMode) this.exitSelectMode();
        if (!appConfig.showHiddenFiles) {
            names = names.filter(function (i) {
                return !i.startsWith('.');
            });
        }
        if (!names) throw new Error('Null names');
        names = sort(names, sort_mode);
        if (this.names && highlightNewFiles) {
            this.newFiles = names.filter(Utils.notIn(this.names));
        } else this.newFiles = null;
        this.names = names;
        this.updateHeader();
        if (!this.fileNameToSelect && this.newFiles) {
            this.fileNameToSelect = this.newFiles[0];
        }
        if (this.fileNameToSelect) {
            this.pageStart = 0;
            this.scrollItemIntoView(this.fileNameToSelect, false);
        } else if (this.preStart) {
            this.pageStart = this.preStart;
            this.preStart = 0;
        } else {
            this.pageStart = 0;
            this.root[0].scrollTop = 0;
        }
        this.updateTopElements();
        this.updateVisibleItems(true);
        this.updateBottomElements();
        //Add fileitem getcurrentElement
        this.fileNameToSelect = null;
    };
    FileBrowser.prototype.showItemAndGetTop = function (filename, updatePage) {
        var self = this;
        var i = this.names.indexOf(filename);
        if (i < 0 && !FileUtils.isDirectory(filename)) {
            filename += SEP;
            i = this.names.indexOf(filename);
        }
        if (i < 0) return false;
        var pageStart = Math.floor(i / this.pageSize) * this.pageSize;
        if (pageStart != this.pageStart && updatePage) {
            self.pageStart = pageStart;
            self.updateVisibleItems(true);
            self.updateBottomElements();
        } else self.pageStart = pageStart;
        return this.getItemTop(i);
    };
    FileBrowser.prototype.scrollItemIntoView = function (filename, updatePage) {
        var top = this.showItemAndGetTop(filename, updatePage);
        if (top === false) return 'Not child';
        if (this.scroller) {
            var el = this.scroller[this.scroller.length - 1];
            var offset = 0;
            var root = this.root[0];
            while (root != el) {
                offset += root.offsetTop;
                root = root.parentElement;
            }
            var y = top + offset;
            if (
                y < el.scrollTop + 50 ||
                y > el.scrollTop + el.clientHeight - 50
            ) {
                el.scrollTop = y - el.clientHeight / 2;
            }
        }
    };
    FileBrowser.prototype.getElement = function (name) {
        return this.root
            .children('.file-item')
            .filter('[filename="' + name + '"]');
    };
    FileBrowser.prototype.filter = function (text) {
        var names = this.names.original || this.names;
        var filtered = names.filter(function (i) {
            if (i.toLowerCase().indexOf(text.toLowerCase()) > -1) {
                return true;
            }
            return false;
        });
        filtered.original = names;
        this.selected = null;
        this.inFilter = true;
        this.updateView(filtered);
        this.inFilter = false;
    };

    FileBrowser.prototype.goto = function (path, cb, asFolder) {
        if (this.tree) return this.tree.goto(path, cb, asFolder);
        if (!path) return;
        var segments = normalize(path + (asFolder ? SEP : ''));
        if (segments.startsWith(this.fileServer.getRoot())) {
            if (segments.endsWith(SEP)) {
                this.reload(false, cb, segments);
            } else {
                segments = segments.split(SEP);
                var folder = segments.slice(0, -1).join(SEP) + SEP;
                this.fileNameToSelect = segments[segments.length - 1];
                this.reload(false, cb, folder);
            }
            return true;
        }
        return false;
    };
    // Event Handlers
    FileBrowser.prototype.moveTo = FileBrowser.prototype.shiftTo = function (
        newEl,
        oldEl
    ) {
        $(oldEl).removeClass('item-selected');
        $(newEl).addClass('item-selected');
    };
    FileBrowser.prototype.attachEvents = function () {
        var self = this;
        //this.updateClickListeners
        this.root.on(
            'click.filebrowser',
            '.folder-item .dropdown-btn',
            function (e) {
                if (!self.menu) {
                    self.showCtxMenu(self.folderDropdown, this.parentElement);
                }
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        );
        this.root.on(
            'click.filebrowser',
            '.file-item:not(.folder-item) .dropdown-btn',
            function (e) {
                if (!self.menu) {
                    self.showCtxMenu(self.fileDropdown, this.parentElement);
                }
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        );

        this.root.on(
            'click.filebrowser',
            '.folder-item',
            this.onFolderClicked()
        );
        this.root.on(
            'click.filebrowser',
            '.file-item:not(.folder-item):not(.back-button)',
            this.onFileClicked()
        );
        /*this.root.longTap({
            onRelease: function(e) {
                var t = $(e.target);
                if (!t.hasClass("file-item"))
                    t = t.closest(".file-item");
                if (t.hasClass("folder-item")) {
                    self.showCtxMenu(self.folderDropdown, t[0]);
                }
                else if (t.length && !t.hasClass("back-button")) {
                    self.showCtxMenu(self.fileDropdown, t[0]);
                }
            }
        });*/
        this.root.on('contextmenu.filebrowser', function (e) {
            var t = $(e.target);
            if (!t.hasClass('file-item')) t = t.closest('.file-item');
            if (appConfig.markFileOnHold && !self.inSelectMode) {
                self.enterSelectMode(t.attr('filename'));
            } else if (t.hasClass('folder-item')) {
                self.showCtxMenu(self.folderDropdown, t[0]);
            } else if (t.length && !t.hasClass('back-button')) {
                self.showCtxMenu(self.fileDropdown, t[0]);
            }
            e.stopPropagation();
            e.preventDefault();
        });
        this.root.on('click.filebrowser', '.go_right', function () {
            self.pageStart += self.pageSize;
            self.updateVisibleItems(true);
            self.updateBottomElements();
            self.root[0].scrollTop = 0;
        });
        this.root.on('click.filebrowser', '.go_left', function () {
            self.pageStart -= self.pageSize;
            self.updateVisibleItems(true);
            self.updateBottomElements();
            self.root[0].scrollTop = self.getItemTop(self.pageEnd);
        });
        var scroller = this.getScrollingParents();
        if (scroller) {
            this.scroller = scroller;
            this.scroller.on('scroll.filebrowser', function (e) {
                self.handleScroll(this, e);
            });
        }
    };
    FileBrowser.prototype.removeEvents = function () {
        this.root.off('.filebrowser');
        //this.root.off(".longtap");
        this.scroller && this.scroller.off('.filebrowser');
    };
    FileBrowser.prototype.handleScroll = function (scrollElement /*, ev*/) {
        //Already handled in longtap
        if (this.menu) this.menu.hide();
        if (scrollElement == this.root[0]) {
            this.header &&
                this.header.toggleClass(
                    'scroll-hide',
                    scrollElement.scrollTop == 0
                );
        }
        /*var t = this.root.data('timeout.longtap');
        if (t) {
            clearTimeout(t);
        }*/
    };
    FileBrowser.prototype.onBackPressed = function () {
        var self = this;
        var e = function () {
            var p = self.parentDir();
            self.reload(false, null, p);
        };
        return e;
    };
    FileBrowser.prototype.onFolderClicked = function () {
        var self = this;
        var e = function (f) {
            if (f.which == 1) {
                f.stopPropagation();
                var file = this.getAttribute('filename');
                if (self.inSelectMode) {
                    return self.toggleMark(file);
                } else self.openFolder(file);
            }
        };
        return e;
    };
    FileBrowser.prototype.onFileClicked = function () {
        var self = this;
        return function (e) {
            if (e.which == 1) {
                e.stopPropagation();
                var filename = this.getAttribute('filename');
                if (self.inSelectMode) {
                    return self.toggleMark(filename);
                }
                self.openFile(filename);
            }
        };
    };
    FileBrowser.prototype.openFolder = function (file) {
        if (this.names.indexOf(file) > -1)
            this.reload(null, null, this.childFilePath(file));
    };
    FileBrowser.prototype.openFile = function (filename, forceNew, cb) {
        var self = this;
        FileUtils.addToRecents(self.rootDir);
        var path = self.childFilePath(filename);
        var ev = self.emitter.trigger('pick-file', {
            fileview: self,
            filename: filename,
            filepath: path,
            rootDir: self.rootDir,
            fs: self.fileServer,
            id: 'pick-file',
        });
        if (ev.defaultPrevented) return;
        var b = !forceNew && Docs.forPath(path, self.fileServer);
        if (b) {
            setTab(b.id);
        } else {
            FileUtils.openDoc(path, self.fileServer, cb);
        }
    };

    FileBrowser.prototype.showInlineDialog = function (
        el,
        callback,
        status,
        val
    ) {
        var self = this;
        if (el && !val) {
            val = el.attr('filename').replace(SEP, '');
        }
        var text =
            '<div class="renameField">' +
            '<div class="edge_box-2 h-30" >' +
            '<input class="fill_box" id="new_file_name" value="' +
            (val || '') +
            '"type="text" class="validate">' +
            '<span id="submitBtn" class="side-1"><i class="material-icons">done</i></span>' +
            '<span id="cancelBtn" class="side-2"><i class="material-icons">cancel</i></span>' +
            '</div>' +
            '<span id="error-text"></span>' +
            '</div>';
        this.closeInlineDialog();
        el = el || this.backButton;
        if (el) {
            el.after(text);
            el.addClass('destroyed');
            self.inlineDialog = el.next();
            self.inlineDialogStub = el;
        } else {
            el = self.root.prepend(text);
            self.inlineDialog = el.children().first();
            self.inlineDialogStub = null;
        }
        var e = self.inlineDialog;
        if (status) e.find('#error-text').html(status);
        e.find('#new_file_name').on('input', function (e) {
            if (e.keyCode == 13) e.find('#submitBtn').click();
        });
        e.find('#submitBtn').click(function () {
            var res = callback(e.find('#new_file_name').val());
            if (res) {
                e.find('#error-text').html(res);
            } else self.closeInlineDialog();
        });
        e.find('#cancelBtn').click(function () {
            var res = callback(undefined, true);
            if (res) {
                e.find('#error-text').html(res);
            } else self.closeInlineDialog();
        });
        e.find('input').focus();
        if (val) {
            e.find('input')[0].selectionStart = 0;
            e.find('input')[0].selectionEnd = val.length;
        }
        //var t = self.names.indexOf(el.attr('filename'));
        //this.extraSpace[t] = 18;
        if (Fileviews.activeFileBrowser == self) self.menu.hide();
    };
    FileBrowser.prototype.closeInlineDialog = function () {
        if (this.inlineDialogStub)
            this.inlineDialogStub.removeClass('destroyed');
        if (this.inlineDialog) this.inlineDialog.remove();
        this.inlineDialog = this.inlineDialogStub = null;
    };

    FileBrowser.prototype.newFile = function (name, callback) {
        if (this.tree) return this.tree.newFile(name, callback);
        var stub = this;
        var c = function (name, cancel) {
            if (cancel) {
                return;
            }
            var a = stub.validateNewFileName(name);
            if (a) return a;
            var filepath = stub.childFilePath(name);
            var ev = stub.emitter.trigger('create-file', {
                fileview: stub,
                filename: name,
                filepath: filepath,
                fs: stub.fileServer,
                rootDir: stub.rootDir,
                id: 'create-file',
            });
            if (!ev.defaultPrevented)
                stub.fileServer.writeFile(filepath, '', function (/*err*/) {
                    stub.fileNameToSelect = name;
                    stub.reload(true, callback);
                });
        };
        stub.showInlineDialog(null, c, null, name || '');
        var dialog = stub.inlineDialog;
        appEvents.once('sidenavClosed', function () {
            if (stub.inlineDialog == dialog) {
                stub.closeInlineDialog();
            }
        });
    };
    FileBrowser.prototype.rename = function (former, b) {
        var path = this.childFilePath(former);
        var dest = this.childFilePath(b, false);
        if (FileUtils.isDirectory(former)) dest += SEP;
        if (dest == path) return;
        var self = this;
        var error = self.validateNewFileName(b);
        if (error) return error;
        this.fileServer.rename(path, dest, function (err) {
            if (!err) {
                self.fileNameToSelect = b;
                self.reload(true);
                Docs.rename(path, dest, self.fileServer);
            } else Notify.error('Rename failed');
        });
    };
    /*Added ctx argument in case rootDir/names changes*/
    FileBrowser.prototype.childFilePath = function (name, check, ctx) {
        ctx = ctx && ctx.names ? ctx : this;
        if (check && ctx.names.indexOf(name) < 0) throw 'Err: Not Child';
        return ctx.rootDir + name;
    };
    FileBrowser.prototype.validateNewFileName = function (name, ctx) {
        ctx = ctx && ctx.names ? ctx : this;
        var b = name;
        if (!name) return 'Name cannot be empty';
        if (ctx.names.indexOf(b) > -1 || ctx.names.indexOf(b + SEP) > -1)
            return 'File Already Exists';
        var path = this.childFilePath(name, false, ctx);
        if (Docs.forPath(path, ctx.fileServer)) {
            setTab(Docs.forPath(path, ctx.fileServer).id);
            return 'File Currently Open';
        }
    };
    FileBrowser.prototype.filename = function (e, notChild, ctx) {
        ctx = ctx && ctx.names ? ctx : this;
        //return the filename of a path
        //to get path from filename use
        //getChildPath
        if (!(notChild || e.startsWith(ctx.rootDir))) {
            throw 'Error: asked for filename for non child';
        }
        var isFolder = false;
        if (FileUtils.isDirectory(e)) isFolder = true;
        while (e.endsWith(SEP)) e = e.slice(0, e.length - 1);
        var name =
            e.substring(e.lastIndexOf(SEP) + 1, e.length) +
            (isFolder ? SEP : '');
        if (!notChild && ctx.names.indexOf(name) < 0) throw 'Error not child';
        return name;
    };
    FileBrowser.prototype.parentDir = function () {
        var e = this.rootDir;
        if (
            e == this.fileServer.getRoot() ||
            !e.startsWith(this.fileServer.getRoot())
        )
            return this.fileServer.getRoot();
        var a = FileUtils.dirname(this.rootDir);
        return a == SEP ? a : a ? a + SEP : this.rootDir;
    };

    FileBrowser.prototype.reload = function (
        highlightNewFiles,
        callback,
        rootDir
    ) {
        if (this.tree) {
            this.tree.fileNameToSelect = this.fileNameToSelect;
            return this.tree.reload(highlightNewFiles, callback, rootDir);
        }
        var self = this;
        this.setLoading(true);
        function done(err, res) {
            self.setLoading(false);
            if (!err) {
                if (rootDir) self.setRootDir(rootDir);
                self.updateView(res, highlightNewFiles);
            } else self.root.find('.no-results').text('Error loading files');
            if (callback) callback(err);
        }
        self.fileStats = null;
        var root = rootDir || this.rootDir;
        if (!this.showFileInfo) return this.fileServer.getFiles(root, done);
        var fs = this.fileServer;
        fs.readdir(root, function (e, r) {
            if (e) return done(e);
            var timedOut = new StopSignal();
            setTimeout(
                timedOut.control(function () {
                    timedOut.stop();
                }),
                2000
            );
            var stats = [];
            Utils.asyncForEach(
                r,
                function (e, i, next, cancel) {
                    next = timedOut.control(next, cancel);
                    fs.lstat(root + e, function (err, stat) {
                        if (err) {
                            stats[i] = '(Error getting info)';
                        } else {
                            if (stat.isDirectory()) {
                                r[i] += '/';
                                stats[i] = toDate(stat.mtime || stat.mtimeMs);
                            } else
                                stats[i] =
                                    toDate(stat.mtime || stat.mtimeMs) +
                                    '  ' +
                                    Utils.toSize(stat.size);
                        }
                        next();
                    });
                },
                function (cancelled) {
                    if (self.showFileInfo) self.fileStats = stats;
                    if (cancelled) {
                        fs.getFiles(root, done);
                    } else {
                        done(e, r);
                        timedOut.clear();
                    }
                },
                STAT_BATCH_SIZE,
                false,
                true
            );
        });
    };

    //Selection
    FileBrowser.prototype.enterSelectMode = function (filename) {
        if (!this.$marked) this.$marked = [];
        this.inSelectMode = true;
        if (filename) {
            this.mark(filename);
        }
        if (this.headerMode && this.headerMode != 'select') {
            this.prevHeaderMode = this.headerMode;
        }
        this.headerMode = 'select';
        this.updateHeader();
    };
    FileBrowser.prototype.selectAll = function () {
        this.names.slice(this.pageStart, this.pageEnd).forEach(function (name) {
            this.mark(name);
        }, this);
    };
    FileBrowser.prototype.exitSelectMode = function () {
        if (!this.$marked) return;
        this.inSelectMode = false;
        for (var i = this.$marked.length; i >= 0; i--) {
            this.unmark(this.$marked[i]);
        }
        this.$marked = [];
        if (this.prevHeaderMode) {
            this.headerMode = this.prevHeaderMode;
            this.prevHeaderMode = null;
        } else this.headerMode = null;
        this.updateHeader();
    };
    FileBrowser.prototype.mark = function (filename) {
        if (!this.inSelectMode) this.enterSelectMode();
        if (
            this.names.indexOf(filename) > -1 &&
            this.$marked.indexOf(filename) < 0
        ) {
            this.getElement(filename).addClass('file-item-marked');
            this.$marked.push(filename);
            this.updateHeader();
        }
    };
    FileBrowser.prototype.toggleMark = function (name) {
        if (this.getElement(name).hasClass('file-item-marked')) {
            this.unmark(name);
        } else this.mark(name);
    };
    FileBrowser.prototype.unmark = function (filename) {
        if (!this.$marked) return;
        if (
            this.names.indexOf(filename) > -1 &&
            Utils.removeFrom(this.$marked, filename) > -1
        ) {
            this.getElement(filename).removeClass('file-item-marked');
        }
        if (this.inSelectMode && this.$marked.length < 1) {
            this.exitSelectMode();
        }
    };

    FileBrowser.prototype.createTreeView = function () {
        var stub = this;
        stub.tree = new NestedBrowser(
            stub.root,
            stub.rootDir,
            stub.fileServer,
            true
        );
    };
    /**
     * WARNING: Most of the methods of FileBrowser do not check if a treeview is enabled(and sometimes it is not even clear what to do in such a case).
     * Since treeview works by nesting a new browser, this means the safest way to call such methods is actually
       ``` (stub.tree || stub).method ```
       This is unneeded if you are executing an action since onCtxMenuClick does this automatically.
     */
    FileBrowser.prototype.toggleTreeView = function () {
        if (this.treeParent) return this.treeParent.toggleTreeView();
        var stub = this;
        if (stub.tree) {
            configure('tree:' + this.id, false, 'files');
            stub.tree.destroy();
            stub.tree = null;
            stub.createView(stub.stub);
            stub.reload();
        } else {
            configure('tree:' + this.id, true, 'files');
            stub.removeEvents();
            stub.createTreeView();
            stub.tree.id = this.id;
            stub.tree.header = stub.header;
            stub.tree.preStart = stub.pageStart;
            stub.tree.treeParent = this;
            if (stub.tree.showFileInfo != stub.showFileInfo) {
                stub.tree.setShowFileInfo(stub.showFileInfo, true);
            } else stub.reload();
        }
    };

    FileBrowser.prototype.clipboard = {
        /**
         * @type {{files?:string[],server:any;path?:string,host?:FileBrowser}|null} copiedPath
         **/
        data: null,
        //0 ->copy
        //1 ->move
        mode: 0,
    };
    FileBrowser.prototype.onCtxMenuClick = function (
        id,
        filename,
        el,
        item,
        anchor
    ) {
        if (this.tree)
            return this.tree.onCtxMenuClick(id, filename, el, item, anchor);
        var stub = this;
        filename = filename || '';
        var rootDir = stub.rootDir;
        var filepath = filename ? stub.childFilePath(filename) : rootDir;
        var event = this.emitter.trigger(id, {
            fileview: stub,
            filename: filename,
            filepath: filepath,
            fs: stub.fileServer,
            rootDir: rootDir,
            id: id,
            anchor: anchor,
            marked: stub.inSelectMode
                ? stub.$marked.map(stub.childFilePath, stub)
                : undefined,
        });
        if (event.defaultPrevented) return;
        var i,
            name,
            server = stub.fileServer,
            isFolder;
        switch (id) {
            case 'open-item':
                var clearPlaceholder = function (e, doc) {
                    if (doc && doc.$removeAutoClose) {
                        doc.$removeAutoClose();
                    }
                };
                clearPlaceholder(
                    null,
                    require('grace/setup/setup_editors').getActiveDoc()
                );
                if (!stub.inSelectMode) {
                    stub.openFile(filename, true, clearPlaceholder);
                    break;
                } else {
                    isFolder = FileUtils.isDirectory;
                    for (i in stub.$marked) {
                        name = stub.$marked[i];
                        if (!isFolder(name)) {
                            //why open multiple folders
                            stub.openFile(name, false, clearPlaceholder);
                        }
                    }
                }
                break;
            case 'open-folder':
                if (!stub.inSelectMode || !stub.isTree) {
                    stub.openFolder(filename);
                    break;
                } else {
                    isFolder = FileUtils.isDirectory;
                    for (i in stub.$marked) {
                        name = stub.$marked[i];
                        if (isFolder(name)) {
                            //why open multiple folders
                            stub.openFolder(name);
                        }
                    }
                }
                break;
            case 'open-project':
                //must update hierarchy to persist folder
                FileUtils.openProject(filepath || rootDir, server);
                SideViewTabs.setActive('hierarchy_tab', true);
                break;
            case 'new-item':
                name = 'newfile';
                i = 0;
                while (stub.names.indexOf(name) > -1) {
                    name = 'newfile(' + i++ + ')';
                }
                stub.newFile(name);
                break;
            case 'add-bookmark':
                var bookmarks = FileUtils.getBookmarks();
                if (bookmarks.indexOf(filepath || rootDir) < 0) {
                    FileUtils.setBookmarks(
                        bookmarks.concat(filepath || rootDir)
                    );
                }
                break;
            case 'remove-bookmark':
                var bookmarks2 = FileUtils.getBookmarks();
                if (bookmarks2.indexOf(filepath || rootDir) > -1) {
                    FileUtils.setBookmarks(
                        Utils.replace(bookmarks2, filepath || rootDir)
                    );
                }
                break;
            case 'reload-browser':
                stub.reload(true);
                break;
            case 'open-tree':
                this.toggleTreeView();
                break;
            case 'show-info':
                var one = Utils.createCounter(function () {
                    Notify.modal({
                        header: els.length > 1 ? rootDir : filepath,
                        body:
                            els.length > 1
                                ? els.join('</br>') +
                                  '</br>' +
                                  table({
                                      'Total Size': Utils.toSize(total),
                                  })
                                : els[0],
                        dismissible: true,
                    });
                });
                var els = [];
                var paths;
                if (stub.inSelectMode) {
                    paths = stub.$marked.map(stub.childFilePath.bind(stub));
                } else paths = [filepath];
                var total = 0;
                paths.forEach(function (p, i) {
                    one.increment();
                    server.stat(p, function (err, stat) {
                        if (!err) {
                            var size = stat.size;
                            var date = toDate(stat.mtime || stat.mtimeMs);
                            total += size || 0;
                            els.push(
                                table({
                                    Name: stub.inSelectMode
                                        ? stub.$marked[i]
                                        : filename,
                                    'Byte Length': size,
                                    Size: Utils.toSize(size),
                                    'Last Modified': date,
                                })
                            );
                        }
                        one.decrement();
                    });
                });
                break;
            case 'rename-file':
            case 'rename-folder':
                el = stub.getElement(filename);
                stub.showInlineDialog(
                    el,
                    function (val, cancel) {
                        if (cancel) return false;
                        else {
                            var t = stub.rename(filename, val);
                            return t;
                        }
                    },
                    'Enter new name'
                );
                break;
            case 'new-browser':
                Fileviews.newBrowser();
                break;
            case 'new-tab':
                Fileviews.initBrowser({
                    rootDir: filepath || rootDir,
                    server: server,
                });
                break;
            case 'copy-file':
            case 'cut-file':
                if (id == 'copy-file') stub.clipboard.mode = 0;
                else stub.clipboard.mode = 1;
                if (stub.inSelectMode && stub.$marked.length > 0) {
                    var files = [];
                    for (var j in stub.$marked) {
                        files.push(stub.childFilePath(stub.$marked[j]));
                    }
                    stub.clipboard.data = {
                        files: files,
                        server: server,
                    };
                    if (files[0] == filepath) {
                        stub.clipboard.data.path = filepath;
                    }
                } else {
                    stub.clipboard.data = {
                        path: filepath,
                        server: server,
                    };
                }
                if (stub.clipboard.mode) {
                    stub.clipboard.data.host = stub;
                }
                break;
            case 'filter-files':
                stub.headerMode = 'filter';
                stub.updateHeader();
                stub.header.find('#search_text').focus();
                break;
            case 'paste-file':
                if (!stub.clipboard.data) return;
                var oldCopy = stub.clipboard.data;
                var method = stub.clipboard.mode === 0 ? 'copy' : 'move';
                var modal = $(
                    Notify.modal({
                        header: stub.clipboard.mode
                            ? 'Moving files....'
                            : 'Copying files....',
                        body:
                            "<h6 id='progress-header'></h6><div class='progress'><span class='indeterminate'></span></div>",
                        footers: ['Cancel', 'Hide'],
                        dismissible: true,
                    })
                );
                var ctx = {
                    names: stub.names,
                    rootDir: stub.rootDir,
                    fileServer: stub.fileServer,
                };
                var progress = modal.find('#progress-header');
                var task = new StopSignal();
                modal.find('.modal-cancel').click(task.stop);
                var srcServer = stub.clipboard.data.server;
                var doPaste = function (path, next, onFail) {
                    var name = stub.filename(path, true, ctx);
                    var error = stub.validateNewFileName(name, ctx);
                    if (error) {
                        onFail(error, name);
                        return;
                    }
                    var newpath = stub.childFilePath(name, false, ctx);
                    var type = FileUtils.isDirectory(path) ? 'Folder' : 'File';
                    progress.text(path);
                    var stop = FileUtils[method + type](
                        path,
                        newpath,
                        srcServer,
                        server,
                        function (err) {
                            task.unsubscribe(stop);
                            if (!err) {
                                if (method == 'move') {
                                    if (srcServer == server) {
                                        Docs.rename(path, newpath, srcServer);
                                    } else Docs.delete(path, srcServer);
                                }
                                next(name);
                            } else {
                                console.error(err);
                                onFail('Failed to ' + method, name);
                            }
                        },
                        null, //no conflict resolution
                        function (path, e) {
                            //onEach
                            if (e)
                                progress.html(
                                    '<span class="error-text"> Failed to ' +
                                        method +
                                        ' ' +
                                        path +
                                        '</span>'
                                );
                            else progress.text(path);
                            //
                        }
                    );
                    task.subscribe(stop);
                };
                var onFinished = function () {
                    task.clear();
                    stub.reload(true);
                    modal.modal('close');
                    if (method == 'move') {
                        if (oldCopy == stub.clipboard.data) {
                            if (stub.clipboard.data.host != stub)
                                stub.clipboard.data.host.reload();
                            stub.clipboard.data = null;
                        }
                    }
                };
                if (!stub.clipboard.data.files) {
                    doPaste(
                        stub.clipboard.data.path,
                        function (name) {
                            Notify.info('Pasted ' + name);
                            onFinished();
                        },
                        function (error, name) {
                            Notify.error(error + ' ' + name);
                            onFinished();
                        }
                    );
                } else {
                    var filesToCopy = [].concat(stub.clipboard.data.files);
                    var numCopied = filesToCopy.length;
                    var MAX_SIMULTANEOUS_COPY = 5;
                    Utils.asyncForEach(
                        filesToCopy,
                        function (file, i, next, cancel) {
                            next = task.control(next, cancel);
                            doPaste(file, next, function (err, name) {
                                //onFail
                                Notify.ask(
                                    err + ' ' + name + ', continue?',
                                    function () {
                                        numCopied--;
                                        next();
                                    },
                                    cancel
                                );
                            });
                        },
                        function (cancelled) {
                            if (!cancelled)
                                Notify.info(
                                    'Pasted ' + (numCopied || 0) + ' files'
                                );
                            else if (numCopied > 0)
                                Notify.warn('Pasted ' + numCopied + ' files');
                            onFinished();
                        },
                        MAX_SIMULTANEOUS_COPY,
                        false,
                        true
                    );
                }
                break;
            case 'delete-browser':
                Fileviews.deleteBrowser(
                    stub.isTree ? stub.treeParent.id : stub.id
                );
                break;
            case 'close-project':
                FileUtils.openProject(
                    FileUtils.NO_PROJECT,
                    FileUtils.getFileServer()
                );
                break;
            case 'delete-file':
            case 'delete-folder':
                var message, toDelete;
                var doDelete = function () {
                    if (toDelete.length > 0) {
                        var path = stub.childFilePath(toDelete.pop());
                        Docs.delete(path, server);
                        server.delete(path, doDelete);
                    } else stub.reload();
                };
                var ask = function (c) {
                    if (c) {
                        Notify.prompt(
                            message + '\nEnter ' + code + ' to continue',
                            function (ans) {
                                if (ans != code) return false;
                                doDelete();
                            }
                        );
                    } else {
                        Notify.ask(message, doDelete);
                    }
                };
                if (!stub.inSelectMode) {
                    toDelete = [filename];
                    message = 'Delete ' + filename + '?';
                } else {
                    toDelete = stub.$marked.slice(0);
                    message =
                        'Delete ' +
                        stub.$marked.length +
                        ' files.\n' +
                        stub.$marked.join('\n');
                }
                var code = '' + Math.floor(Math.random() * 999999);
                if (appConfig.askBeforeDelete) {
                    var test = FileUtils.globToRegex(appConfig.askBeforeDelete);
                    if (
                        toDelete
                            .map(stub.childFilePath, stub) //fullpath match
                            .concat(toDelete) //base name match
                            .some(test.test, test)
                    ) {
                        return ask(true);
                    }
                }
                if (appConfig.askBeforeDeleteNonEmptyFolders) {
                    var folders = toDelete.filter(FileUtils.isDirectory);
                    if (folders.length) {
                        return Utils.asyncForEach(
                            folders,
                            function (name, i, next, cancel) {
                                server.readdir(
                                    stub.childFilePath(name),
                                    function (e, res) {
                                        if (e || (res && res.length > 0))
                                            cancel(e);
                                        else next();
                                    }
                                );
                            },
                            ask,
                            4,
                            false,
                            true
                        );
                    }
                }
                Notify.ask(message, doDelete);
                break;
            case 'mark-file':
                stub.enterSelectMode(filename);
                break;
            case 'new-folder':
                Notify.prompt('Enter folder name', function (name) {
                    if (name) {
                        server.mkdir(rootDir + name, function () {
                            stub.reload(true);
                        });
                    }
                });
                break;
            case 'show-current-doc':
                var doc = require('grace/setup/setup_editors').getActiveDoc();
                if (doc) {
                    stub.goto(doc.getSavePath());
                }
                break;
            case 'toggle-info':
                stub.setShowFileInfo(!stub.showFileInfo);
                break;
            case 'select-all':
                this.enterSelectMode();
                this.selectAll();
                break;
            case 'fold-opts':
            case 'view-opts':
                break;
            case 'fold-all':
                if (filename && FileUtils.isDirectory(filename)) {
                    if (stub.nestedViews[filename]) {
                        //stub.foldFolder(filename);
                        stub.nestedViews[filename].foldAll();
                    }
                } else stub.foldAll();
                break;
            case 'fold-parent':
                if (filename) {
                    stub.getParent().foldFolder(
                        stub.getParent().filename(rootDir)
                    );
                    stub.getParent().scrollItemIntoView(
                        stub.getParent().filename(rootDir)
                    );
                }
                break;
            case 'expand-all':
                if (filename && FileUtils.isDirectory(filename)) {
                    stub.expandFolder(filename, function () {
                        stub.nestedViews[filename].expandAll(null, 2);
                    });
                } else stub.expandAll(null, 2);
                break;
            default:
                unimplemented();
        }
    };
    FileBrowser.prototype.onDismissCtxMenu = Utils.noop;
    FileBrowser.prototype.overflows = {};
    FileBrowser.prototype.showCtxMenu = function (menu, el) {
        if (!this.menuItems[menu]) return;
        var name = $(el).attr('filename');
        if (Fileviews.activeFileBrowser) {
            Fileviews.activeFileBrowser.menu.hide();
        }
        var dropdown = this.overflows[menu];
        if (!dropdown) {
            dropdown = new Dropdown();
            this.overflows[menu] = dropdown;
            dropdown.setData(this.menuItems[menu]);
            dropdown.onclick = function (e, id, link, item, anchor) {
                var stub = Fileviews.activeFileBrowser;
                if (stub.menuItems[menu]) {
                    stub.onCtxMenuClick(id, stub.selected, link, item, anchor);
                    return true;
                }
            };
            dropdown.ondismiss = function () {
                var stub = Fileviews.activeFileBrowser;
                stub.onDismissCtxMenu();
                Fileviews.activeFileBrowser = stub.menu = null;
            };
        }
        Fileviews.activeFileBrowser = this;
        this.menu = dropdown;
        this.selected = name;
        dropdown.show(el);
    };
    FileBrowser.prototype.menuItems = require('./file_menus').fileMenus;
    FileBrowser.prototype.folderDropdown = 'folder-dropdown';
    FileBrowser.prototype.fileDropdown = 'file-dropdown';
    FileBrowser.prototype.headerDropdown = 'header-dropdown';
    var toggle = function (self, update) {
        var filename = Fileviews.activeFileBrowser.selected || '';
        var extension = FileUtils.extname(filename);
        for (var i in self.toggleProps) {
            var data = self.toggleProps[i];
            var enabled =
                (filename && data.filename == filename) ||
                (extension && data.extension == extension);
            update(data.id, enabled ? data : null);
        }
    };

    function createToggle(menu, value) {
        var update = menu['!update'];
        if (!menu.toggleProps) {
            if (update) update.push(toggle);
            Utils.defProp(menu, '!update', update || [].concat(toggle));
            Utils.defProp(menu, 'toggleProps', {});
        }
        menu.toggleProps[value.id] = value;
    }
    var preventDefault = function (ev) {
        ev.preventDefault();
    };

    function addToMenu(menu, id, caption, emitter) {
        if (caption.extension || caption.filename) {
            caption.id = id;
            createToggle(menu, caption);
        } else menu[id] = caption;
        if (caption.handle) emitter.on(id, caption.handle);
        if (caption.subTree) {
            if (!caption.handle) emitter.on(id, preventDefault);
            for (var i in caption.subTree) {
                addToMenu(caption.subTree, i, caption.subTree[i], emitter);
            }
        }
    }
    //Note: This method is called on FileBrowser.prototype
    FileBrowser.prototype.onNewOption = function (types, id, caption, func) {
        var prop = this;
        if (Fileviews.activeFileBrowser) {
            Fileviews.activeFileBrowser.menu.hide();
        }
        for (var i in types) {
            var menuId = prop[types[i] + 'Dropdown'];
            addToMenu(prop.menuItems[menuId], id, caption, this.emitter);
        }
        if (func) this.emitter.on(id, func);
    };
    FileBrowser.prototype.emitter = Fileviews;

    //A nested filebrowser aka TreeView
    /** @constructor */
    function NestedBrowser(id, rootDir, fileServer, noReload) {
        this.nestedViews = {};
        this.isClosed = false;
        //A filebrowser wrapping this filebrowser
        this.treeParent = null;
        //A filebrowser that nests this filebrowser
        this.parentStub = null;
        //For tslint
        this.filterTask = this.showFileInfo = null;
        //This has to be done first for proper handling of getScrollingElements
        if (noReload && typeof noReload == 'object') {
            this.setParent(noReload);
        }
        this.superNestedBrowser.constructor.apply(this, arguments);
    }
    Utils.inherits(NestedBrowser, FileBrowser);
    NestedBrowser.prototype.superNestedBrowser = FileBrowser.prototype;
    NestedBrowser.prototype.enterSelectMode = function () {
        for (var a in this.nestedViews) {
            this.foldFolder(a);
        }
        this.superNestedBrowser.enterSelectMode.apply(this, arguments);
    };
    //Overrides
    NestedBrowser.prototype.getScrollingParents = function () {
        if (this.parentStub) return null;
        return this.superNestedBrowser.getScrollingParents.call(this);
    };
    NestedBrowser.prototype.handleScroll = function (element, e) {
        var b = Fileviews.activeFileBrowser == this;
        this.superNestedBrowser.handleScroll.apply(this, arguments);
        if (b) return true;
        for (var i in this.nestedViews) {
            if (this.nestedViews[i].handleScroll(element, e)) return true;
        }
    };
    NestedBrowser.prototype.removeEvents = function () {
        for (var i in this.nestedViews) {
            this.nestedViews[i].destroy();
        }
        this.nestedViews = {};
        this.superNestedBrowser.removeEvents.apply(this, arguments);
    };
    //NestedBrowsers must have their headers assigned not created.
    NestedBrowser.prototype.createHeader = Utils.noop;
    NestedBrowser.prototype.updateTopElements = Utils.noop;
    NestedBrowser.prototype.updateVisibleItems = function (full) {
        if (full) this.clearNestedViews();
        this.superNestedBrowser.updateVisibleItems.apply(this, arguments);
    };
    NestedBrowser.prototype.updateBottomElements = function () {
        if (this.pageEnd < this.names.length) {
            Notify.error(
                'Truncating entries for ' +
                    this.rootDir +
                    ' because limit exceeded'
            );
        }
    };
    NestedBrowser.prototype.getParent = function () {
        return this.parentStub;
    };
    NestedBrowser.prototype.setParent = function (browser) {
        this.parentStub = browser;
        this.showFileInfo = browser.showFileInfo;
        //todo: possibly move all these to a single object
        //to make overriding easy
        setProp(this, 'emitter', browser.emitter);
        setProp(this, 'folderDropdown', browser.childFolderDropdown);
        setProp(this, 'childFolderDropdown', browser.childFolderDropdown);
        setProp(this, 'fileDropdown', browser.fileDropdown);
        setProp(this, 'foldersToIgnore', browser.foldersToIgnore);
        setProp(this, 'menuItems', browser.menuItems);
    };
    NestedBrowser.prototype.openFolder = function (name) {
        if (this.nestedViews[name] && !this.nestedViews[name].isClosed) {
            this.foldFolder(name);
        } else this.expandFolder(name);
    };
    NestedBrowser.prototype.getScreenTop = function () {
        return this.root[0].getBoundingClientRect().top;
    };
    NestedBrowser.prototype.scrollItemIntoView = function (
        filename,
        updatePage
    ) {
        var top = this.showItemAndGetTop(filename, updatePage);
        if (top === false) return 'Not child';
        var rootTop = this.getScreenTop();
        var finalTop = rootTop + top;
        var scrollParent = this.root[0];
        do {
            var overY = $(scrollParent).css('overflow-y');
            if (
                overY != 'hidden' &&
                overY != 'visible' &&
                scrollParent.scrollHeight > scrollParent.clientHeight
            ) {
                if (
                    scrollParent.scrollHeight - scrollParent.scrollTop >
                    finalTop
                ) {
                    break;
                } else {
                    //scrollParent.scrollTop = scrollParent.scrollHeight
                }
            }
            scrollParent = scrollParent.parentElement;
        } while (scrollParent);
        if (scrollParent) {
            var baseTop = scrollParent.getBoundingClientRect().top;
            var baseBottom = scrollParent.getBoundingClientRect().bottom;
            if (finalTop < baseTop + 100 || finalTop > baseBottom - 100) {
                var med = window.innerHeight / 2;
                var targetTop = Math.max(med, baseTop + 20);
                var scrollDiff = finalTop - targetTop;
                scrollParent.scrollTop += scrollDiff;
            }
        }
        this.scrollToRight();
    };
    NestedBrowser.prototype.scrollToRight = function () {
        var scrollParent = this.root[0];
        var finalLeft = scrollParent.getBoundingClientRect().left;
        do {
            if (scrollParent.scrollWidth > scrollParent.clientWidth) {
                if (
                    scrollParent.scrollWidth - scrollParent.scrollLeft >
                    finalLeft
                ) {
                    break;
                } else {
                    //nested scroll
                }
            }
            scrollParent = scrollParent.parentElement;
        } while (scrollParent);
        if (scrollParent) {
            scrollParent.scrollLeft += finalLeft;
        }
    };
    NestedBrowser.prototype.goto = function (path, cb, isFolder) {
        if (!path) return;
        var segments = normalize(path + (isFolder ? SEP : ''));
        if (segments.startsWith(this.rootDir)) {
            var relative = segments.substring(this.rootDir.length);
            if (!relative) return false;
            segments = relative.split(SEP);
            var file = segments.pop();
            var next = function (stub, err) {
                if (err) return cb && cb(err);
                if (segments.length === 0) {
                    if (file) {
                        stub.getElement(file).addClass('emphasis');
                        stub.scrollItemIntoView(file);
                    } else {
                        /*if it is a folder*/
                        stub.getParent().scrollItemIntoView(
                            stub.getParent().filename(stub.rootDir)
                        );
                    }
                    cb && cb();
                } else {
                    stub.expandFolder(segments.shift() + SEP, next);
                }
            };
            next(this);
        } else if (this.treeParent) {
            var stub = this;
            path = normalize(path);
            var root = this.fileServer.getRoot();
            if (path.startsWith(root)) {
                segments = path.substring(root.length).split(SEP);
                //Get the base folder, which is at most 5 levels above the said file
                var topFolder =
                    root +
                    segments
                        .slice(
                            0,
                            -Math.min(5, segments.length) + 1 || segments.length
                        )
                        .join(SEP);
                return this.superNestedBrowser.goto.call(
                    this,
                    topFolder + SEP,
                    function (e) {
                        if (!e && path.startsWith(stub.rootDir)) {
                            stub.goto(path, cb, isFolder);
                        } else cb && cb(e);
                    }
                );
            } else return false;
        } else return false;
    };
    NestedBrowser.prototype.foldFolder = function (name) {
        var el = this.getElement(name);
        if (el) {
            var icon = el.find('.type-icon');
            Icons.renderEl(icon, 'folder_close', name);
        }
        var fb = this.nestedViews[name];
        if (fb.inSelectMode) fb.exitSelectMode();
        fb.close();
    };
    NestedBrowser.prototype.expandFolder = function (name, callback) {
        var el = this.getElement(name);
        var nestedView;
        var callback2 = function (err) {
            if (nestedView == this.nestedViews[name])
                this.extraSpace[
                    this.names.indexOf(name)
                ] = nestedView.stub.height();
            if (callback) callback(nestedView, err);
        }.bind(this);
        if (el.length < 1) {
            throw (
                'Not child folder ' +
                name +
                ' of ' +
                this.rootDir +
                new Error().stack
            );
        }
        var icon = el.find('.type-icon');
        Icons.renderEl(icon, 'folder_open', name);
        if (!this.nestedViews[name]) {
            var child = el.after('<ul></ul>').next();
            child.addClass('fileview');
            nestedView = this.nestedViews[name] = new NestedBrowser(
                child,
                this.childFilePath(name),
                this.fileServer,
                this
            );
            this.nestedViews[name].reload(false, callback2);
        } else {
            (nestedView = this.nestedViews[name]).expand();
            if (callback) setImmediate(callback2);
            else callback2();
        }
    };
    NestedBrowser.prototype.onCtxMenuClick = function (id, filename, el) {
        switch (id) {
            case 'reload-browser':
                if (filename) {
                    if (this.nestedViews[filename]) {
                        this.nestedViews[filename].onCtxMenuClick(
                            id,
                            false,
                            el
                        );
                    }
                    return;
                }
                break;
            case 'clear-select':
                if (filename) {
                    if (this.nestedViews[filename]) {
                        this.nestedViews[filename].exitSelectMode();
                    }
                } else this.exitSelectMode();
                return;
            case 'select-all':
            case 'new-item':
            case 'new-folder':
            case 'paste-file':
                if (filename && FileUtils.isDirectory(filename)) {
                    var self = this;
                    this.expandFolder(filename, function () {
                        var child = self.nestedViews[filename];
                        child.onCtxMenuClick(id, null, el);
                    });
                    return;
                }
        }
        this.superNestedBrowser.onCtxMenuClick.apply(this, arguments);
    };
    NestedBrowser.prototype.headerDropdown = 'nested-header-dropdown';
    NestedBrowser.prototype.fileDropdown = 'child-file-dropdown';
    NestedBrowser.prototype.folderDropdown = 'child-folder-dropdown';
    NestedBrowser.prototype.childFolderDropdown = 'child-folder-dropdown';
    NestedBrowser.prototype.nestedFolderDropdown = 'nested-folder-dropdown';
    NestedBrowser.prototype.nestedFileDropdown = 'nested-file-dropdown';
    NestedBrowser.prototype.expandAll = function (
        callback,
        depth,
        onEach,
        accumulator,
        stopSignal
    ) {
        var self = this;
        if (depth === undefined) {
            depth = 1;
        }
        if (depth < 0) {
            if (accumulator) accumulator.push(this);
            return callback && callback(this);
        }
        var counter = Utils.createCounter(callback);
        counter.increment();
        var toExpand = [];
        for (var b = this.pageStart; b < this.pageEnd; b++) {
            var name = this.names[b];
            if (!FileUtils.isDirectory(name)) continue;
            counter.increment();
            toExpand.push(name);
        }

        var next = function () {
            counter.decrement();
            if (toExpand.length < 1) return;
            var name = toExpand.shift();
            if (self.foldersToIgnore.indexOf(name) < 0)
                self.expandFolder(
                    name,
                    (function () {
                        var doExpand = function () {
                            var child = self.nestedViews[name];
                            child.expandAll(
                                next,
                                depth - 1,
                                onEach,
                                accumulator,
                                stopSignal
                            );
                        };
                        if (onEach) {
                            return function () {
                                onEach(
                                    self,
                                    self.nestedViews[name],
                                    doExpand,
                                    name
                                );
                            };
                        }
                        return doExpand;
                    })()
                );
            else next();
        };
        if (stopSignal) next = stopSignal.control(next, counter.decrement);
        next();
    };
    NestedBrowser.prototype.foldAll = function () {
        var self = this;
        for (var a in self.nestedViews) {
            self.nestedViews[a].foldAll();
            self.foldFolder(a);
        }
    };
    function createFilter(rootDir, text) {
        text = text.toLowerCase();
        if (text) {
            var isGlob = /[{},*]/.test(text);
            if (text.startsWith('./')) text = FileUtils.resolve(rootDir, text);
            else if (text[0] !== '/') text = (isGlob ? '**/' : '**/*') + text;
            if (!isGlob && text[text.length - 1] !== '/') text = text + '*';
        } else text = FileUtils.join(rootDir, '*');
        var glob = FileUtils.globToRegex(text);
        var quickFilter = FileUtils.genQuickFilter(text);
        return {
            isMatch: function (path) {
                return (
                    !FileUtils.isDirectory(path) ||
                    glob.test(path.toLowerCase())
                );
            },
            filterList: function (name, root) {
                var path = (root + name).toLowerCase();
                return (
                    glob.test(path) ||
                    (FileUtils.isDirectory(name) && quickFilter.test(path))
                );
            },
        };
    }

    NestedBrowser.prototype.filter = Utils.debounce(function (text) {
        if (this.headerMode == 'filter') {
            this.inFilter = true;
            if (!this.fileServer.setFilter)
                this.fileServer = new FindFileServer(this.fileServer);
            var filter = createFilter(
                this.isProjectView ? this.names[0] : this.rootDir,
                text
            );
            this.fileServer.setFilter(filter.filterList);
            this.reload(
                false,
                function () {
                    this.names.forEach(function (e) {
                        if (!filter.isMatch(this.childFilePath(e)))
                            this.getElement(e).addClass('destroyed');
                    }, this);
                    if (this.headerMode == 'filter') this.findFile(text);
                }.bind(this)
            );
        } else this.cancelFind();
    }, 500);

    NestedBrowser.prototype.foldersToIgnore = Utils.parseList(
        appConfig.expandAllFilter
    );

    NestedBrowser.prototype.findFile = function (filter, timeout, callback) {
        var self = this;
        self.clearNestedViews();
        if (self.filterTask) self.filterTask.stop();
        // self.filterTask.subscribe(function () {
        //     self.filterTask = null;
        // });
        self.filterTask = new StopSignal();
        self.setLoading(true);
        self.filterTask.subscribe(function () {
            self.setLoading(false);
            self.filterTask = null;
        });
        if (!self.fileServer.setFilter)
            self.fileServer = new FindFileServer(self.fileServer);
        var glob = null;
        if (typeof filter == 'string') {
            //Needed to match folders
            glob = createFilter(
                this.isProjectView ? this.names[0] : this.rootDir,
                filter
            );
            filter = glob.filterList;
        }
        self.fileServer.setFilter(filter);
        self.inFilter = true;
        var called = false;
        self.iterate(
            function () {
                self.stopFind();
                if (callback) {
                    callback();
                    if (called) throw 'Error: Called twice';
                    called = true;
                    // callback = null;
                }
            },
            1000,
            self.filterTask.control(
                function (p, c, cb, n) {
                    if (!c.names) return cb(); //errors in getFile
                    //This hides all folders initially
                    //When there is a match it unhides all the
                    //parents folders.
                    //We could make the folders hidden at
                    //renderView though.
                    var hasMatch;
                    c.names.forEach(function (e) {
                        if (
                            glob
                                ? glob.matches(c.childFilePath(e))
                                : FileUtils.isDirectory(e)
                        ) {
                            hasMatch || (hasMatch = true);
                        } else c.getElement(e).addClass('destroyed');
                    });
                    if (hasMatch) {
                        while (p) {
                            n = p.filename(c.rootDir);
                            p.expandFolder(n);
                            p.getElement(n).removeClass('destroyed');
                            c = p;
                            p = p.getParent();
                            if (!c.isClosed) {
                                break;
                            }
                        }
                    } else {
                        p.foldFolder(n);
                    }
                    cb();
                },
                function (p, c, cb) {
                    cb();
                }
            ),
            2,
            self.filterTask
        );
        if (timeout) {
            setTimeout(function () {
                self.stopFind();
            }, timeout);
        }
    };
    NestedBrowser.prototype.stopFind = function () {
        var self = this;
        if (self.filterTask) self.filterTask.stop();
        self.inFilter = false;
        //Open in new project replaces fileserver
        if (self.fileServer.setFilter) self.fileServer.setFilter(null);
    };
    NestedBrowser.prototype.cancelFind = function () {
        var self = this;
        if (self.inFilter) {
            self.stopFind();
        }
        self.clearNestedViews();
        self.reload(false);
    };
    //expandAll breadthFirst
    NestedBrowser.prototype.iterate = function (
        callback,
        maxDepth,
        eachCallback,
        delveDepth,
        stopSignal
    ) {
        var accumulator = [this];
        var delve = function () {
            if (accumulator.length < 1) {
                return callback && callback();
            }
            var a = accumulator.shift();
            a.expandAll(
                delve,
                delveDepth,
                eachCallback,
                accumulator,
                stopSignal
            );
        };
        return delve();
    };

    NestedBrowser.prototype.reload = function () {
        this.superNestedBrowser.reload.apply(this, arguments);
        //todo expand previously open folders;
    };
    NestedBrowser.prototype.isTree = true;
    NestedBrowser.prototype.clearNestedViews = function () {
        var self = this;
        for (var i in self.nestedViews) {
            self.foldFolder(i);
            self.nestedViews[i].stub.detach();
            delete self.nestedViews[i];
        }
    };
    NestedBrowser.prototype.close = function () {
        this.isClosed = true;
        this.stub.hide();
    };
    NestedBrowser.prototype.expand = function () {
        if (!this.isClosed) return;
        this.isClosed = false;
        this.stub.show();
    };
    //Overrides NestedBrowser to create a parent
    //for multiple nestedViews
    //Can set title etc.
    /** @constructor */
    function ProjectView(id, rootDir, fileServer) {
        this.superProjectView.constructor.call(
            this,
            id,
            rootDir,
            fileServer,
            true
        );
        this.rootDir = ''; //todo don't ignore rootDir argument
        if (this.names && this.names.length) this.reload();
    }
    Utils.inherits(ProjectView, NestedBrowser);
    ProjectView.prototype.superProjectView = NestedBrowser.prototype;
    ProjectView.prototype.rename = function (name, newname) {
        if (name === this.names[0]) {
            this.getElement(name).find('.filename').html(newname);
            var project = FileUtils.getProject();
            if (project.name !== newname) {
                FileUtils.openProject(
                    project.rootDir,
                    project.fileServer,
                    newname
                );
            }
        }
    };
    ProjectView.prototype.setRootDir = function (dir) {
        this.rootDir = '';
        if (dir) {
            if (this.isClosed) {
                this.stub
                    .closest('#hierarchy_tab')
                    .removeClass('hierarchy-closed');
                this.isClosed = false;
            } else if (this.inFilter) {
                this.stopFind();
            }
            if (!FileUtils.isDirectory(dir)) dir = dir + SEP;
            if (this.showFileInfo) {
                this.fileStats = [];
                this.fileStats[0] = 'Project Root';
            } else this.fileStats = null;
            this.names = [dir];
        } else this.names = [];
    };
    ProjectView.prototype.close = function () {
        this.isClosed = true;
        this.names = [];
        this.stub.closest('#hierarchy_tab').addClass('hierarchy-closed');
        this.updateView(this.names);
    };
    ProjectView.prototype.reload = function (
        highlightNewFiles,
        callback,
        rootDir
    ) {
        if (arguments.length > 2) this.setRootDir(rootDir);
        this.updateView(this.names);
        if (this.names && this.names.length > 0) {
            var counter;
            var self = this;
            if (callback) {
                counter = Utils.createCounter(callback);
                callback = counter.decrement;
                counter.increment();
            }
            for (var i = self.pageStart; i < self.pageEnd; i++) {
                if (counter) counter.increment();
                if (self.nestedViews[self.names[i]]) {
                    self.nestedViews[self.names[i]].reload(
                        highlightNewFiles,
                        callback
                    );
                } else {
                    self.expandFolder(self.names[i], callback);
                }
            }
        }
        if (callback) callback();
    };
    ProjectView.prototype.filename = function (name) {
        if (this.names.indexOf(name) > -1) {
            return name;
        } else {
            throw 'Error not child';
        }
    };
    ProjectView.prototype.newFile = function () {
        if (this.isClosed) return console.error('Filebrowser is Closed');
        var args = arguments;
        this.expandFolder(this.names[0], function (b) {
            b.newFile.apply(b, args);
        });
    };

    ProjectView.prototype.goto = function (path, cb, arg2) {
        if (this.isClosed) return console.error('Filebrowser is Closed');
        var delegate = this.names[0];
        this.expandFolder(delegate, function (cs, e) {
            if (e) return cb && cb(e);
            cs.goto(path, cb, arg2);
        });
    };
    ProjectView.prototype.isProjectView = true;
    ProjectView.prototype.folderDropdown = 'project-dropdown';
    FileBrowser.prototype.projectDropdown = 'project-dropdown';
    exports.FileBrowser = FileBrowser;
    exports.NestedBrowser = NestedBrowser;
    exports.ProjectView = ProjectView;
}); /*_EndDefine*/