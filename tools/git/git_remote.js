//Git Commands Branching
_Define(function(global) {
    var GitCommands = (global.GitCommands || (global.GitCommands = Object.create(null)));
    var ItemList = global.ItemList;
    var testUrl = GitCommands.testUrl;
    var testPlain = GitCommands.testPlain;
    var success = GitCommands.success;
    var failure = GitCommands.failure;
    var Notify = global.Notify;
    var Utils = global.Utils;
    var remoteList;

    function manageRemotes(ev, prov) {
        var branches;

        function showModal(remotes) {
            if (!remoteList) {
                remoteList = new ItemList('git-remotes', branches);
                remoteList.headerText = "Manage Remotes";
                remoteList.footer = ['Add new', 'Close'];
                remoteList.$cancel = function() {
                    remoteList.$el.modal('close');
                };
                remoteList.$add_new = function() {
                    GitCommands.addRemote(ev, prov, function() {
                        manageRemotes(ev, prov);
                    });
                };
                remoteList.$close = function() {
                    remoteList.$el.modal('close');
                };
                remoteList.$edit = function() {
                    GitCommands.addRemote(ev, prov, function() {
                        manageRemotes(ev, prov);
                    }, remoteList.selectedItem);
                };
                remoteList.$delete = function() {
                    if (remoteList.selectedItem)
                        GitCommands.deleteRemote(ev, prov, function() {
                            manageRemotes(ev, prov);
                        }, remoteList.selectedItem);
                };
                remoteList.on('select', function(ev) {
                    remoteList.selectedItem = ev.item;
                });
                remoteList.createElement();
                remoteList.itemClass = 'part mb-10 url-text';
                remoteList.getHtml = function(i) {
                    return [
                        "<h6>", Utils.htmlEncode(this.items[i].remote),
                        '</h6><span class="color-inactive">', Utils.htmlEncode(this.items[i].url),
                        '</span>',
                        "<div class='h-30 edge_box-2'>",
                        "<button class='remote-edit-icon material-icons side-1'>edit</button>",
                        "<button class='remote-delete-icon material-icons side-2'>delete</button>",
                        "</div>"
                    ].join("");
                };
                remoteList.$el.on('click', '.remote-delete-icon', remoteList.$delete);
                remoteList.$el.on('click', '.remote-edit-icon', remoteList.$edit);
                Notify.modal({
                    listEl: remoteList.el,
                    keepOnClose: true,
                    autoOpen: false
                });

            }
            remoteList.items = remotes;
            remoteList.render();
            if (remotes.length)
                remoteList.select(0);
            remoteList.$el.modal('open');
        }
        prov.listRemotes().then(showModal);
    }
    GitCommands.addRemote = function(ev, prov, done, item) {
        var el = Notify.modal({
            header: "Add Remote",
            form: [{
                    type: 'text',
                    caption: 'Enter remote name',
                    name: 'inputName'
                },
                {
                    type: 'text',
                    caption: 'Enter remote url',
                    name: 'inputUrl'
                }
            ],
            footers: ['Cancel', 'Save']
        });
        if (item) {
            $(el).find('#inputName')[0].value = item.remote;
            $(el).find('#inputUrl')[0].value = item.url;
        }
        $(el).on('submit', function(e) {
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
                    force: item && item.remote === name
                }).then(function() {
                    if (item && item.remote !== name) {
                        prov.deleteRemote(item).then(done || success);
                    } else(done || success)();
                }, failure);
            }
        });
    };
    GitCommands.deleteRemote = function(ev, prov, done, item) {
        Notify.ask('Proceed to delete remote ' + item.remote, function() {
            prov.deleteRemote(item).then(done || success, failure);
        });
    };

    GitCommands.manageRemotes = manageRemotes;
}); /*_EndDefine*/
