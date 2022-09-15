define(function (require, exports, module) {
    /* globals $ */
    var Utils = require('grace/core/utils').Utils;
    var SplitManager = require('grace/ui/split_manager').SplitManager;
    var ajax = require('grace/core/ajax').ajax;
    var watchTheme = require('grace/themes/themes').watchTheme;
    var AutoCloseables = require('grace/ui/auto_closeables').AutoCloseables;
    var Editors = require('grace/editor/editors').Editors;
    var DocsTab = require('grace/setup/setup_tab_host').DocsTab;
    var getTabWindow = require('grace/ext/ui/tab_window').getTabWindow;
    require('css!./previewer.css');
    function createIcon(id, name) {
        return (
            "<button style='width:35px' id='" +
            id +
            "' class='material-icons'>" +
            name +
            '</button>'
        );
    }

    function loadConsole(win, loadOnly) {
        if (win.eruda) {
            if (!loadOnly) {
                win.eruda._devTools.toggle();
            }
            win.eruda._entryBtn.hide();
        } else {
            ajax('./libs/js/eruda.min.js', {
                responseType: 'text',
            }).then(function (req) {
                var script = req.responseText;
                win.eval(script);
                if (win.eruda) {
                    win.eruda.init(win.erudaPanes || []);
                    loadConsole(win);
                }
            });
        }
    }

    function createNavBar(navBar, icons, prefix) {
        navBar.className = 'editor-primary preview-navbar';
        var addressBar = document.createElement('div');
        addressBar.className = 'addressBar';
        navBar.appendChild(addressBar);
        var iconContainer = document.createElement('div');
        iconContainer.className = 'iconContainer';
        for (var i in icons) {
            $(iconContainer).append(
                createIcon((prefix || '') + icons[i].id, icons[i].icon),
            );
        }
        navBar.appendChild(iconContainer);
        return {
            addressBar: addressBar,
            iconContainer: iconContainer,
        };
    }
    //should this be moved to the run modes
    function inJavascriptMode(editor) {
        return getCurrentMode(editor) == 'javascript';
    }

    function getCurrentMode(editor) {
        return editor.session.getInnerMode();
    }

    function checkInCssHtmlOrString(editor) {
        if (!inJavascriptMode(editor)) {
            //|| inSafeJs(editor)) {
            return true;
        } else {
            return false;
        }
    }

    require('./run').Execute.createPreview = function (edit) {
        var previewContainer = document.createElement('div');
        var navBar = createNavBar(
            $(previewContainer).append('<div></div>').children().last()[0],
            [
                {
                    id: 'backward',
                    icon: 'keyboard_arrow_left',
                },
                {
                    id: 'forward',
                    icon: 'keyboard_arrow_right',
                },
                {
                    id: 'reload',
                    icon: 'refresh',
                },
                {
                    id: 'close',
                    icon: 'close',
                },
                {
                    id: 'console',
                    icon: 'bug_report',
                },
                {
                    id: 'full',
                    icon: 'fullscreen',
                },
                {
                    id: 'desktop',
                    icon: 'computer',
                },
                {
                    id: 'zoom',
                    icon: 'zoom_out',
                },
            ],
            'preview-',
        );
        previewContainer.className = 'tab-window preview';
        var previewWrapper = document.createElement('div');
        previewWrapper.className = 'iframe-wrapper';
        var preview = document.createElement('iframe');
        previewContainer.appendChild(previewWrapper);
        previewWrapper.appendChild(preview);
        navBar.iconContainer.onclick = function (e) {
            var win = preview.contentWindow;
            var a = e.target.getAttribute('id');
            if (!a) return;
            switch (a.substring(8)) {
                case 'backward':
                    win.history.back();
                    break;
                case 'forward':
                    win.history.forward();
                    break;
                case 'console':
                    loadConsole(win);
                    break;
                case 'reload':
                    updatePreview(false);
                    break;
                case 'close':
                    hide();
                    break;
                case 'zoom':
                    $(previewContainer).toggleClass('preview-zoom');
                    break;
                case 'desktop':
                    if (
                        !$(previewContainer)
                            .toggleClass('preview-desktop')
                            .hasClass('preview-desktop')
                    ) {
                        $(previewContainer).removeClass('preview-zoom');
                    } else $(previewContainer).addClass('preview-zoom');
                    break;
                case 'full':
                    if (lastLayout) {
                        show(false);
                        e.target.innerHTML = 'fullscreen';
                    } else {
                        e.target.innerHTML = 'fullscreen_exit';
                        show(true);
                    }
                    break;
            }
        };
        var addressBar = navBar.addressBar;

        var path = '';
        var live = false;
        // var hot = false;
        var lastLayout = false;
        var hidden = true;
        var editor = null;
        var reloader, container;
        var splitMode;
        var liveUpdatePreview = Utils.debounce(function () {
            if (checkInCssHtmlOrString(editor)) updatePreview(true);
        }, 1000);

        function getSplitMode(container) {
            return container.clientWidth > Math.min(container.clientHeight, 720)
                ? 'horizontal'
                : 'vertical';
        }

        function updatePreview(live) {
            if (reloader) {
                reloader.reload(preview, path, live);
            } else {
                if (preview.src == path && preview.contentWindow) {
                    preview.contentWindow.reload(true);
                } else {
                    preview.src = path;
                }
            }
        }

        function setEditor(edit) {
            if (editor == edit) {
                return;
            } else {
                if (live) {
                    if (editor) stopLiveUpdate();
                    editor = edit;
                    startLiveUpdate();
                } else {
                    editor = edit;
                    updatePreview();
                }
            }
        }

        function stopLiveUpdate() {
            live = false;
            editor.off('change', liveUpdatePreview);
        }

        function startLiveUpdate() {
            live = true;
            editor.on('change', liveUpdatePreview);
        }

        function hide() {
            hidden = true;
            if (lastLayout) {
                if (lastLayout == FULL) {
                    $(previewContainer).removeClass('fullscreen');
                    AutoCloseables.remove('preview');
                } else if (lastLayout == TABBED) {
                    if (DocsTab.hasTab('preview')) {
                        Editors.closeTabWindow('preview');
                    }
                }
                previewContainer.parentNode.removeChild(previewContainer);
            } else {
                container = null;
                SplitManager.remove($(previewContainer));
            }
            stopLiveUpdate();
        }
        if (edit) {
            setEditor(edit);
        }
        var SPLIT = 0,
            FULL = 1,
            TABBED = 2;

        function show(layout) {
            /*possible values are
             *DOMElement: use as container
             *true: means document.body,
             *false: means split,
             *undefined: means current container || split
             */
            if (layout === undefined) {
                layout = lastLayout;
            }
            if (!hidden) {
                if (lastLayout != layout) hide();
                else return;
            }
            watchTheme($(previewContainer));
            if (layout instanceof HTMLElement) {
                container = layout;
            } else {
                switch (+layout) {
                    case FULL:
                        container = document.body;
                        previewContainer.className += ' fullscreen';
                        AutoCloseables.add('preview', {
                            close: hide,
                        });
                        break;
                    case SPLIT:
                        container = SplitManager.add(
                            $(editor.container),
                            splitMode || getSplitMode(editor.container),
                        );
                        break;
                    case TABBED:
                        container = getTabWindow('preview', 'PREVIEW', '', hide)
                            .element;
                }
            }
            hidden = false;
            container.appendChild(previewContainer);
            lastLayout = layout;
        }

        var API = {
            isHidden: function () {
                return hidden;
            },
            show: show,
            hide: hide,
            setSplitDirection: function (dir) {
                if (splitMode == dir) return;
                else {
                    splitMode = dir;
                    if (!(hidden || lastLayout)) {
                        hide();
                        show();
                    }
                }
            },
            setEditor: setEditor,
            stopLiveUpdate: stopLiveUpdate,
            startLiveUpdate: startLiveUpdate,
            container: previewContainer,
            setPath: function (p, reload) {
                path = p;
                addressBar.innerHTML = p;
                reloader = reload;
                updatePreview(false);
            },
        };
        return API;
    };
}); /*_EndDefine*/