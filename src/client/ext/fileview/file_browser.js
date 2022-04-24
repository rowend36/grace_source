define(function(require, exports, module) {
    "use strict";
    /*globals $*/
    require("grace/ext/glob/glob");
    require("css!./file_browser.css");
    var EventsEmitter = require("grace/core/events").EventsEmitter;
    var configure = require("grace/core/config").Config.configure;
    var configureArr = require("grace/core/config").Config.configureArr;
    var table = require("grace/ui/ui_utils").tabulate;
    var unimplemented = require("grace/core/utils").Utils.unimplemented;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var Fileviews = require("grace/ext/fileview/fileviews").Fileviews;
    var appConfig = require("grace/core/config").Config.registerAll({
            showHiddenFiles: true,
            markFileOnHold: true,
            showFileInfo: false,
            expandAllFilter: ".git/,node_modules/,build/",
            "root:file-browser": FileUtils.defaultServer.getRoot(),
            askBeforeDelete: "**/.*git/**,**/src/,**/node_modules",
            askBeforeDeleteNonEmptyFolders: false,
        },
        "files"
    );
    require("grace/core/config").Config.registerValues({
            expandAllFilter: 'Folders to ignore when executing "unfold all" and "find file" operations',
            askBeforeDelete: "Files containing any of this fragments need confirmation before delete.\n\
        Wildcards are recognised. \n\
        Warning: This will not stop you from deleting parent folders: use askBeforeDeleteNonEmptyFolders",
            askBeforeDeleteNonEmptyFolders: "Confirm before deleting all non empty folders",
        },
        "files"
    );
    var configEvents = require("grace/core/config").ConfigEvents;
    var SEP = FileUtils.sep;
    var Dropdown = require("grace/ui/dropdown").Dropdown;
    var FindFileServer = require("grace/ext/fileserver/find_fs")
        .FindFileServer;
    var Notify = require("grace/ui/notify").Notify;
    var Docs = require("grace/docs/docs").Docs;
    var setTab = require("grace/setup/setup_tab_host").setTab;
    var Utils = require("grace/core/utils").Utils;
    var setProp = Utils.setProp;
    var toTime = Utils.toTime;
    var setImmediate = require("grace/core/utils").Utils.setImmediate;
    var sort = FileUtils.sort;
    var normalize = require("grace/core/file_utils").FileUtils
        .normalize;
    var sort_mode = "folder,code,name";
    var Icons = require("./file_icons").FileIcons;
    /**
     * @type {{files?:string[],server:any;path?:string,host?:FileBrowser}|null} copiedPath
     **/
    var fileClipboard = null;
    //0 ->copy
    //1 ->move
    var copy_mode = 0;
    configEvents.on("files", function(ev) {
        switch (ev.config) {
            case "askBeforeDelete":
                try {
                    FileUtils.globToRegex(appConfig
                        .askBeforeDelete);
                } catch (e) {
                    Notify.error("Invalid glob");
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
        //list of filenames
        this.names = null;
        //Create server
        if (!this.fileServer) {
            this.fileServer = FileUtils.defaultServer;
        }
        //Create stub
        if (typeof id === "object") {
            stub = id;
            id = undefined;
        } else stub = $("#" + id);
        if (stub.length < 1) {
            throw new Error("Bad id or selector " + id);
        }
        this.stub = stub;
        this.paddingBottom = this.paddingTop = 0;
        if (rootDir && rootDir.indexOf(this.fileServer.getRoot()) > -
            1) {
            this.rootDir = rootDir;
        } else if (id && (rootDir = appConfig["root:" + id])) {
            this.rootDir = rootDir;
        } else {
            this.rootDir = this.fileServer.getRoot();
        }
        this.id = id;
        this.setRootDir = this.setRootDir.bind(this);
        this.setRootDir(FileUtils.normalize(this.rootDir));
        if (appConfig["info:" + id] != null) {
            this.showFileInfo = appConfig["info:" + id];
            this.itemHeight = this.showFileInfo ? ITEM_HEIGHT_INFO :
                ITEM_HEIGHT;
        }
        if (stub) this.createView(stub);
        if (!this.isTree && appConfig["tree:" + id]) {
            this.toggleTreeView();
        }
        if (this.names) this.updateHierarchy(this.names);
        else if (noReload) {} else this.reload();
    }
    FileBrowser.prototype.setRootDir = function(dir) {
        if (dir[dir.length - 1] != SEP) dir = dir + SEP;
        this.rootDir = dir;
        if (this.id) {
            configure("root:" + this.id, dir, "files");
        }
        if (this.tree) {
            this.tree.setRootDir(dir);
        }
    };

    function linkify(path) {
        var paths = path.split(SEP);
        var address = "";
        var el = "";
        for (var i = 0; i < paths.length - 2; i++) {
            var name = Utils.htmlEncode(paths[i]);
            address += name + SEP;
            el +=
                "<button class='nav-breadcrumb' href='#' data-target='" +
                address +
                "' >" +
                (name ||
                    "<i class='nav-breadcrumb-icon material-icons'>home</i>"
                ) +
                "</button>";
        }
        el +=
            "<span>" +
            (paths[i] ?
                Utils.htmlEncode(paths[i]) :
                "<i class='material-icons'>home</i>") +
            "</span>";
        return el;
    }

    function clip(e, self) {
        var rel = FileUtils.relative(self.rootDir, e, false, true) || e;
        return rel;
    }
    var ITEM_HEIGHT = 32;
    var ITEM_HEIGHT_INFO = 48;
    FileBrowser.prototype.showFileInfo = appConfig.showFileInfo;
    FileBrowser.prototype.destroy = function() {
        this.removeEvents();
        if (this.tree) this.tree.destroy();
        this.stub = null;
    };
    FileBrowser.prototype.pageSize = 300;
    FileBrowser.prototype.setShowFileInfo = function(val) {
        if (this.showFileInfo != val) {
            if (this.id) configure("info:" + this.id, !!val,
                "files");
            this.showFileInfo = val;
            this.stats = null;
            this.itemHeight = val ? ITEM_HEIGHT_INFO : ITEM_HEIGHT;
            if (this.tree) {
                //update tree also
                this.setShowFileInfo.call(this.tree, val);
            } else {
                //remove old views with wrong item height
                this.removeEvents();
                this.createView(this.stub);
                //for hierarchy
                this.setRootDir(this.rootDir);
                this.reload();
            }
        } else this.showFileInfo = val;
    };
    FileBrowser.prototype.itemHeight = appConfig.showFileInfo ?
        ITEM_HEIGHT_INFO : ITEM_HEIGHT;
    FileBrowser.prototype.createHeader = function() {
        this.stub.append(
            '<div class="header fileview-header scroll-hide"></div>'
        );
        this.header = this.stub.children().last();
        this.stub.css("padding-top", "50px");
        this.updateHeader();
    };
    var safeGoto = function(browser, path) {
        if (!path.startsWith(browser.fileServer.getRoot())) {
            return false;
        }
        browser.reload(false, null, path);
    };
    FileBrowser.prototype.updateHeader = function() {
        if (this.inFilter) {
            return;
        }
        var self = this;
        if (!this.header) {
            this.createHeader();
            return;
        }
        //Jquery makes sure all event handlers are removed
        this.header.empty();
        if (!this.headerMode) {
            this.header.append(
                '<div id="filedir-select" class="edge_box-2 h-100">' +
                '<div class="filenav">' +
                linkify(self.rootDir) +
                "</div>" +
                '<button class="material-icons select side-1">' +
                "history</button>" +
                "<button class='side-2 create center material-icons'>more_vert</button>" +
                "</div>"
            );
            var trigger = this.header.find(".select")[0];
            trigger.onclick = function( /*ev*/ ) {
                var e;
                var options = [];
                for (var i in recentFolders) {
                    e = recentFolders[i];
                    if (e != self.rootDir && options.indexOf(
                            e) < 0)
                        options.push({
                            icon: "history",
                            caption: '<span class="inline-clipper">&nbsp;<span class="clipper-text">' +
                                clip(e, self) +
                                "</span></span>",
                            value: e,
                            className: "list-clip",
                        });
                }
                var bookmarks = FileUtils.getBookmarks();
                for (i in bookmarks) {
                    e = bookmarks[i];
                    if (options.indexOf(e) < 0)
                        options.push({
                            icon: "star",
                            caption: '<span class="inline-clipper">&nbsp;<span class="clipper-text">' +
                                e +
                                "</span></span>",
                            value: e,
                            sortIndex: 200,
                            className: "list-clip",
                        });
                }
                var dropdown = new Dropdown(false,
                    "responsive-right");
                dropdown.setData(options);
                dropdown.show(this);
                dropdown.onclick = function(ev, id, element,
                    item) {
                    safeGoto(self, item.value);
                    return true;
                };
                dropdown.ondismiss = function( /*ev*/ ) {
                    dropdown.setData(null);
                };
            };
            this.header.find(".create").click(function(e) {
                (self.tree || self).showCtxMenu(
                    (self.tree || self).createDropdown,
                    $(this)[0]
                );
                e.stopPropagation();
            });
            //so many different hacks for one thing
            var makeScroll = function() {
                $(this).removeClass('clipper-text');
                $(this).addClass('fill_box');
                this.scrollLeft = this.scrollWidth - this
                    .clientWidth;
                $(this).off('mouseover', makeScroll);
                $(this).off('touchstart', makeScroll);
            };
            var nav = this.header.find(".filenav");
            nav.addClass('clipper-text');
            nav.on('mouseover', makeScroll);
            nav.on('touchstart', makeScroll);
            nav.find(".nav-breadcrumb").click(function() {
                safeGoto(self, this.getAttribute(
                    "data-target"));
            });
            return;
        }
        switch (this.headerMode) {
            case "filter":
                this.header.append(
                    '<div class="edge_box-1 h-100">\
                <div class="fill_box"><input type="text" name="search_text" id="search_text" value="" /></div>\
                <span id="cancelSearch" class="side-1 material-icons">close</span>\
            </div>'
                );
                var autoFilter = Utils.delay(function(e) {
                    self.filter(e.target.value);
                });
                this.header.find("#search_text").on("input",
                    autoFilter);
                this.header.find("#cancelSearch").click(function() {
                    self.headerMode = null;
                    self.filter("");
                    self.updateHeader();
                });
                break;
            case "select":
                this.header.append(
                    '<div class="h-100 edge_box-2">\
                    <div class="flow-text fill_box"><span id = "num_marked" >' +
                    (this.$marked || []).length +
                    '  </span> of <span id = "num_total">' +
                    this.names.length +
                    '</span></div>\
                    <span id="selectAll" class="side-1 material-icons">select_all</span>\
                    <span id="cancelMark" class="side-2 material-icons">close</span>\
                </div>'
                );
                this.header.find("#cancelMark").click(function() {
                    self.exitSelectMode();
                });
                this.header.find("#selectAll").click(function() {
                    self.selectAll();
                });
                break;
            default:
                this.headerMode = null;
                this.updateHeader();
        }
    };
    FileBrowser.prototype.updateTopElements = function() {
        this.paddingTop = 0;
        if (this.names.length < this.pageSize) {
            if (this.topElement) {
                this.topElement.addClass("destroyed");
                // this.topElement = null;
            } else {
                this.topElement = this.root
                    .append(
                        "<li class='destroyed fileview-footer'></li>"
                    )
                    .children()
                    .last();
            }
        } else {
            this.paddingTop = 40;
            if (this.topElement) {
                this.topElement.removeClass("destroyed");
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
                    "<li filename=\"..\" class='file-item border-inactive back-button ' tabIndex=0><span>" +
                    "<i class = 'green-text material-icons'>reply</i></span>" +
                    "<span class='filename'>" +
                    ".." +
                    "</span>" +
                    "</li>"
                )
                .children()
                .last();
            this.backButton.click(this.onBackPressed());
        }
        this.paddingTop += this.itemHeight;
    };
    FileBrowser.prototype.updateBottomElements = function() {
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
            if (this.pageStart === 0 && this.pageEnd == this.names
                .length) {
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
            var txt = '<h6 style="text-align:center">';
            var start =
                '<i class="material-icons arrow_button go_left">keyboard_arrow_left</i>';
            var mid =
                "Page " +
                (Math.floor(this.pageStart / this.pageSize) + 1) +
                " of " +
                (Math.floor(this.names.length / this.pageSize) + 1);
            var end =
                '<i class="material-icons arrow_button go_right">keyboard_arrow_right</i>';
            var txt3 = "</h6>";
            if (this.pageStart > 0) txt += start;
            txt += mid;
            if (this.pageEnd < this.names.length) txt += end;
            txt += txt3;
            this.bottomElement.html(txt);
            this.topElement.html(txt);
        }
        this.paddingBottom = this.bottomElement.height();
    };
    FileBrowser.prototype.getScrollingElements = function() {
        var a = [];
        var p = $(this.root).add($(this.root).parents());
        for (var i = 0; i < p.length; i++) {
            var overflow = p.eq(i).css("overflowY");
            if (overflow != "hidden") {
                a.push(p[i]);
            }
        }
        return $(a);
    };
    FileBrowser.prototype.getItemTop = function(index, init = -1,
        cumul = 0) {
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
    FileBrowser.prototype.renderView = function(i, view) {
        var filename = this.names[i];
        var color;
        if (
            filename == this.fileNameToSelect ||
            (this.newFiles && this.newFiles.indexOf(filename) > -1)
        )
            color = "emphasis";
        else color = "";
        var icon = view.find(".type-icon").attr("class",
            "type-icon");
        if (filename[filename.length - 1] == SEP) {
            view.attr("filename", filename);
            view.attr("class",
                "folder-item file-item border-inactive " + color
            );
            view.attr("tabIndex", 0);
            view.find(".filename").html(
                filename.slice(0, filename.length - 1) + " "
            );
            if (
                this.childStubs) {
                if (this.childStubs[filename] &&
                    this.childStubs[filename].stub.css("display") !=
                    "none"
                )
                    Icons.renderEl(icon, "folder_open", filename);
                else Icons.renderEl(icon, "folder_close", filename);
            } else Icons.renderEl(icon, "folder", filename);
            view.find(".dropdown-btn").attr("data-target", this
                .folderDropdown);
        } else {
            view.attr("filename", filename);
            view.attr("class", "file-item border-inactive " +
                color);
            view.attr("tabIndex", 0);
            view.find(".filename").html(filename + " ");
            Icons.renderEl(icon, "file", filename);
            view.find(".dropdown-btn").attr("data-target", this
                .fileDropdown);
        }
        if (this.stats)
            view.find(".file-info").text(this.stats[filename] ||
                "Timed out");
        else view.find(".file-info").text("");
        if (FileUtils.isBinaryFile(filename)) {
            view.addClass("binary-file");
        }
    };
    FileBrowser.prototype.createView = function(stub) {
        stub.empty();
        if (stub && stub != this.stub) {
            console.warn("Changing stubs is not really supported");
            this.stub = stub;
        } else if (stub.hasClass("fileview")) {
            this.root = this.stub;
        } else {
            this.createHeader();
            this.stub.append('<ul class="fileview"></ul>');
            this.root = stub.children().last();
            this.root.html(
                "<h6 class='no-results color-inactive'>Loading files...</h6>"
            );
        }
        this.root.toggleClass("fileview-info", this.showFileInfo);
        this.childViews = [];
        this.backButton = this.topElement = this.bottomElement =
            null;
        //not used by filebrowser
        //at all except to compute
        //item tops
        this.extraSpace = {};
        this.pageStart = 0;
        this.pageEnd = -1;
        this.attachEvents();
    };
    FileBrowser.prototype.getOrCreateView = function(i) {
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
    FileBrowser.prototype.moveTo = FileBrowser.prototype.shiftTo =
        function(
            newEl,
            oldEl
        ) {
            $(oldEl).removeClass("selected");
            $(newEl).addClass("selected");
        };
    FileBrowser.prototype.getCurrentElement = function() {
        return (
            this.root.find(".selected").not(".destroyed")[0] ||
            this.root.children()[0]
        );
    };
    FileBrowser.prototype.blur = function() {
        return this.root.find(".selected").removeClass("selected");
    };
    FileBrowser.prototype.attachEvents = function() {
        var self = this;
        //this.updateClickListeners
        this.root.on(
            "click.filebrowser",
            ".folder-item span.dropdown-btn",
            function(e) {
                if (!self.menu) {
                    self.showCtxMenu(self.folderDropdown, this
                        .parentElement);
                }
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        );
        this.root.on(
            "click.filebrowser",
            ".file-item:not(.folder-item) span.dropdown-btn",
            function(e) {
                if (!self.menu) {
                    self.showCtxMenu(self.fileDropdown, this
                        .parentElement);
                }
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        );

        this.root.on(
            "click.filebrowser",
            ".folder-item",
            this.onFolderClicked()
        );
        this.root.on(
            "click.filebrowser",
            ".file-item:not(.folder-item):not(.back-button)",
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
        this.root.on("contextmenu.filebrowser", function(e) {
            var t = $(e.target);
            if (!t.hasClass("file-item")) t = t.closest(
                ".file-item");
            if (appConfig.markFileOnHold && !self
                .inSelectMode) {
                self.enterSelectMode(t.attr("filename"));
            } else if (t.hasClass("folder-item")) {
                self.showCtxMenu(self.folderDropdown, t[0]);
            } else if (t.length && !t.hasClass(
                    "back-button")) {
                self.showCtxMenu(self.fileDropdown, t[0]);
            }
            e.stopPropagation();
            e.preventDefault();
        });
        this.root.on("click.filebrowser", ".go_right", function() {
            self.pageStart += self.pageSize;
            self.updateVisibleItems(true);
            self.updateBottomElements();
            self.root[0].scrollTop = 0;
        });
        this.root.on("click.filebrowser", ".go_left", function() {
            self.pageStart -= self.pageSize;
            self.updateVisibleItems(true);
            self.updateBottomElements();
            self.root[0].scrollTop = self.getItemTop(self
                .pageEnd);
        });
        var scroller = this.getScrollingElements();
        if (scroller) {
            this.scroller = scroller;
            this.scroller.on("scroll.filebrowser", function(e) {
                self.handleScroll(this, e);
            });
        }
    };
    FileBrowser.prototype.removeEvents = function() {
        this.root.off(".filebrowser");
        //this.root.off(".longtap");
        this.scroller && this.scroller.off(".filebrowser");
    };
    FileBrowser.prototype.updateVisibleItems = function(force) {
        //force implies pagestart changed
        //or pageSize{see getItemTop,inflateChildren,update(Bottom|Top)Elements and attachEvents}
        //or new hierarchy
        //false values are hardly ever needed
        if (this.pageStart % this.pageSize) {
            this.pageStart = Math.floor(this.pageStart / this
                .pageSize);
        }
        var end = Math.min(this.names.length - this.pageStart, this
            .pageSize);
        var childViews = this.childViews;
        if (force) {
            //must remove any widgets;
            if (this.inlineDialog) this.closeInlineDialog();
            for (var i = Math.min(this.pageEnd, this.pageSize); i >
                0;) {
                childViews[--i].addClass("destroyed");
            }
        }
        for (var j = 0; j < end; j++) {
            this.renderView(this.pageStart + j, this
                .getOrCreateView(j));
        }
        this.pageEnd = this.pageStart + end;
    };
    FileBrowser.prototype.goto = function(path, cb, isFolder) {
        if (!path) return;
        var segments = normalize(path + (isFolder ? SEP : ""));
        if (segments.startsWith(this.fileServer.getRoot())) {
            if (segments.endsWith(SEP)) {
                this.reload(false, cb, segments);
            } else {
                segments = segments.split(SEP);
                var folder = segments.slice(0, -1).join(SEP) + SEP;
                var self = this;
                this.reload(
                    false,
                    function(err) {
                        if (!err)
                            self.scrollItemIntoView(
                                segments[segments.length - 1]
                            );
                        cb && cb(err);
                    },
                    folder
                );
            }
            return true;
        }
        return false;
    };
    FileBrowser.prototype.updateHierarchy = function(names,
        highlightNewFiles) {
        this.root.find('.no-results').remove();
        if (this.tree) {
            this.updateHeader();
            this.tree.updateHierarchy(names, highlightNewFiles);
            return;
        }
        if (this.inSelectMode) this.exitSelectMode();
        if (!appConfig.showHiddenFiles) {
            names = names.filter(function(i) {
                i.startsWith(".");
            });
        }
        names = sort(names, sort_mode);
        if (!names) throw "Null names";
        if (this.names && highlightNewFiles) {
            var newFiles = [];
            var old = this.names;
            for (var i in names) {
                if (old.indexOf(names[i]) < 0) {
                    newFiles.push(names[i]);
                }
            }
            this.newFiles = newFiles;
        } else this.newFiles = null;
        this.names = names;
        this.updateHeader();
        if (!this.fileNameToSelect && this.newFiles) {
            this.fileNameToSelect = this.newFiles[0];
        }
        if (this.fileNameToSelect) {
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
    FileBrowser.prototype.scrollItemIntoView = function(filename,
        updatePage) {
        var self = this;
        var i = this.names.indexOf(filename);
        if (i < 0 && !FileUtils.isDirectory(filename)) {
            filename += SEP;
            i = this.names.indexOf(filename);
        }
        if (i < 0) return "Not Child";
        var pageStart = Math.floor(i / this.pageSize) * this
            .pageSize;
        if (pageStart != this.pageStart && updatePage) {
            self.pageStart = pageStart;
            self.updateVisibleItems(true);
            self.updateBottomElements();
        } else self.pageStart = pageStart;
        if (this.scroller) {
            var el = this.scroller[this.scroller.length - 1];
            var offset = 0;
            var root = this.root[0];
            while (root != el) {
                offset += root.offsetTop;
                root = root.parentElement;
            }
            var y = self.getItemTop(i) + offset;
            if (
                y < el.scrollTop + 50 ||
                y > el.scrollTop + el.clientHeight - 50
            ) {
                el.scrollTop = y - el.clientHeight / 2;
            }
        }
    };
    FileBrowser.prototype.handleScroll = function(
        scrollElement /*, ev*/ ) {
        //Already handled in longtap
        if (this.menu) this.menu.hide();
        if (scrollElement == this.root[0]) {
            this.header && this.header.toggleClass('scroll-hide',
                scrollElement.scrollTop == 0);
        }
        /*var t = this.root.data('timeout.longtap');
        if (t) {
            clearTimeout(t);
        }*/
    };
    FileBrowser.prototype.onBackPressed = function() {
        var self = this;
        var e = function() {
            var p = self.parentDir();
            self.reload(false, null, p);
        };
        return e;
    };
    FileBrowser.prototype.onFolderClicked = function() {
        var self = this;
        var e = function(f) {
            if (f.which == 1) {
                f.stopPropagation();
                var file = this.getAttribute("filename");
                if (self.inSelectMode) {
                    return self.toggleMark(file);
                } else self.openFolder(file);
            }
        };
        return e;
    };
    FileBrowser.prototype.onFileClicked = function() {
        var self = this;
        return function(e) {
            if (e.which == 1) {
                e.stopPropagation();
                var filename = this.getAttribute("filename");
                if (self.inSelectMode) {
                    return self.toggleMark(filename);
                }
                self.openFile(filename);
            }
        };
    };
    FileBrowser.prototype.openFolder = function(file) {
        if (this.names.indexOf(file) > -1)
            this.reload(null, null, this.childFilePath(file));
    };
    FileBrowser.prototype.openFile = function(filename, forceNew, cb) {
        var self = this;
        FileUtils.addToRecents(self.rootDir);
        var path = self.childFilePath(filename);
        var ev = FileUtils.trigger("open-file", {
            browser: self,
            filename: filename,
            filepath: path,
            rootDir: self.rootDir,
            id: "open-file",
        });
        if (ev.defaultPrevented) return;
        var b = !forceNew && Docs.forPath(path, self.fileServer);
        if (b) {
            setTab(b.id);
        } else {
            Docs.openDoc(path, self.fileServer, cb);
        }
    };
    FileBrowser.prototype.showInlineDialog = function(
        el,
        callback,
        status,
        val
    ) {
        var self = this;
        if (el && !val) {
            val = el.attr("filename").replace(SEP, "");
        }
        var text =
            '<div class="renameField">' +
            '<div class="edge_box-2 h-30" >' +
            '<input class="fill_box" id="new_file_name" value="' +
            (val || "") +
            '"type="text" class="validate">' +
            '<span id="submitBtn" class="side-1"><i class="material-icons">done</i></span>' +
            '<span id="cancelBtn" class="side-2"><i class="material-icons">cancel</i></span>' +
            "</div>" +
            '<span id="error-text"></span>' +
            "</div>";
        this.closeInlineDialog();
        el = el || this.backButton;
        if (el) {
            el.after(text);
            el.addClass("destroyed");
            self.inlineDialog = el.next();
            self.inlineDialogStub = el;
        } else {
            el = self.root.prepend(text);
            self.inlineDialog = el.children().first();
            self.inlineDialogStub = null;
        }
        var e = self.inlineDialog;
        if (status) e.find("#error-text").html(status);
        e.find("#new_file_name").on("input", function(e) {
            if (e.keyCode == 13) e.find("#submitBtn")
                .click();
        });
        e.find("#submitBtn").click(function() {
            var res = callback(e.find("#new_file_name")
                .val());
            if (res) {
                e.find("#error-text").html(res);
            } else self.closeInlineDialog();
        });
        e.find("#cancelBtn").click(function() {
            var res = callback(undefined, true);
            if (res) {
                e.find("#error-text").html(res);
            } else self.closeInlineDialog();
        });
        e.find("input").focus();
        if (val) {
            e.find("input")[0].selectionStart = 0;
            e.find("input")[0].selectionEnd = val.length;
        }
        //var t = self.names.indexOf(el.attr('filename'));
        //this.extraSpace[t] = 18;
        if (Fileviews.activeFileBrowser == self) self.menu.hide();
    };
    FileBrowser.prototype.rename = function(former, b) {
        var path = this.childFilePath(former);
        var dest = this.childFilePath(b, false);
        if (FileUtils.isDirectory(former)) dest += SEP;
        if (dest == path) return;
        var self = this;
        var error = self.validateNewFileName(b);
        if (error) return error;
        this.fileServer.rename(path, dest, function(err) {
            if (!err) {
                self.fileNameToSelect = b;
                self.reload(true);
                Docs.rename(path, dest, self.fileServer);
            } else Notify.error("Rename failed");
        });
    };
    /*Added ctx argument in case rootDir/names changes*/
    FileBrowser.prototype.childFilePath = function(name, check, ctx) {
        ctx = ctx && ctx.names ? ctx : this;
        if (check && ctx.names.indexOf(name) < 0)
            throw "Err: Not Child";
        return ctx.rootDir + name;
    };
    FileBrowser.prototype.validateNewFileName = function(name, ctx) {
        ctx = ctx && ctx.names ? ctx : this;
        var b = name;
        if (!name) return "Name cannot be empty";
        if (ctx.names.indexOf(b) > -1 || ctx.names.indexOf(b +
                SEP) > -1)
            return "File Already Exists";
        var path = this.childFilePath(name, false, ctx);
        if (Docs.forPath(path, ctx.fileServer)) {
            setTab(Docs.forPath(path, ctx.fileServer).id);
            return "File Currently Open";
        }
    };
    FileBrowser.prototype.filename = function(e, notChild, ctx) {
        ctx = ctx && ctx.names ? ctx : this;
        //return the filename of a path
        //to get path from filename use
        //getChildPath
        if (!(notChild || e.startsWith(ctx.rootDir))) {
            throw "Error: asked for filename for non child";
        }
        var isFolder = false;
        if (FileUtils.isDirectory(e)) isFolder = true;
        while (e.endsWith(SEP)) e = e.slice(0, e.length - 1);
        var name =
            e.substring(e.lastIndexOf(SEP) + 1, e.length) +
            (isFolder ? SEP : "");
        if (!notChild && ctx.names.indexOf(name) < 0)
            throw "Error not child";
        return name;
    };
    FileBrowser.prototype.parentDir = function() {
        var e = this.rootDir;
        if (
            e == this.fileServer.getRoot() ||
            !e.startsWith(this.fileServer.getRoot())
        )
            return this.fileServer.getRoot();
        var a = FileUtils.dirname(this.rootDir);
        return a == SEP ? a : a ? a + SEP : this.rootDir;
    };
    FileBrowser.prototype.tree = null;

    FileBrowser.prototype.reload = function(
        highlightNewFiles,
        callback,
        rootDir
    ) {
        var self = this;
        if (this.tree) {
            if (rootDir) {
                this.tree.rootDir = rootDir;
            }
            this.tree.reload(highlightNewFiles, function(err) {
                if (!err) {
                    self.setRootDir(self.tree.rootDir);
                    self.updateHeader();
                } else self.tree.rootDir = self.rootDir;
                callback && callback(err);
            });
            return;
        }
        var called = false;

        function load(err, res) {
            if (called) throw new Error(
                'getfiles/readdir cb called twice in reload'
            );
            called = true;
            if (!err) {
                if (rootDir) self.setRootDir(rootDir);
                self.updateHierarchy(res, highlightNewFiles);
            } else self.root.find('.no-results').text(
                'Error loading files');
            if (callback) callback(err);
        }
        self.stats = null;
        if (this.showFileInfo) {
            var fs = this.fileServer;
            var root = rootDir || this.rootDir;
            fs.readdir(root, function(e, r) {
                if (e) return load(e);
                var timedOut = new Utils.AbortSignal();
                setTimeout(
                    timedOut.control(function() {
                        timedOut.abort();
                    }),
                    2000
                );
                var stats = [];
                Utils.asyncForEach(
                    r,
                    function(e, i, next, cancel) {
                        next = timedOut.control(next,
                            cancel);
                        fs.lstat(root + e, function(err,
                            stat) {
                            if (err) {
                                stats[i] =
                                    "(Error getting stat)";
                            } else {
                                if (stat
                                    .isDirectory()
                                ) {
                                    r[i] += "/";
                                    stats[e +
                                            "/"
                                        ] =
                                        toTime(
                                            stat
                                            .mtime ||
                                            stat
                                            .mtimeMs
                                        );
                                } else
                                    stats[e] =
                                    toTime(stat
                                        .mtime ||
                                        stat
                                        .mtimeMs
                                    ) +
                                    "  " +
                                    Utils
                                    .toSize(stat
                                        .size);
                            }
                            next();
                        });
                    },
                    function(cancelled) {
                        if (self.showFileInfo) self
                            .stats = stats;
                        if (cancelled) {
                            fs.getFiles(root, load);
                        } else {
                            load(e, r);
                            timedOut.clear();
                        }
                    },
                    20,
                    false,
                    true
                );
            });
        } else this.fileServer.getFiles(rootDir || this.rootDir,
            load);
    };
    FileBrowser.prototype.enterSelectMode = function(filename) {
        if (!this.$marked) this.$marked = [];
        this.inSelectMode = true;
        if (filename) {
            this.mark(filename);
        }
        if (this.headerMode && this.headerMode != "select") {
            this.prevMode = this.headerMode;
        }
        this.headerMode = "select";
        this.updateHeader();
    };
    FileBrowser.prototype.selectAll = function() {
        this.names.slice(this.pageStart, this.pageEnd).forEach(
            function(name) {
                this.mark(name);
            }, this);
    };
    FileBrowser.prototype.exitSelectMode = function() {
        if (!this.$marked) return;
        this.inSelectMode = false;
        for (var i = this.$marked.length; i >= 0; i--) {
            this.unmark(this.$marked[i]);
        }
        this.$marked = [];
        if (this.prevMode) {
            this.headerMode = this.prevMode;
            this.prevMode = null;
        } else this.headerMode = null;
        this.updateHeader();
    };
    FileBrowser.prototype.mark = function(filename) {
        if (!this.inSelectMode) this.enterSelectMode();
        if (
            this.names.indexOf(filename) > -1 &&
            this.$marked.indexOf(filename) < 0
        ) {
            this.getElement(filename).addClass("marked-file");
            this.$marked.push(filename);
            this.updateHeader();
        }
    };
    FileBrowser.prototype.toggleMark = function(name) {
        if (this.getElement(name).hasClass("marked-file")) {
            this.unmark(name);
        } else this.mark(name);
    };
    FileBrowser.prototype.unmark = function(filename) {
        if (!this.$marked) return;
        if (
            this.names.indexOf(filename) > -1 &&
            this.$marked.indexOf(filename) > -1
        ) {
            this.getElement(filename).removeClass("marked-file");
            this.$marked.splice(this.$marked.indexOf(filename), 1);
        }
        if (this.inSelectMode && this.$marked.length < 1) {
            this.exitSelectMode();
        }
    };
    FileBrowser.prototype.closeInlineDialog = function() {
        if (this.inlineDialogStub)
            this.inlineDialogStub.removeClass("destroyed");
        if (this.inlineDialog) this.inlineDialog.detach();
        this.inlineDialog = this.inlineDialogStub = null;
    };
    FileBrowser.prototype.createTreeView = function() {
        var stub = this;
        stub.tree = new ChildStub(
            stub.root,
            stub.rootDir,
            stub.fileServer,
            true
        );
    };
    FileBrowser.prototype.toggleTreeView = function() {
        var stub = this;
        if (stub.tree) {
            configure("tree:" + this.id, false, "files");
            stub.tree.destroy();
            stub.tree = undefined;
            stub.createView(stub.stub);
            stub.reload();
        } else {
            configure("tree:" + this.id, true, "files");
            stub.removeEvents();
            stub.createTreeView();
            stub.tree.toggleTreeView = stub.toggleTreeView.bind(
                stub);
            stub.tree.setShowFileInfo = stub.setShowFileInfo.bind(
                stub);
            stub.tree.goto = function(path, cb, i) {
                path = normalize(path);
                if (path.startsWith(stub.rootDir)) {
                    return ChildStub.prototype.goto.apply(stub
                        .tree, [
                            path,
                            cb,
                            i,
                        ]);
                } else {
                    var root = stub.fileServer.getRoot();
                    if (path.startsWith(root)) {
                        var segments = path.substring(root
                            .length).split(SEP);
                        //Get the base folder, which is at most 5 levels above the said file
                        var max =
                            root +
                            segments
                            .slice(
                                0,
                                -Math.min(5, segments.length) +
                                1 ||
                                segments.length
                            )
                            .join(SEP);
                        return stub.goto(max + SEP, function(
                            e) {
                            if (!e) {
                                ChildStub.prototype.goto
                                    .apply(stub.tree, [
                                        path,
                                        cb,
                                        i,
                                    ]);
                            } else cb && cb(e);
                        });
                    } else return false;
                }
            };
            stub.tree.header = stub.header;
            stub.tree.treeParent = this;
            stub.tree.updateHeader = stub.updateHeader;
            stub.tree.preStart = stub.pageStart;
            if (stub.tree.showFileInfo != stub.showFileInfo) {
                stub.setShowFileInfo.call(stub.tree, stub
                    .showFileInfo);
            } else stub.reload();
        }
    };
    FileBrowser.prototype.newFile = function(name, callback) {
        var stub = this;
        var encoding;
        var c = function(name, cancel) {
            if (cancel) {
                return;
            }
            var a = stub.validateNewFileName(name);
            if (a) return a;
            var filepath = stub.childFilePath(name);
            var ev = FileUtils.trigger("new-file", {
                browser: stub,
                filename: name,
                filepath: filepath,
                rootDir: stub.rootDir,
                id: "new-file",
                encoding: encoding,
            });
            if (!ev.defaultPrevented)
                stub.fileServer.writeFile(
                    filepath,
                    "",
                    encoding,
                    function( /*err*/ ) {
                        stub.fileNameToSelect = name;
                        stub.reload(true, callback);
                    }
                );
        };
        stub.showInlineDialog(null, c, null, name || "");
        var dialog = stub.inlineDialog;
        FileUtils.once("clear-temp", function() {
            if (stub.inlineDialog == dialog) {
                stub.closeInlineDialog();
            }
        });
    };
    FileBrowser.prototype.onCtxMenuClick = function(id, filename, el) {
        if (this.tree) return this.tree.onCtxMenuClick(id, filename,
            el);
        var stub = this;
        filename = filename || "";
        var rootDir = stub.rootDir;
        var filepath = filename ? stub.childFilePath(filename) :
            rootDir;
        var event = this.emitter.trigger(id, {
            browser: stub,
            filename: filename,
            filepath: filepath,
            rootDir: rootDir,
            marked: this.inSelectMode ? this.$marked :
                undefined,
            id: id,
        });
        if (event.defaultPrevented) return;
        var i,
            name,
            server = stub.fileServer,
            isFolder;
        switch (id) {
            case "open-file":
                var clearPlaceholder = function(e, doc) {
                    if (doc && doc.$removeAutoClose) {
                        doc.$removeAutoClose();
                    }
                };
                clearPlaceholder(null, require(
                        "grace/docs/active_doc")
                    .getActiveDoc());
                if (!stub.inSelectMode) {
                    stub.openFile(filename, true,
                        clearPlaceholder);
                    break;
                } else {
                    isFolder = FileUtils.isDirectory;
                    for (i in stub.$marked) {
                        name = stub.$marked[i];
                        if (!isFolder(name)) {
                            //why open multiple folders
                            stub.openFile(name, false,
                                clearPlaceholder);
                        }
                    }
                }
                break;
            case "open-folder":
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
            case "open-project":
                //must update hierarchy to persist folder
                FileUtils.openProject(filepath || rootDir, server);
                break;
            case "new-file":
                name = "newfile";
                i = 0;
                while (stub.names.indexOf(name) > -1) {
                    name = "newfile(" + i++ + ")";
                }
                stub.newFile(name);
                break;
            case "add-bookmark":
                if (FileUtils.getBookmarks().indexOf(rootDir) < 0) {
                    FileUtils.getBookmarks().push(rootDir);
                    configureArr(
                        "bookmarks",
                        FileUtils.getBookmarks(),
                        "files"
                    );
                }
                break;
            case "remove-bookmark":
                var index;
                if ((index = FileUtils.getBookmarks().indexOf(
                        rootDir)) > -1) {
                    FileUtils.getBookmarks().splice(index, 1);
                    configureArr(
                        "bookmarks",
                        FileUtils.getBookmarks(),
                        "files"
                    );
                }
                break;
            case "reload-browser":
                stub.reload(true);
                break;
            case "open-tree":
                this.toggleTreeView();
                break;
            case "show-info":
                var one = Utils.createCounter(function() {
                    Notify.modal({
                        header: filepath.replace(
                            /(.{15,})\//, "$1/ "
                        ),
                        body: els.length > 1 ?
                            els.join("</br>") +
                            "</br>" +
                            table({
                                "Total Size": Utils
                                    .toSize(
                                        total),
                            }) : els[0],
                        dismissible: true,
                    });
                });
                var els = [];
                var paths;
                if (stub.inSelectMode) {
                    paths = stub.$marked.map(stub.childFilePath
                        .bind(stub));
                } else paths = [filepath];
                var total = 0;
                paths.forEach(function(p, i) {
                    one.increment();
                    server.stat(p, function(err, stat) {
                        if (!err) {
                            var size = stat.size;
                            var date = toTime(stat
                                .mtime || stat
                                .mtimeMs);
                            total += size || 0;
                            els.push(
                                table({
                                    Name: stub
                                        .inSelectMode ?
                                        stub
                                        .$marked[
                                            i
                                        ] :
                                        filename,
                                    "Byte Length": size,
                                    Size: Utils
                                        .toSize(
                                            size
                                        ),
                                    "Last Modified": date,
                                })
                            );
                        }
                        one.decrement();
                    });
                });
                break;
            case "rename-file":
            case "rename-folder":
                el = stub.getElement(filename);
                stub.showInlineDialog(
                    el,
                    function(val, cancel) {
                        if (cancel) return false;
                        else {
                            var t = stub.rename(filename, val);
                            return t;
                        }
                    },
                    "Enter new name"
                );
                break;
            case "new-browser":
                Fileviews.newBrowser();
                break;
            case "new-tab":
                Fileviews.initBrowser({
                    rootDir: filepath || rootDir,
                    server: server,
                });
                break;
            case "copy-file":
            case "cut-file":
                if (id == "copy-file") copy_mode = 0;
                else copy_mode = 1;
                if (stub.inSelectMode && stub.$marked.length > 0) {
                    var files = [];
                    for (var j in stub.$marked) {
                        files.push(stub.childFilePath(stub.$marked[
                            j]));
                    }
                    fileClipboard = {
                        files: files,
                        server: server,
                    };
                    if (files[0] == filepath) {
                        fileClipboard.path = filepath;
                    }
                } else {
                    fileClipboard = {
                        path: filepath,
                        server: server,
                    };
                }
                if (copy_mode) {
                    fileClipboard.host = stub;
                }
                break;
            case "filter-files":
                stub.headerMode = "filter";
                stub.updateHeader();
                stub.header.find("#search_text").focus();
                break;
            case "paste-file":
                if (!fileClipboard) return;
                var oldCopy = fileClipboard;
                console.log(oldCopy);
                var method = copy_mode === 0 ? "copy" : "move";
                var modal = $(Notify.modal({
                    'header': copy_mode ?
                        "Moving files...." :
                        'Copying files....',
                    body: "<h6 id='progress-header'></h6><div class='progress'><span class='indeterminate'></span></div>",
                    footers: ['Cancel', 'Hide'],
                    dismissible: true
                }, function() {
                    el = null;
                }));
                var ctx = {
                    names: stub.names,
                    rootDir: stub.rootDir,
                    fileServer: stub.fileServer
                };
                var progress = modal.find("#progress-header");
                var abort = new Utils.AbortSignal();
                modal.find(".modal-cancel").click(abort.abort);
                var copyServer = fileClipboard.server;
                var doPaste = function(path, next, failed) {
                    var name = stub.filename(path, true, ctx);
                    var error = stub.validateNewFileName(name,
                        ctx);
                    if (error) {
                        failed(error, name);
                        return;
                    }
                    var newpath = stub.childFilePath(name,
                        false, ctx);
                    var type = FileUtils.isDirectory(path) ?
                        "Folder" : "File";
                    progress.text(path);
                    var stop = FileUtils[method + type](
                        path,
                        newpath,
                        copyServer,
                        server,
                        function(err) {
                            abort.unNotify(stop);
                            if (!err) {
                                if (method == "move") {
                                    if (copyServer ==
                                        server) {
                                        Docs.rename(path,
                                            newpath,
                                            server);
                                    } else Docs.delete(path,
                                        server);
                                }
                                next(name);
                            } else {
                                console.error(err);
                                failed("Failed to " +
                                    method, name);
                            }
                        },
                        null, //no conflict resolution
                        function(path, e) {
                            if (e) progress.html(
                                '<span class="error-text"> Failed to ' +
                                method +
                                ' ' + path + '</span>');
                            else progress.text(path);
                            //
                        }
                    );
                    abort.notify(stop);
                };
                var onFinished = function() {
                    abort.clear();
                    stub.reload(true);
                    modal.modal('close');
                    if (method == "move") {
                        if (oldCopy == fileClipboard) {
                            if (fileClipboard.host != stub)
                                fileClipboard.host.reload();
                            fileClipboard = null;
                        }
                    }
                };
                if (!fileClipboard.files) {
                    doPaste(
                        fileClipboard.path,
                        function(name) {
                            Notify.info("Pasted " + name);
                            onFinished();
                        },
                        function(error, name) {
                            Notify.error(error + " " + name);
                            onFinished();
                        }
                    );
                } else {
                    var filesToCopy = [].concat(fileClipboard
                        .files);
                    var numCopied = filesToCopy.length;
                    var MAX_SIMULTANEOUS_COPY = 5;
                    Utils.asyncForEach(
                        filesToCopy,
                        function(file, i, next, cancel) {
                            next = abort.control(next, cancel);
                            doPaste(file, next, function(err,
                                name) {
                                Notify.ask(
                                    err +
                                    " " +
                                    name +
                                    ", continue?",
                                    function() {
                                        numCopied--;
                                        next();
                                    },
                                    cancel
                                );
                            });
                        },
                        function(cancelled) {
                            if (!cancelled)
                                Notify.info("Pasted " + (
                                        numCopied || 0) +
                                    " files");
                            else if (numCopied > 0)
                                Notify.warn("Pasted " +
                                    numCopied + " files");
                            onFinished();
                        },
                        MAX_SIMULTANEOUS_COPY,
                        false,
                        true
                    );
                }
                break;
            case "delete-browser":
                Fileviews.deleteBrowser(stub.isTree ? stub
                    .treeParent.id : stub.id);
                break;
            case "close-project":
                Fileviews.openProject(
                    FileUtils.NO_PROJECT,
                    FileUtils.defaultServer
                );
                break;
            case "delete-file":
            case "delete-folder":
                var message, toDelete;
                var doDelete = function() {
                    if (toDelete.length > 0) {
                        var path = stub.childFilePath(toDelete
                            .pop());
                        Docs.delete(path, server);
                        server.delete(
                            path,
                            doDelete
                        );
                    } else stub.reload();
                };
                var ask = function(c) {
                    if (c) {
                        Notify.prompt(
                            message + "\nEnter " + code +
                            " to continue",
                            function(ans) {
                                if (ans != code)
                                    return false;
                                doDelete();
                            }
                        );
                    } else {
                        Notify.ask(message, doDelete);
                    }
                };
                if (!stub.inSelectMode) {
                    toDelete = [filename];
                    message = "Delete " + filename + "?";
                } else {
                    toDelete = stub.$marked.slice(0);
                    message =
                        "Delete " +
                        stub.$marked.length +
                        " files.\n" +
                        stub.$marked.join("\n");
                }
                var code = "" + Math.floor(Math.random() * 999999);
                if (appConfig.askBeforeDelete) {
                    var test = FileUtils.globToRegex(appConfig
                        .askBeforeDelete);
                    if (
                        toDelete
                        .map(stub.childFilePath,
                            stub) //fullpath match
                        .concat(toDelete) //base name match
                        .some(test.test, test)
                    ) {
                        return ask(true);
                    }
                } else if (appConfig
                    .askBeforeDeleteNonEmptyFolders) {
                    var folders = toDelete.filter(FileUtils
                        .isDirectory);
                    if (folders.length) {
                        return Utils.asyncForEach(
                            folders,
                            function(name, i, next, cancel) {
                                server.readdir(
                                    stub.childFilePath(
                                        name),
                                    function(e, res) {
                                        if (e || (res && res
                                                .length > 0
                                            ))
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
            case "mark-file":
                stub.enterSelectMode(filename);
                break;
            case "new-folder":
                Notify.prompt("Enter folder name", function(name) {
                    if (name) {
                        server.mkdir(rootDir + name,
                            function() {
                                stub.reload(true);
                            });
                    }
                });
                break;
            case "show-current-doc":
                var doc = require("grace/docs/active_doc")
                    .getActiveDoc();
                if (doc) {
                    stub.goto(doc.getSavePath());
                }
                break;
            case "toggle-info":
                stub.setShowFileInfo(!stub.showFileInfo);
                break;
            case "select-all":
                this.enterSelectMode();
                this.selectAll();
                break;
            case "fold-opts":
            case "view-opts":
                break;
            case "fold-all":
                if (filename && FileUtils.isDirectory(filename)) {
                    if (stub.childStubs[filename]) {
                        //stub.foldFolder(filename);
                        stub.childStubs[filename].foldAll();
                    }
                } else stub.foldAll();
                break;
            case "fold-parent":
                if (filename) {
                    stub.getParent().foldFolder(
                        stub.getParent().filename(rootDir)
                    );
                    stub.getParent().scrollItemIntoView(
                        stub.getParent().filename(rootDir)
                    );
                }
                break;
            case "expand-all":
                if (filename && FileUtils.isDirectory(filename)) {
                    stub.expandFolder(filename, function() {
                        stub.childStubs[filename].expandAll(
                            null, 2);
                    });
                } else stub.expandAll(null, 2);
                break;
            default:
                unimplemented();
        }
    };
    FileBrowser.prototype.onDismissCtxMenu = function() {};
    FileBrowser.prototype.overflows = {};
    FileBrowser
        .prototype.showCtxMenu = function(menu, el) {
            if (!this.menuItems[menu]) return;
            var name = $(el).attr("filename");
            if (Fileviews.activeFileBrowser) {
                Fileviews.activeFileBrowser.menu.hide();
            }
            var menuEl = this.overflows[menu];
            if (!menuEl) {
                menuEl = new Dropdown();
                this.overflows[menu] = menuEl;
                menuEl.setData(this.menuItems[menu]);
                menuEl.onclick = function(e, id, link) {
                    if (this.filebrowser.menuItems[menu]) {
                        this.filebrowser.onCtxMenuClick(
                            id,
                            this.filebrowser.selected,
                            link
                        );
                        return true;
                    }
                };
                menuEl.ondismiss = function() {
                    this.filebrowser.onDismissCtxMenu();
                    Fileviews.activeFileBrowser = this.filebrowser
                        .menu = this.filebrowser = null;
                };
            }
            Fileviews.activeFileBrowser = this;
            menuEl.filebrowser = this;
            this.menu = menuEl;
            this.selected = name;
            menuEl.show(el);
        };
    FileBrowser.prototype.getElement = function(name) {
        var a = this.root
            .children(".file-item")
            .filter('[filename="' + name + '"]');
        return a;
    };
    FileBrowser.prototype.filter = function(text) {
        var names = this.names.original || this.names;
        var filtered = names.filter(function(i) {
            if (i.toLowerCase().indexOf(text
                    .toLowerCase()) > -1) {
                return true;
            }
            return false;
        });
        filtered.original = names;
        this.selected = false;
        this.inFilter = true;
        this.updateHierarchy(filtered);
        this.inFilter = false;
    };
    FileBrowser.prototype.folderDropdown = "folder-dropdown";
    FileBrowser.prototype.fileDropdown =
        "file-dropdown";
    FileBrowser.prototype.createDropdown = "create-dropdown";
    FileBrowser.prototype.menuItems = {
        "folder-dropdown": {
            "!save-as": "Save As",
            "open-folder": {
                caption: "Open",
            },
            "new-folder": "New Folder",
            "!new-file": "New File",
            "rename-folder": {
                caption: "Rename",
            },
            "delete-folder": "Delete",
            "copy-file": "Copy",
            "cut-file": "Cut",
            "!paste-file": {
                sortIndex: -1,
                caption: "Paste"
            },
            "show-info": "Info",
            "mark-file": "Mark Multiple",
            "new-tab": {
                caption: "Open in new tab",
            },
            "open-project": {
                caption: "Open As Project Folder",
            },
            "!update": [function(self, update) {
                update("paste-file", fileClipboard ? self[
                    "!paste-file"] : null);
                update("new-file", Fileviews.inSaveMode() ?
                    self["!save-as"] : self["!new-file"]
                );
            }]
        },
        "file-dropdown": {
            "open-file": "Open",
            "rename-file": "Rename",
            "delete-file": "Delete",
            "copy-file": "Copy",
            "cut-file": "Cut",
            "!paste-file": {
                caption: "Paste",
            },
            "show-info": "Info",
            "mark-file": "Mark Multiple",
            "!update": [function(self, update) {
                update("paste-file", fileClipboard ? self[
                    "!paste-file"] : null);
            }]
        },
        "create-dropdown": {
            "!save-as": "Save As",
            "!paste-file": {
                caption: "Paste",
            },
            "!new-file": "New File",
            "new-folder": "New Folder",
            "filter-files": "Filter",
            "reload-browser": "Reload",
            "open-project": "Open As Project Folder",
            "show-current-doc": {
                caption: "Show Current File",
                sortIndex: 100,
            },
            "!add-bookmark": "Add To Bookmarks",
            "!remove-bookmark": "Remove From Bookmarks",

            "new-browser": "Add Storage",
            "delete-browser": "Close Storage",
            "toggle-info": "Show File Info",
            "!update": [
                function(self, update) {
                    var bookmarked = FileUtils.getBookmarks()
                        .indexOf(Fileviews.activeFileBrowser
                            .rootDir) > -1;
                    update(
                        "add-bookmark",
                        bookmarked ?
                        null :
                        self["!add-bookmark"]
                    );
                    update(
                        "remove-bookmark",
                        !bookmarked ?
                        null :
                        self["!remove-bookmark"]
                    );
                    update("paste-file", fileClipboard ? self[
                        "!paste-file"] : null);
                    update("new-file", Fileviews.inSaveMode() ?
                        self["!save-as"] : self["!new-file"]
                    );
                    update(
                        "toggle-info",
                        Fileviews.activeFileBrowser
                        .showFileInfo ?
                        "Hide File Info" :
                        "Show File Info"
                    );
                    update(
                        "toggle-info",
                        Fileviews.activeFileBrowser
                        .showFileInfo ?
                        "Hide File Info" :
                        "Show File Info"
                    );
                    update(
                        "open-tree",
                        Fileviews.activeFileBrowser.isTree ?
                        "View As List" :
                        "View As Tree"
                    );
                },
            ],
        },
    };
    //Add ordering
    for (var i in FileBrowser.prototype.menuItems) {
        var o = 1;
        for (var j in FileBrowser.prototype.menuItems[i]) {
            if (typeof FileBrowser.prototype.menuItems[i][j] ==
                "string") {
                FileBrowser.prototype.menuItems[i][j] = {
                    caption: FileBrowser.prototype.menuItems[i][j],
                };
            }
            FileBrowser.prototype.menuItems[i][j].sortIndex =
                FileBrowser.prototype.menuItems[i][j].sortIndex || o++;
        }
    }
    var toggle = function(self, update) {
        var filename = Fileviews.activeFileBrowser.selected || "";
        var extension = FileUtils.extname(filename);
        for (var i in self.toggleProps) {
            var data = self.toggleProps[i];
            var enabled = (filename && data.filename == filename) ||
                (extension && data.extension ==
                    extension);
            update(data.id, enabled ? data : null);
        }
    };

    function createToggle(menu, value) {
        var update = menu["!update"];
        if (!menu.toggleProps) {
            if (update)
                update.push(toggle);
            Object.defineProperties(menu, {
                "!update": {
                    'value': update || [].concat(toggle),
                    writable: true,
                    "enumerable": false
                },
                "toggleProps": {
                    writable: true,
                    'value': {},
                    enumerable: false
                }
            });
        }
        menu.toggleProps[value.id] = value;
    }
    var preventDefault = function(ev) {
        ev.preventDefault();
    };

    function add(menu, id, caption, emitter) {
        if (caption.extension || caption.filename) {
            caption.id = id;
            createToggle(menu, caption);
        } else menu[id] = caption;
        if (caption["!update"]) {
            if (menu["!update"]) menu["!update"].push(caption[
                "!update"]);
            else menu["!update"] = [].concat(caption["!update"]);
        }
        if (caption.onclick)
            emitter.on(id, caption.onclick);
        if (caption.subTree) {
            if (!caption.onclick)
                emitter.on(id, preventDefault);
            for (var i in caption.subTree) {
                add(caption.subTree, i, caption.subTree[i], emitter);
            }
        }
    }
    FileBrowser.prototype.onNewOption = function(types, id, caption,
        func) {
        var prop = this;
        if (Fileviews.activeFileBrowser) {
            Fileviews.activeFileBrowser.menu.hide();
        }
        for (var i in types) {
            var menuId = prop[types[i] + "Dropdown"];
            add(prop.menuItems[menuId], id, caption, this.emitter);
        }
        if (func)
            this.emitter.on(id, func);
    };
    FileBrowser.prototype.emitter = new EventsEmitter();
    FileUtils.ownChannel("files", FileBrowser.prototype
        .onNewOption.bind(FileBrowser.prototype));
    //A nested filebrowser
    function ChildStub(id, rootDir, fileServer, noReload = true) {
        if (noReload && typeof noReload == "object") {
            this.setParent(noReload);
        }
        FileBrowser.apply(this, arguments);
        this.childStubs = {};
    }
    ChildStub.prototype = Object.create(FileBrowser.prototype);
    ChildStub.prototype.constructor =
        ChildStub;
    ChildStub.prototype.superChildStub = FileBrowser.prototype;
    ChildStub.prototype.enterSelectMode =
        function() {
            for (var a in this.childStubs) {
                this.foldFolder(a);
            }
            this.superChildStub.enterSelectMode.apply(this, arguments);
        };
    //Overrides
    ChildStub.prototype.getScrollingElements = function() {
        if (this.parentStub) return null;
        return this.superChildStub.getScrollingElements.call(this);
    };
    ChildStub.prototype.handleScroll = function(element, e) {
        var b = Fileviews.activeFileBrowser == this;
        this.superChildStub.handleScroll.apply(this, arguments);
        if (b) return true;
        for (var i in this.childStubs) {
            if (this.childStubs[i].handleScroll(element, e))
                return true;
        }
    };
    ChildStub.prototype.removeEvents = function() {
        for (var i in this.childStubs) {
            this.childStubs[i].destroy();
        }
        this.childStubs = {};
        this.superChildStub.removeEvents.apply(this, arguments);
    };
    ChildStub.prototype.createHeader = Utils.noop;
    ChildStub.prototype.updateTopElements = Utils.noop;
    ChildStub
        .prototype.updateVisibleItems = function(full) {
            if (full) this.clearChildStubs();
            this.superChildStub.updateVisibleItems.apply(this,
                arguments);
        };
    ChildStub.prototype.updateBottomElements = function() {
        if (this.pageEnd < this.names.length) {
            Notify.error(
                "Truncating entries for " +
                this.rootDir +
                " because limit exceeded"
            );
        }
    };
    ChildStub.prototype.getParent = function() {
        return this.parentStub;
    };
    ChildStub.prototype.setParent = function(browser) {
        //todo move all this to a single object
        setProp(this, "handler", browser.emitter);
        if (setProp(this, "showFileInfo", browser.showFileInfo)) {
            this.itemHeight = browser.itemHeight;
        }
        setProp(this, "childFolderDropdown", browser
            .folderDropdown);
        setProp(this, "childFolderDropdown", browser
            .childFolderDropdown);
        setProp(this, "fileDropdown", browser.fileDropdown);
        setProp(this, "foldersToIgnore", browser.foldersToIgnore);
        setProp(this, "menuItems", browser.menuItems);
        this.parentStub = browser;
    };
    ChildStub.prototype.expandAll = function(
        callback,
        depth,
        eachCallback,
        accumulator
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
        var funcs = [];
        for (var b = this.pageStart; b < this.pageEnd; b++) {
            var name = this.names[b];
            if (!FileUtils.isDirectory(name)) continue;
            counter.increment();
            funcs.push(name);
        }

        function next() {
            counter.decrement();
            if (funcs.length < 1) return;
            var name = funcs.shift();
            if (self.foldersToIgnore.indexOf(name) < 0)
                self.expandFolder(
                    name,
                    (function(a) {
                        var func = function() {
                            var child = self.childStubs[a];
                            child.expandAll(
                                next,
                                depth - 1,
                                eachCallback,
                                accumulator
                            );
                        };
                        if (eachCallback) {
                            return function() {
                                eachCallback(self, self
                                    .childStubs[a],
                                    func, a);
                            };
                        }
                        return func;
                    })(name)
                );
            else next();
        }
        next();
    };
    ChildStub.prototype.foldersToIgnore = Utils.parseList(
        appConfig.expandAllFilter
    );
    ChildStub.prototype.foldAll = function() {
        var self = this;
        for (var a in self.childStubs) {
            self.childStubs[a].foldAll();
            self.foldFolder(a);
        }
    };
    ChildStub.prototype.openFolder = function(name) {
        if (
            this.childStubs[name] &&
            this.childStubs[name].stub.css("display") != "none"
        ) {
            this.foldFolder(name);
        } else this.expandFolder(name);
    };
    ChildStub.prototype.getScreenTop = function() {
        return this.root[0].getBoundingClientRect().top;
    };
    ChildStub.prototype.scrollItemIntoView = function(filename,
        updatePage) {
        var self = this;
        var i = this.names.indexOf(filename);
        if (i < 0 && !FileUtils.isDirectory(filename)) {
            filename += SEP;
            i = this.names.indexOf(filename);
        }
        if (i < 0) return "Not Child";
        var pageStart = Math.floor(i / this.pageSize) * this
            .pageSize;
        if (pageStart != this.pageStart && updatePage) {
            self.pageStart = pageStart;
            self.updateVisibleItems(true);
            self.updateBottomElements();
        } else self.pageStart = pageStart;
        var top = this.getItemTop(i);
        var rootTop = this.getScreenTop();
        var finalTop = rootTop + top;
        var scrollParent = this.root[0];
        do {
            var overY = $(scrollParent).css("overflow-y");
            if (
                overY != "hidden" &&
                overY != "visible" &&
                scrollParent.scrollHeight > scrollParent
                .clientHeight
            ) {
                if (
                    scrollParent.scrollHeight - scrollParent
                    .scrollTop >
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
            var baseBottom = scrollParent.getBoundingClientRect()
                .bottom;
            if (finalTop < baseTop + 100 || finalTop > baseBottom -
                100) {
                var med = window.innerHeight / 2;
                var targetTop = Math.max(med, baseTop + 20);
                var scrollDiff = finalTop - targetTop;
                scrollParent.scrollTop += scrollDiff;
            }
        }
        scrollParent = this.root[0];
        var finalLeft = scrollParent.getBoundingClientRect().left;
        do {
            if (scrollParent.scrollWidth > scrollParent
                .clientWidth) {
                if (
                    scrollParent.scrollWidth - scrollParent
                    .scrollLeft >
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
    ChildStub.prototype.goto = function(path, cb, isFolder) {
        if (!path) return;
        var segments = normalize(path + (isFolder ? SEP : ""));
        if (segments.startsWith(this.rootDir)) {
            var relative = segments.substring(this.rootDir.length);
            if (!relative) return false;
            segments = relative.split(SEP);
            var file = segments.pop();
            var next = function(stub, err) {
                if (err) return cb && cb(err);
                if (segments.length < 1) {
                    if (file) {
                        stub.getElement(file).addClass(
                            "emphasis");
                        stub.scrollItemIntoView(file);
                    } else {
                        /*if it is a folder*/
                        stub.getParent().scrollItemIntoView(
                            stub.getParent().filename(stub
                                .rootDir)
                        );
                    }
                    cb && cb();
                } else {
                    stub.expandFolder(segments.shift() + SEP,
                        next);
                }
            };
            next(this);
        } else return false;
    };
    ChildStub.prototype.foldFolder = function(name) {
        var el = this.getElement(name);
        if (el) {
            var icon = el.find(".type-icon");
            Icons.renderEl(icon, "folder_close", name);
        }
        var fb = this.childStubs[name];
        if (fb.inSelectMode) fb.exitSelectMode();
        fb.stub.hide();
    };
    ChildStub.prototype.expandFolder = function(name, callback) {
        var el = this.getElement(name);
        var callback2 = function(err) {
            this.extraSpace[this.names.indexOf(name)] = this
                .childStubs[
                    name
                ].stub.height();
            if (callback) callback(this.childStubs[name], err);
        }.bind(this);
        if (el.length < 1) {
            throw (
                "Not child folder " +
                name +
                " of " +
                this.rootDir +
                new Error().stack
            );
        }
        var icon = el.find(".type-icon");
        Icons.renderEl(icon, "folder_open", name);
        if (!this.childStubs[name]) {
            var childStub = el.after("<ul></ul>").next();
            childStub.addClass("fileview");
            this.childStubs[name] = new ChildStub(
                childStub,
                this.childFilePath(name),
                this.fileServer,
                this
            );
            this.childStubs[name].reload(false, callback2);
        } else {
            this.childStubs[name].stub.show();
            if (callback) setImmediate(callback2);
            else callback2();
        }
    };
    ChildStub.prototype.onCtxMenuClick = function(id, filename, el) {
        switch (id) {
            case "reload-browser":
                if (filename) {
                    if (this.childStubs[filename]) {
                        this.childStubs[filename].onCtxMenuClick(id,
                            false, el);
                    }
                    return;
                }
                break;
            case "clear-select":
                if (filename) {
                    if (this.childStubs[filename]) {
                        this.childStubs[filename].exitSelectMode();
                    }
                } else this.exitSelectMode();
                return;
            case "select-all":
            case "new-file":
            case "new-folder":
            case "paste-file":
                if (filename && FileUtils.isDirectory(filename)) {
                    var self = this;
                    this.expandFolder(filename, function() {
                        var childStub = self.childStubs[
                            filename];
                        childStub.onCtxMenuClick(id, false,
                            el);
                    });
                    return;
                }
        }
        this.superChildStub.onCtxMenuClick.apply(this, arguments);
    };
    ChildStub.prototype.folderDropdown = "childStub-folder-dropdown";
    ChildStub.prototype.childFolderDropdown =
        "childStub-folder-dropdown";
    ChildStub.prototype.nestedFolderDropdown = "nested-folder-dropdown";
    ChildStub
        .prototype.nestedFileDropdown = "nested-file-dropdown";
    ChildStub.prototype.createDropdown =
        "nested-create-dropdown";
    ChildStub.prototype.fileDropdown = "childStub-file-dropdown";
    ChildStub.prototype
        .menuItems = {
            "nested-create-dropdown": Object.create(
                FileBrowser.prototype.menuItems["create-dropdown"]
            ),
            "nested-folder-dropdown": {
                "fold-opts": {
                    caption: "Fold...",
                    sortIndex: 50,
                    subTree: {
                        "expand-all": {
                            caption: "Unfold Children",
                            sortIndex: 50,
                        },
                        "fold-all": {
                            caption: "Fold Children",
                            sortIndex: 50,
                        },
                        "!fold-parent": {
                            caption: "Fold Parent",
                            sortIndex: 50,
                        },
                        "!update": [
                            function(self, update) {
                                update("fold-parent",
                                    Fileviews.activeFileBrowser
                                    .getParent() ?
                                    self["!fold-parent"] : null);
                            },
                        ],
                    },
                },
                "reload-browser": "Reload Folder",
                "!select-all": {
                    caption: "Select All",
                    sortIndex: 51, //Miss react
                },
                "!clear-select": {
                    caption: "Cancel Selection",
                    sortIndex: 51,
                },
                "!update": [function(self, update) {
                    var browser = Fileviews.activeFileBrowser;
                    if (browser.selected && browser.isTree) {
                        browser = browser.childStubs[browser
                            .selected];
                    }
                    update("clear-select", (browser && browser
                        .inSelectMode) ? self[
                        "!clear-select"] : null);
                    update("select-all", (browser && browser
                        .inSelectMode) ? self[
                        "!select-all"] : null);
                }]
            },
            "childStub-folder-dropdown": Object.create(
                FileBrowser.prototype.menuItems["folder-dropdown"]
            ),
            "childStub-file-dropdown": Object.create(
                FileBrowser.prototype.menuItems["file-dropdown"]
            ),
            "nested-file-dropdown": {
                "fold-parent": {
                    caption: "Fold Parent",
                    sortIndex: 50,
                },
            },
        };

    Dropdown.assign(
        ChildStub.prototype.menuItems["childStub-folder-dropdown"],
        ChildStub.prototype.menuItems["nested-folder-dropdown"]
    );
    Dropdown.assign(
        ChildStub.prototype.menuItems["nested-create-dropdown"],
        ChildStub.prototype.menuItems["nested-folder-dropdown"]
    );
    Dropdown.assign(
        ChildStub.prototype.menuItems["childStub-file-dropdown"],
        ChildStub.prototype.menuItems["nested-file-dropdown"]
    );
    ChildStub.prototype.filter = Utils.debounce(function(text) {
        if (this.headerMode == "filter") {
            this.inFilter = true;
            if (!this.fileServer.setFilter)
                this.fileServer = new FindFileServer(this
                    .fileServer);
            if (typeof text == "string") {
                if (text.indexOf("*") < 0) text = "*" + text +
                    "*";
                if (!text.startsWith("./")) {
                    text = "**/" + text;
                } else text = FileUtils.resolve(this.names[0],
                    text);
            }
            this.fileServer.setFilter(text);
            this.reload(false, (function() {
                this.names.forEach(function(e) {
                    if (FileUtils
                        .isDirectory(e))
                        this.getElement(e)
                        .addClass(
                            "destroyed");
                }, this);
                if (this.headerMode == "filter")
                    this.findFile(text);
            }).bind(this));
        } else this.cancelFind();
    }, 500);
    ChildStub.prototype.findFile = function(text, timeout, callback) {
        var self = this;
        self.clearChildStubs();
        var filterId = (self.filterId = (self.filterId || 0) + 1);
        if (!self.fileServer.setFilter)
            self.fileServer = new FindFileServer(self.fileServer);
        if (typeof text == "string") {
            if (text.indexOf("*") < 0) text = "*" + text + "*";
            if (!text.startsWith("./")) {
                text = "**/" + text;
            } else text = FileUtils.resolve(this.names[0], text);
        }
        self.fileServer.setFilter(text);
        self.inFilter = true;
        var called = false;
        self.iterate(
            function() {
                self.stopFind();
                if (callback) {
                    callback();
                    if (called) throw 'Error';
                    called = true;
                    // callback = null;
                }
            },
            1000,
            function(p, c, cb, n) {
                if (self.filterId != filterId) {
                    return cb();
                }
                if (!c.names) return cb(); //errors in getFile
                //This hides all folders initially
                //When there is a match it unhides all the
                //parents folders. Folder matching can be
                //implemented also.
                //We could make the folders hidden at
                //renderView though.
                var hasFiles = c.names.some(function(el) {
                    return !FileUtils.isDirectory(el);
                });
                c.names.forEach(function(e) {
                    if (FileUtils.isDirectory(e))
                        c.getElement(e).addClass(
                            "destroyed");
                });
                if (hasFiles) {
                    while (p) {
                        n = p.filename(c.rootDir);
                        p.expandFolder(n);
                        p.getElement(n).removeClass(
                            "destroyed");
                        c = p;
                        p = p.getParent();
                        if (c.stub.css("display") != "none") {
                            break;
                        }
                    }
                } else {
                    p.foldFolder(n);
                }
                cb();
            },
            2
        );
        if (timeout) {
            setTimeout(function() {
                self.stopFind();
            }, timeout);
        }
    };
    /*
    An alternate implementation where folders
    are only hidden when there is a confirmed
    no match. Folder matching is also possible.
    Because it detaches folders late, folders can be
    deleted instead of destroyed
    //useful only if we are not using recycler
    while (p && c.names.length < 1) {
        p.foldFolder(n)
        p.names = p.names.filter(
            function(e) {
                return e != n
            })
        p.getElement(n).addClass('destroyed')
        c = p
        p = c.getParent()
        n = self.filename(c.rootDir)
    }
    */
    ChildStub.prototype.stopFind = function() {
        var self = this;
        self.filterId++;
        self.inFilter = false;
        //Open in new project replaces fileserver
        if (self.fileServer.setFilter)
            self.fileServer.setFilter(null);
    };
    ChildStub.prototype.cancelFind = function() {
        var self = this;
        if (self.inFilter) {
            self.stopFind();
        }
        self.clearChildStubs();
        self.reload(true);
    };
    ChildStub.prototype.iterate = function(
        callback,
        maxDepth,
        eachCallback,
        delveDepth
    ) {
        var accumulator = [this];
        var delve = function() {
            if (accumulator.length < 1) {
                return callback && callback();
            }
            var a = accumulator.shift();
            a.expandAll(delve, delveDepth, eachCallback,
                accumulator);
        };
        return delve();
    };

    ChildStub.prototype.reload = function() {
        this.superChildStub.reload.apply(this, arguments);
        //expandOpenfolders;
    };
    ChildStub.prototype.isTree = true;
    ChildStub.prototype.clearChildStubs = function() {
        var self = this;
        for (var i in self.childStubs) {
            self.foldFolder(i);
            self.childStubs[i].stub.detach();
            delete self.childStubs[i];
        }
    };
    //Overrides Childstub to create a parent
    //for multiple childStubs
    //Can set title etc.
    function ProjectBrowser(id, rootDir, fileServer) {
        this.superHierarchy.constructor.call(
            this,
            id,
            rootDir,
            fileServer,
            true
        );
        this.setRootDir = (function(dir) {
            this.rootDir = "";
            if (dir) {
                if (this.isClosed) {
                    this.stub.closest("#hierarchy_tab")
                        .removeClass("hierarchy-closed");
                    this.isClosed = false;
                } else if (this.inFilter) {
                    this.stopFind();
                }
                if (dir[dir.length - 1] != SEP) dir = dir + SEP;
                if (this.showFileInfo) {
                    this.stats = {};
                    this.stats[dir] = "Project Root";
                } else this.stats = null;
                this.names = [dir];
            } else this.names = [];
            this.updateHierarchy(this.names);
        }).bind(this);
        this.rootDir = "";
        if (this.names && this.names.length) this.reload();
    }
    ProjectBrowser.prototype = Object.create(ChildStub.prototype);
    ProjectBrowser.prototype.constructor =
        ProjectBrowser;
    ProjectBrowser.prototype.superHierarchy = ChildStub.prototype;
    ProjectBrowser.prototype.rename =
        function(name, newname) {
            configure("projectName", newname, "files");
            this.getElement(name).find(".filename").html(newname);
        };
    ProjectBrowser.prototype.close = function() {
        this.isClosed = true;
        this.names = [];
        this.stub.closest("#hierarchy_tab").addClass(
            "hierarchy-closed");
        this.updateHierarchy(this.names);
    };
    ProjectBrowser.prototype.reload = function(highlightNewFiles,
        callback) {
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
                if (self.childStubs[self.names[i]]) {
                    self.childStubs[self.names[i]].reload(
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
    ProjectBrowser.prototype.filename = function(name) {
        if (this.names.indexOf(name) > -1) {
            return name;
        } else {
            throw "Error not child";
        }
    };
    ProjectBrowser.prototype.newFile = function() {
        if (this.isClosed) return console.error(
            "Filebrowser is Closed");
        var args = arguments;
        this.expandFolder(this.names[0], function(b) {
            b.newFile.apply(b, args);
        });
    };

    ProjectBrowser.prototype.goto = function(path, cb, arg2) {
        if (this.isClosed) return console.error(
            "Filebrowser is Closed");
        var delegate = this.names[0];
        this.expandFolder(delegate, function(cs, e) {
            if (e) return cb && cb(e);
            cs.goto(path, cb, arg2);
        });
    };
    ProjectBrowser.prototype.menuItems = Object.create(
        ChildStub.prototype.menuItems
    );
    ProjectBrowser.prototype.isHierarchy = true;
    ProjectBrowser.prototype.folderDropdown =
        "project-dropdown";
    ProjectBrowser.prototype.projectDropdown = "project-dropdown";
    ProjectBrowser.prototype
        .menuItems["project-dropdown"] = Object.create(
            ChildStub.prototype.menuItems["childStub-folder-dropdown"]
        );
    Dropdown.assign(ProjectBrowser.prototype.menuItems[
        "project-dropdown"], {
        "open-project": null,
        "close-project": {
            caption: "Close Project",
            sortIndex: 100000,
        },
        "delete-folder": null,
    });
    exports.FileBrowser = FileBrowser;
    exports.NestedBrowser = ChildStub;
    exports.ProjectView = ProjectBrowser;
}); /*_EndDefine*/