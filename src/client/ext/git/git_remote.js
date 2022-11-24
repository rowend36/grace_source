//Git Commands Branching
define(function (require, exports, module) {
    /*globals $*/
    var GitUtils = require('./git_utils').GitUtils;
    var ItemList = require('grace/ui/item_list').ItemList;
    var testUrl = GitUtils.testUrl;
    var testPlain = GitUtils.testPlain;
    var success = GitUtils.success;
    var failure = GitUtils.failure;
    var Notify = require('grace/ui/notify').Notify;
    var Utils = require('grace/core/utils').Utils;
    var remoteList;

    function manageRemotes(ev, prov) {
        var branches;

        function showModal(remotes) {
            if (!remoteList) {
                remoteList = new ItemList('git-remotes', branches);
                remoteList.headerText = 'Manage Remotes';
                remoteList.footer = ['Add new', 'Close'];
                remoteList.$cancel = function () {
                    remoteList.$el.modal('close');
                };
                remoteList.$add_new = function () {
                    exports.addRemote(ev, prov, function () {
                        manageRemotes(ev, prov);
                    });
                };
                remoteList.$close = function () {
                    remoteList.$el.modal('close');
                };
                remoteList.$edit = function () {
                    exports.addRemote(
                        ev,
                        prov,
                        function () {
                            manageRemotes(ev, prov);
                        },
                        remoteList.selectedItem
                    );
                };
                remoteList.$delete = function () {
                    if (remoteList.selectedItem)
                        exports.deleteRemote(
                            ev,
                            prov,
                            function () {
                                manageRemotes(ev, prov);
                            },
                            remoteList.selectedItem
                        );
                };
                remoteList.on('select', function (ev) {
                    remoteList.selectedItem = ev.item;
                });
                remoteList.createElement();
                remoteList.itemClass = 'border-inactive url-text';
                remoteList.getHtml = function (i) {
                    return [
                        "<div class='edge_box-2'>",
                        "<span class='fill_box'>",
                        Utils.htmlEncode(this.items[i].remote),
                        '</span>',
                        "<button class='remote-edit-icon material-icons side-1'>edit</button>",
                        "<button class='remote-delete-icon material-icons side-2'>delete</button>",
                        '</div>',
                        '<div>',
                        '<small><i class="color-inactive">',
                        Utils.htmlEncode(this.items[i].url),
                        '</i></small>',
                        '</div>',
                    ].join('');
                };
                remoteList.$el.addClass('remote-list');
                remoteList.$el.on(
                    'click',
                    '.remote-delete-icon',
                    remoteList.$delete
                );
                remoteList.$el.on(
                    'click',
                    '.remote-edit-icon',
                    remoteList.$edit
                );
                Notify.modal({
                    listEl: remoteList.el,
                    keepOnClose: true,
                    large: true,
                    autoOpen: false,
                    footers: true,
                });
            }
            remoteList.items = remotes;
            remoteList.render();
            if (remotes.length) remoteList.select(0);
            remoteList.$el.modal('open');
        }
        prov.listRemotes().then(showModal);
    }
    exports.addRemote = function (ev, prov, done, item) {
        Notify.modal({
            header: 'Add Remote',
            form: [
                {
                    type: 'text',
                    caption: 'Enter remote name',
                    name: 'inputName',
                },
                {
                    type: 'text',
                    caption: 'Enter remote url',
                    name: 'inputUrl',
                },
            ],
            onCreate: function (el) {
                if (item) {
                    $(el).find('#inputName')[0].value = item.remote;
                    $(el).find('#inputUrl')[0].value = item.url;
                }
                $(el).on('submit', function (e) {
                    e.preventDefault();
                    var name = $(this).find('#inputName')[0].value;
                    var url = $(this).find('#inputUrl')[0].value;
                    if (!testPlain(name)) {
                        Notify.error('Invalid remote name');
                    } else if (!testUrl(url)) {
                        Notify.error('Invalid remote url');
                    } else {
                        $(el).modal('close');
                        prov.addRemote({
                            remote: name,
                            url: url,
                            force: item && item.remote === name,
                        }).then(function () {
                            if (item && item.remote !== name) {
                                prov.deleteRemote(item).then(done || success);
                            } else (done || success)();
                        }, failure);
                    }
                });
            },
            footers: ['Cancel', 'Save'],
        });
    };
    exports.deleteRemote = function (ev, prov, done, item) {
        Notify.ask('Proceed to delete remote ' + item.remote, function () {
            prov.deleteRemote(item).then(done || success, failure);
        });
    };

    exports.manageRemotes = manageRemotes;
}); /*_EndDefine*/
