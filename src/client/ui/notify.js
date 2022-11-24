define(function (require, exports, module) {
    //Wraps materialize neatly until we get rid of that
    //dependency
    /*globals $, M*/
    require('../libs/js/materialize');
    var AutoCloseables = require('./auto_closeables').AutoCloseables;
    var setImmediate = require('../core/utils').Utils.setImmediate;
    var removeFrom = require('../core/utils').Utils.removeFrom;
    var pending = [];
    var active = 0;
    var genID = require('../core/utils').Utils.genID;
    var FocusManager = require('./focus_manager').FocusManager;

    //Toasts
    function doPending() {
        active--;
        if (pending.length > 0) show(pending.pop());
    }
    function show(opts) {
        active++;
        if (opts.len < 250) {
            M.toast(opts);
        } else {
            $(modal({body: opts.html}, opts.completeCallback));
        }
    }
    var batchView;

    var notify = function (text, duration) {
        var len = text.length;
        if (text.indexOf('>') > -1) len = len * 0.7;
        if (isNaN(duration)) {
            duration = len > 40 ? len * 50 : 2000;
        }
        var opts = {
            html: text,
            displayLength: duration,
            completeCallback: doPending,
            len: len,
        };
        if (batchView) {
            batchView.append('<li>' + opts.html + '</li>');
        } else if (active < 2) {
            show(opts);
        } else {
            pending.push(opts);
            if (pending.length > 10) {
                batchView = $(
                    modal(
                        {
                            header: 'Notification List',
                            body: pending
                                .map(function (b) {
                                    return '<li>' + b.html + '</li>';
                                })
                                .join(''),
                        },
                        function () {
                            batchView = false;
                        }
                    )
                ).find('.modal-content');
                pending.length = 0;
            }
        }
    };
    var warn = function (text, duration) {
        notify(
            "<i class='orange-text material-icons toast-icon'>warning</i>" +
                text,
            duration
        );
    };
    var info = function (text, duration) {
        notify(
            "<i class='info-text material-icons toast-icon'>error</i>" + text,
            duration
        );
    };
    var error = function (error, duration) {
        var err = error && error.toString();
        notify(
            "<i class='red-text material-icons toast-icon'>error</i>" + err,
            duration
        );
    };
    var errors = {};
    var inform = function (error, duration) {
        var lastT = errors[error] || 0;
        var now = new Date().getTime();
        if (now - lastT > 60000) {
            errors[error] = now;
            warn(error, duration);
        }
    };
    var direction = function (info, ondismiss) {
        var el = $(document.createElement('div'));
        document.body.appendChild(el[0]);
        el.addClass('toast modal-direction');
        el.append(
            "<span class='material-icons toast-icon blue-text'>info</span>"
        );
        el.append('<div>' + info + '</div>');
        el.append("<button class='pl-15 material-icons'>close</button>");
        el.show();
        el.css('z-index', 999);
        M.anime({
            targets: el.toArray(),
            bottom: [-100, 0],
            opacity: [0.5, 1],
        });

        function dismiss() {
            M.anime({
                targets: el.toArray(),
                right: [0, -100],
                opacity: [1, 0],
                complete: function () {
                    el.remove();
                },
            });
        }
        if (!ondismiss) ondismiss = dismiss;
        el.children('button').click(ondismiss);
        return dismiss;
    };
    var modals = [];
    var ask = function (text, yes, no, force) {
        var t = arguments;
        modals.push(t);
        if (!force && modals.length > 1) return;
        modal(
            {
                body: text,
                footers: ['Yes', 'No'],
                onCreate: function (el) {
                    el.find('.btn').addClass('btn-flat');
                    el.one('click', '.modal-yes', yes);
                    el.one('click', '.modal-no', no);
                    el.one('click', '.btn', function () {
                        el.modal('close');
                    });
                },
            },
            function (el) {
                el.off();
                removeFrom(modals, t);
                if (modals.length) {
                    var p = modals.shift();
                    ask(p[0], p[1], p[2], true);
                }
            }
        );
    };
    //First rule of maintainaibility,
    //hide ugliness from outsiders, this is the ugliness
    var modal = function (opts, ondismiss) {
        var el = opts.listEl;
        if (!el) {
            var header = [
                opts.header !== false
                    ? ['<h6 class="modal-header">', opts.header, '</h6>'].join(
                          ''
                      )
                    : '',
                '<div class="modal-content">',
                opts.body || '',
                '</div>',
                opts.footers
                    ? "<div class='modal-footer'>" +
                      opts.footers
                          .map(function (e) {
                              return (
                                  "<button class='btn modal-" +
                                  e.toLowerCase().replace(/ /g, '_') +
                                  (1 == opts.footers.length
                                      ? ' right'
                                      : ' center') +
                                  "'>" +
                                  e +
                                  '</button>'
                              );
                          })
                          .join('') +
                      '</div>'
                    : '',
            ].join('');
            el = document.createElement(opts.form ? 'form' : 'div');
            el.id = genID('w');
            el.className = 'modal modal-container';
            $(el).append(header);
            document.body.appendChild(el);
            $(el)
                .find('.modal-cancel')
                .click(function (e) {
                    e.preventDefault();
                    modalEl.modal('close');
                });
            if (opts.form) {
                require(['./forms'], function (mod) {
                    mod.Forms.create(
                        opts.form,
                        el.getElementsByClassName('modal-content')[0]
                    );
                    if (opts.onCreate) opts.onCreate($(el), mod.Forms);
                    else
                        console.error(
                            'Failed to provide onCreate for modal with .form option'
                        );
                });
                $(el).submit(false);
            } else if (opts.onCreate) opts.onCreate($(el));
        }
        var modalEl = $(el);
        if (opts.large) modalEl.addClass('modal-large');
        FocusManager.trap(modalEl.find('button'));
        FocusManager.trap(modalEl.find('select'));
        if (!opts.footers) modalEl.addClass('modal-no-footer');
        var options = {
            centerY: !opts.large,
            inDuration: 50,
            outDuration: 100,
            dismissible: false, //materialize does this horribly
        };
        options.onCloseEnd = function () {
            require('./navigation').Navigation.removeRoot(el);
            AutoCloseables.onCloseEnd.apply(this);
            if (this.$returnFocus) this.$returnFocus();
            if (!opts.keepOnClose) {
                modalEl.modal('destroy');
                modalEl.remove();
            }
            ondismiss && ondismiss(modalEl);
        };
        options.onOpenStart = FocusManager.onModalOpen;
        options.onOpenEnd = function () {
            AutoCloseables.onOpenEnd.apply(this, arguments);
            require('./navigation').Navigation.addRoot(
                el,
                instance.close.bind(instance),
                true
            );
        };
        //set this after to avoid wierd key event trapping
        options.dismissible = opts.dismissible !== false;
        modalEl.modal(options);
        var instance = M.Modal.getInstance(el);
        FocusManager.trap(instance.$overlay, true);
        instance.$preventDismiss = opts.dismissible === false;
        if (opts.autoOpen !== false) {
            modalEl.modal('open');
        }
        return el;
    };
    var inputDialog = null,
        input,
        promptText,
        changed,
        onchange,
        isOpen = false,
        queued = [];
    var ENTER = 13,
        ESC = 27;
    var Dropdown;
    var onDialogClose, completer, returnFocus;
    var createInputDialog = function (
        caption,
        onchang,
        getValue,
        ondismis,
        complete
    ) {
        if (!inputDialog) {
            var dialog = modal(
                {
                    body:
                        "<div class='prompt-text'></div>" +
                        '<input></input>' +
                        "</div><div class='modal-footer modal-footer-2'>" +
                        "<a href='#!' class='modal-cancel waves-effect waves-green btn-flat'>Cancel</a>" +
                        "<a href='#!' class='modal-done waves-effect waves-green btn-flat'>Done</a>",
                    autoOpen: false,
                    keepOnClose: true,
                    header: false,
                    centerY: true, //ignored
                },
                function () {
                    if (!changed && onDialogClose) {
                        try {
                            onDialogClose();
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    if (queued.length) {
                        setImmediate(function () {
                            changed = false;
                            var item = queued.shift();
                            inputDialog.modal('open');
                            completer = item.pop();
                            onDialogClose = item.pop();
                            input.value = item.pop()() || '';
                            onchange = item.pop();
                            promptText.innerHTML = item.pop();
                        }, 20);
                    } else {
                        returnFocus();
                        Dropdown.hide();
                        isOpen = false;
                        completer = onDialogClose = onchange = null;
                    }
                }
            );
            dialog.className = 'modal modal-alert';
            dialog.addEventListener('click', function (e) {
                e.stopPropagation();
            });
            inputDialog = $(dialog);
            input = dialog.getElementsByTagName('input')[0];
            input.addEventListener('keydown', function (e) {
                switch (e.keyCode) {
                    case ENTER:
                        changed = true;
                        if (onchange(input.value) !== false) {
                            inputDialog.modal('close');
                        } else input.focus();
                        break;
                    case ESC:
                        inputDialog.modal('close');
                        break;
                    case 8:
                        if (completer) {
                            var data = completer.complete(this.value);
                            if (data.length) {
                                Dropdown.update(data);
                                Dropdown.show(this);
                            } else Dropdown.hide();
                        }
                }
            });
            input.addEventListener('input', function () {
                if (completer) {
                    var data = completer.complete(this.value);
                    if (data.length) {
                        Dropdown.update(data);
                        Dropdown.show(this);
                    } else Dropdown.hide();
                }
            });
            var save = dialog.getElementsByClassName('modal-done')[0];
            save.addEventListener('click', function () {
                changed = true;
                if (onchange(input.value) !== false) {
                    inputDialog.modal('close');
                } else input.focus();
            });
            var hide = dialog.getElementsByClassName('modal-cancel')[0];
            hide.addEventListener('click', function () {
                inputDialog.modal('close');
            });
            Dropdown = new (require('./dropdown').Dropdown)(true, 'left');
            Dropdown.onclick = function (ev, id, element, item) {
                completer.update(input, item);
            };
            promptText = dialog.getElementsByClassName('prompt-text')[0];
        }
        return {
            caption: caption,
            show: function () {
                if (!isOpen) {
                    isOpen = true;
                    changed = false;
                    inputDialog.modal('open');
                    promptText.innerHTML = caption;
                    input.value = getValue() || '';
                    returnFocus = FocusManager.visit(input, true);
                    //used because of prompt
                    FocusManager.hintNoChangeFocus();
                    onDialogClose = ondismis;
                    onchange = onchang;
                    completer = complete;
                } else
                    queued.push([
                        caption,
                        onchange,
                        getValue,
                        onDialogClose,
                        completer,
                    ]);
            },
        };
    };
    var getText = function (text, func, defText, value_completer) {
        if (Array.isArray(value_completer)) {
            value_completer = value_completer.sort();
        }
        text = text.split('\n').join('</br>');
        var dialog = createInputDialog(
            text,
            func,
            function () {
                return defText;
            },
            func,
            value_completer &&
                (Array.isArray(value_completer)
                    ? {
                          complete: function (text) {
                              text = text.toLowerCase();
                              return value_completer.filter(function (e) {
                                  return e.toLowerCase().indexOf(text) > -1;
                              });
                          },
                          update: function (input, text) {
                              return (input.value = text);
                          },
                      }
                    : value_completer)
        );
        dialog.show();
    };
    var pick = function (name, items, onItemSelected, ondismiss) {
        require(['./item_list'], function (mod) {
            var list = new mod.ItemList('picker', items);
            list.containerClass = 'modal';
            list.headerText = name;
            list.createElement();
            list.$el.modal(require('./auto_closeables').AutoCloseables);
            list.render();
            list.on('select', function (e) {
                if (onItemSelected(e.item, e.index) !== false) {
                    list.$el.modal('close');
                    FocusManager.hintChangeFocus();
                    finish();
                }
            });
            list.current = null;
            var finish = FocusManager.visit(list.$receiver);
            return modal(
                {
                    listEl: list.el,
                    dismissible: ondismiss !== false,
                },
                ondismiss
            );
        });
    };
    exports.Notify = {
        //Generic notify. Display information for a specific duaration
        notify: notify,
        //Show info
        info: info,
        //Show error
        error: error,
        //Show warning
        warn: warn,
        //Warn but throttles
        inform: inform,
        //Like info but stays until dismissed
        direct: direction,
        //Collect input
        dialog: createInputDialog,
        //Show a modal
        modal: modal,
        //Choose between items in a list
        pick: pick,
        //Simpler form of dialog
        prompt: getText,
        //Yes or no alert
        ask: ask,
    };
}); /*_EndDefine*/