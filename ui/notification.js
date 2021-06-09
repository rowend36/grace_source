_Define(function(global) {
    var warningClasses = "red-text";
    var infoClasses = "blue";
    var errorClasses = "red";
    var AutoCloseable = global.AutoCloseable;
    var setImmediate = global.Utils.setImmediate;
    var noop = global.Utils.noop;
    var safeCall = global.Utils.withTry;
    var pending = [];
    var active = M.Toast._toasts;
    var genID = global.Utils.genID;

    function doPending() {
        if (pending.length > 0) M.toast(pending.pop());
    }
    var suppressed = false;
    var clearSuppressed = global.Utils.debounce(function() {
        suppressed = false;
    }, 200);
    var notify = function(text, duration, type) {
        var opts = {
            html: text,
            displayLength: duration,
            completeCallback: doPending,
        };
        if (active.length < 2) {
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
            console.log(text);
        } else pending.push(opts);
    };
    var warn = function(text, duration) {
        notify("<i class='orange-text material-icons toast-icon'>warning</i>" + text, duration || (text.length > 100 ? 5000 : 2000), warningClasses);
    };
    var info = function(text, duration) {
        notify("<i class='white-text material-icons toast-icon'>error</i>" + text, duration || (text.length > 100 ? 5000 : 2000), infoClasses);
    };
    var error = function(text, duration) {
        notify("<i class='red-text material-icons toast-icon'>error</i>" + text, duration || (text.length > 100 ? 5000 : 2000), errorClasses);
    };
    var ask = function(text, yes, no) {
        var answer = confirm(text);
        if (answer) {
            setImmediate(yes);
        } else {
            setImmediate(no);
        }
    };
    var modal = function(opts, ondismiss) {
        ondismiss = ondismiss ? safeCall(ondismiss) : noop;
        var header = [
            '<h6 class="modal-header h-30">', opts.header,"</h6>",
            '<div class="modal-content">',opts.body,"</div>",
            (opts.footers ? "<div class='modal-footer'>" + opts.footers.map(function(e) {
            return "<button style='margin-right:10px' class='btn modal-" + e.toLowerCase().replace(/ /g, "_") + (1 == opts.footers.length ? " right" : " center") + "'>" + e + "</button>";
        }).join("") + "</div>" : "")].join("");
        var container = document.createElement(opts.type||'div');
        container.id = genID("a");
        global.watchTheme($(container));
        container.className = "modal modal-container";
        container.innerHTML += header;
        document.body.appendChild(container);
        var modalEl = $(container);
        var options = {
            inDuration: 50,
            outDuration: 200,
            dismissible: opts.dismissible !== false
        };
        if (options.dismissible) {
            options.onCloseEnd = function() {
                ondismiss();
                AutoCloseable.onCloseEnd.apply(this);
                if (!opts.keepOnClose) {
                    modalEl.modal('destroy');
                    modalEl.remove();
                }
            };
            options.onOpenEnd = AutoCloseable.onOpenEnd;
        } else {
            options.onCloseEnd = function() {
                ondismiss();
                if (!opts.keepOnClose) {
                    modalEl.modal('destroy');
                    modalEl.remove();
                }
            };
        }
        modalEl.modal(options);
        if (opts.autoOpen !== false) {
            global.FocusManager.hintChangeFocus();
            modalEl.modal('open');
        }
        return container;
    };
    var getTextNative = function(text, func) {
        var answer = prompt(text);
        setImmediate(function() {
            func(answer);
        });
    };
    var inputDialog = null,
        input, header, changed, onchange, isOpen = false,
        queued = [];
    var ENTER = 13,
        ESC = 27;
    var Dropdown;
    var ondismiss, completer, returnFocus;
    var createInputDialog = function(caption, onchang, getValue, ondismis, complete) {
        if (!inputDialog) {
            var dialog = "<h6 class='modal-header'></h6>" + "<div class='modal-content'>" + "<input></input>" + "</div><div class='modal-footer'>" + "<a href='#!' class='modal-close waves-effect waves-green btn-flat'>Cancel</a>" +
                "<a href='#!' class='modal-done waves-effect waves-green btn-flat'>Done</a>" + "</div>";
            var creator = document.createElement('div');
            creator.innerHTML = dialog;
            creator.className = 'modal';
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
            input.addEventListener('input', function(e) {
                if (completer) {
                    var data = completer.complete(this.value);
                    if (data.length) {
                        Dropdown.update(data);
                        Dropdown.show(this);
                    } else Dropdown.hide();
                }
            });
            Dropdown = new global.Overflow(true, "left");
            Dropdown.onclick = function(ev, id, element, item) {
                completer.update(input, item);
            };
            header = creator.getElementsByClassName('modal-header')[0];
            var save = creator.getElementsByClassName('modal-done')[0];
            save.addEventListener('click', function() {
                changed = true;
                if (onchange(input.value) !== false) {
                    inputDialog.modal('close');
                } else input.focus();
            });
            document.body.appendChild(creator);
            inputDialog = $(creator).modal({
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
                            header.innerHTML = item.pop();
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
                    header.innerHTML = caption;
                    input.value = getValue() || "";
                    returnFocus = global.FocusManager.visit(input, true);
                    //useed because of prompt
                    global.FocusManager.hintNoChangeFocus();
                    ondismiss = ondismis;
                    onchange = onchang;
                    completer = complete;
                } else queued.push([caption, onchange, getValue, ondismiss, completer]);
            }
        };
    };
    var getText = function(text, func, defText, value_completer) {
        if (Array.isArray(value_completer)) {
            value_completer = value_completer.sort()
        }
        text = text.split("\n").join("</br>")
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
                    return input.value=text;
                }
            } :
            value_completer));
        dialog.show();
    };
    global.Notify = {
        notify: notify,
        error: error,
        dialog: createInputDialog,
        modal: modal,
        warn: warn,
        info: info,
        prompt: getText,
        ask: ask,
    };
}) /*_EndDefine*/