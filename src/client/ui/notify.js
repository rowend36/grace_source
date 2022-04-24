define(function(require, exports, module) {
    //Wraps materialize neatly until we get rid of that
    //dependency
    /*globals $, M*/
    require("../libs/js/materialize");
    var warningClasses = "red-text";
    var infoClasses = "blue";
    var errorClasses = "red";
    var AutoCloseable = require("../ui/autocloseable").AutoCloseable;
    var setImmediate = require("../core/utils").Utils.setImmediate;
    var noop = require("../core/utils").Utils.noop;
    var safeCall = require("../core/utils").Utils.withTry;
    var pending = [];
    var active = 0;
    var genID = require("../core/utils").Utils.genID;
    var FocusManager = require("../core/focus_manager").FocusManager;
    var debug = console;
    function doPending() {
        if (pending.length > 0) {
            var toast = pending.pop();
            if (toast.len > 250) {
                var el = $(modal({
                    body: toast.html
                }, toast.completeCallback));
                el.find('.toast-icon').remove();
                return;
            }
            return M.toast(toast);
        } else active--;
    }
    var suppressed = false;
    var clearSuppressed = require("../core/utils").Utils.debounce(function() {
        suppressed = false;
    }, 200);

    var notify = function(text, duration) {
        var len = text.length;
        if (text.indexOf(">")) len = len / 2;
        if (isNaN(duration)) {
            duration = len > 40 ? len * 50 : 2000;
        }
        var opts = {
            html: text,
            displayLength: duration,
            completeCallback: doPending,
            len: len
        };
        if (active < 2) {
            active++;
            if (len > 250) {
                var el = $(modal({
                    body: opts.html
                }, doPending));
                el.find('.toast-icon').remove();
                return;
            }
            return M.toast(opts);
        }
        if (pending.length > 10) {
            suppressed = M.toast({
                html: 'Output suppressed. Check console',
                displayLength: Infinity,
                completeCallback: clearSuppressed
            });
            pending.length = 0;
        }
        if (suppressed) {
            clearSuppressed();
            debug.log(text);
        } else pending.push(opts);
    };
    var warn = function(text, duration) {
        notify("<i class='orange-text material-icons toast-icon'>warning</i>" + text, duration,
            warningClasses);
    };
    var info = function(text, duration) {
        notify("<i class='white-text material-icons toast-icon'>error</i>" + text, duration, infoClasses);
    };
    var error = function(error, duration) {
        var err = error && error.toString();
        notify("<i class='red-text material-icons toast-icon'>error</i>" + err, duration, errorClasses);
    };
    var direction = function(info, ondismiss) {
        var el = $(document.createElement('div'));
        document.body.appendChild(el[0]);
        el.addClass('toast modal-direction');
        el.append("<span class='material-icons toast-icon blue-text'>info</span>");
        el.append("<div>" + info + '</div>');
        el.append("<button class='pl-15 material-icons'>close</button>");
        el.show();
        el.css('z-index', 999);
        M.anime({
            targets: el.toArray(),
            bottom: [-100, 0],
            opacity: [0.5, 1]
        });

        function dismiss() {
            M.anime({
                targets: el.toArray(),
                right: [0, -100],
                opacity: [1, 0],
                complete: function() {
                    el.remove();
                }
            });
        }
        if (!ondismiss) ondismiss = dismiss;
        el.children('button').click(ondismiss);
        return dismiss;
    };
    var ask = function(text, yes, no) {
        var answer = confirm(text);
        if (answer) {
            setImmediate(yes);
        } else {
            setImmediate(no);
        }
    };
    //First rule of maintainaibility,
    //hide ugliness from outsiders, this is the ugliness
    var modal = function(opts, ondismiss) {
        ondismiss = ondismiss ? safeCall(ondismiss) : noop;
        var el = opts.listEl;
        if (!el) {
            var header = [
                '<h6 class="modal-header">', opts.header, "</h6>",
                '<div class="modal-content">', opts.body || "", "</div>",
                (opts.footers ? "<div class='modal-footer'>" + opts.footers.map(function(e) {
                    return "<button class='btn modal-" + e
                        .toLowerCase()
                        .replace(/ /g, "_") + (1 == opts.footers.length ? " right" :
                            " center") +
                        "'>" + e + "</button>";
                }).join("") + "</div>" : "")
            ].join("");
            el = document.createElement(opts.form ? 'form' : 'div');
            el.id = genID("a");
            el.className = "modal modal-container";
            $(el).append(header);
            document.body.appendChild(el);
            $(el).find('.modal-cancel').click(function(e) {
                e.preventDefault();
                modalEl.modal('close');
            });
            if (opts.form) {
                require(["../ui/form"], function(mod) {
                    mod.Form.create(opts.form, el.getElementsByClassName(
                        'modal-content')[0]);
                });
                $(el).submit(false);
            }
        }

        var modalEl = $(el);
        if (!opts.footers) modalEl.addClass('modal-no-footer');
        var options = {
            centerY: !opts.large,
            inDuration: 50,
            outDuration: 100,
            dismissible: false //materialize does this horribly
        };
        options.onCloseEnd = function() {
            ondismiss();
            require("../core/navigation").Navigation.removeRoot(el);
            AutoCloseable.onCloseEnd.apply(this);
            if (this.$returnFocus) this.$returnFocus();
            if (!opts.keepOnClose) {
                modalEl.modal('destroy');
                modalEl.remove();
            }
        };
        options.onOpenStart = FocusManager.onModalOpen;
        options.onOpenEnd = function() {
            AutoCloseable.onOpenEnd.apply(this, arguments);
            require("../core/navigation").Navigation.addRoot(el, instance.close.bind(instance), true);
        };
        //set this after to avoid wierd key event trapping
        options.dismissible = opts.dismissible !== false;
        modalEl.modal(options);
        var instance = M.Modal.getInstance(el);
        instance.$preventDismiss = opts.dismissible === false;
        if (opts.autoOpen !== false) {
            modalEl.modal('open');
        }
        return el;
    };
    var inputDialog = null,
        input, promptText, changed, onchange, isOpen = false,
        queued = [];
    var ENTER = 13,
        ESC = 27;
    var Dropdown;
    var ondismiss, completer, returnFocus;
    var createInputDialog = function(caption, onchang, getValue, ondismis, complete) {
        if (!inputDialog) {
            var dialog = "<div class='modal-content'>" + "<div class='prompt-text'></div>" +
                "<input></input>" + "</div><div class='modal-footer modal-footer-2'>" +
                "<a href='#!' class='modal-cancel waves-effect waves-green btn-flat'>Cancel</a>" +
                "<a href='#!' class='modal-done waves-effect waves-green btn-flat'>Done</a>" + "</div>";
            var creator = document.createElement('div');
            creator.innerHTML = dialog;
            creator.className = 'modal modal-alert';
            creator.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            input = creator.getElementsByTagName('input')[0];
            input.addEventListener('keydown', function(e) {
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
            input.addEventListener('input', function() {
                if (completer) {
                    var data = completer.complete(this.value);
                    if (data.length) {
                        Dropdown.update(data);
                        Dropdown.show(this);
                    } else Dropdown.hide();
                }
            });
            Dropdown = new (require("../ui/dropdown").Dropdown)(true, "left");
            Dropdown.onclick = function(ev, id, element, item) {
                completer.update(input, item);
            };
            promptText = creator.getElementsByClassName('prompt-text')[0];
            var save = creator.getElementsByClassName('modal-done')[0];
            save.addEventListener('click', function() {
                changed = true;
                if (onchange(input.value) !== false) {
                    inputDialog.modal('close');
                } else input.focus();
            });
            var hide = creator.getElementsByClassName('modal-cancel')[0];
            hide.addEventListener('click', function() {
                inputDialog.modal('close');
            });
            document.body.appendChild(creator);
            inputDialog = $(creator).modal({
                centerY: true,
                onCloseStart: function() {
                    if (!changed && ondismiss) {
                        try {
                            ondismiss();
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    if (queued.length) {
                        setImmediate(function() {
                            changed = false;
                            var item = queued.shift();
                            inputDialog.modal('open');
                            completer = item.pop();
                            ondismiss = item.pop();
                            input.value = item.pop()() || "";
                            onchange = item.pop();
                            promptText.innerHTML = item.pop();
                        }, 20);
                    } else {
                        returnFocus();
                        Dropdown.hide();
                        isOpen = false;
                        completer = ondismiss = onchange = null;
                    }
                },
                onCloseEnd: AutoCloseable.onCloseEnd,
                onOpenEnd: AutoCloseable.onOpenEnd
            });
        }
        return {
            caption: caption,
            show: function() {
                if (!isOpen) {
                    isOpen = true;
                    changed = false;
                    inputDialog.modal('open');
                    promptText.innerHTML = caption;
                    input.value = getValue() || "";
                    returnFocus = FocusManager.visit(input, true);
                    //used because of prompt
                    FocusManager.hintNoChangeFocus();
                    ondismiss = ondismis;
                    onchange = onchang;
                    completer = complete;
                } else queued.push([caption, onchange, getValue, ondismiss, completer]);
            }
        };
    };
    var getText = function(text, func, defText, value_completer) {
        if (Array.isArray(value_completer)) {
            value_completer = value_completer.sort();
        }
        text = text.split("\n").join("</br>");
        var dialog = createInputDialog(text, func, function() {
            return defText;
        }, func, value_completer && (Array.isArray(value_completer) ? {
                complete: function(text) {
                    text = text.toLowerCase();
                    return value_completer.filter(function(e) {
                        return e.toLowerCase().indexOf(text) > -1;
                    });
                },
                update: function(input, text) {
                    return (input.value = text);
                }
            } :
            value_completer));
        dialog.show();
    };
    var pick = function(name, items, cb, ondismiss, footers) {
        require(["../ui/itemlist"], function(mod) {
            var list = new mod.ItemList('picker', items);
            list.containerClass = 'modal';
            list.headerText = name;
            list.footer = footers;
            list.createElement();
            list.$el.modal(require("../core/state_manager").AutoCloseable);
            list.render();
            list.on('select', function(e) {
                if (cb(e.item, e.index) !== false) {
                    list.$el.modal('close');
                    FocusManager.hintChangeFocus();
                    finish();
                }
            });
            list.current = null;
            var finish = FocusManager.visit(list.$receiver);
            return modal({
                listEl: list.el,
                dismissible: ondismiss !== false,
            }, ondismiss);
        });
    };
    exports.Notify = {
        notify: notify,
        error: error,
        dialog: createInputDialog,
        modal: modal,
        warn: warn,
        direct: direction,
        pick: pick,
        info: info,
        prompt: getText,
        ask: ask,
    };
}); /*_EndDefine*/