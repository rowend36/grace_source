(function(global) {
    var warningClasses = "red-text";
    var infoClasses = "blue";
    var AutoCloseable = global.AutoCloseable;
    var notify = function(text, duration, type) {
        M.toast({
            html: text,
            displayLength: duration,
            classes: type
        });
    };
    var warn = function(text, duration) {
        notify("<span class='material-icons'>warning</span>" + text,
            duration || (text.length > 100 ? 5000 : 2000), warningClasses);
    };
    var info = function(text, duration) {
        notify("<span class='white-text material-icons'>error</span>" + text,
            duration || (text.length > 100 ? 5000 : 2000), infoClasses);
    };
    var ask = function(text, yes, no) {
        var answer = confirm(text);
        if (answer) {
            setTimeout(yes);
        }
        else {
            setTimeout(no);
        }
    };
    var modal = function(opts, ondismiss) {
        var header = "<div class='modal-content'>" +
            '<div class="modal-header h-30">' +
            opts.header +
            "</div class='modal-content'>" +
            opts.body +
            "</div>";
        var container = document.createElement("div");
        global.watchTheme($(container));
        container.className = "modal modal-container";
        container.innerHTML += header;
        document.body.appendChild(container);
        var modalEl = $(container);
        var options = {
            inDuration: 100,
            outDuration: 50,
            dismissible: opts.dismissible !== false
        };
        if (options.dismissible) {
            options.onCloseEnd = function() {
                ondismiss && ondismiss();
                AutoCloseable.onCloseEnd.apply(this);
                modalEl.modal('destroy');
                modalEl.detach();
            };
            options.onOpenEnd = AutoCloseable.onOpenEnd;
        }
        else{
            options.onCloseEnd = function() {
                ondismiss && ondismiss();
                modalEl.modal('destroy');
                modalEl.detach();
            };
        }
        modalEl.modal(options);
        global.FocusManager.focusIfKeyboard(modalEl, true);
        modalEl.modal('open');
        return container;
    };
    var getTextNative = function(text, func) {
        var answer = prompt(text);
        setTimeout(function() {
            func(answer);
        });
    };
    var inputDialog = null,
        input, header, changed, onchange, isOpen = false,
        queued = [];
    var ENTER = 13,
        ESC = 27;
    var Dropdown;
    var ondismiss, completer;
    var createInputDialog = function(caption, onchang, getValue, ondismis, complete) {
        if (!inputDialog) {
            var dialog = "<h6 class='modal-header'></h6>" +
                "<div class='modal-content'>" +
                "<input></input>" +
                "</div><div class='modal-footer'>" +
                "<a href='#!' class='modal-close waves-effect waves-green btn-flat'>Cancel</a>" +
                "<a href='#!' class='modal-done waves-effect waves-green btn-flat'>Done</a>" +
                "</div>";
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
                        }
                        break;
                    case 8:
                        if (completer) {
                            var data = completer.complete(this.value);
                            if (data.length) {
                                Dropdown.update(data);
                                Dropdown.show(this);
                            }
                            else Dropdown.hide();
                        }
                }
            });
            input.addEventListener('input', function(e) {
                if (completer) {
                    var data = completer.complete(this.value);
                    if (data.length) {
                        Dropdown.update(data);
                        Dropdown.show(this);
                    }
                    else Dropdown.hide();
                }
            });
            Dropdown = new global.Overflow(null, null, true, "left");
            Dropdown.onclick = function(ev, id, element, item) {
                input.value = item;
            };
            header = creator.getElementsByClassName('modal-header')[0];
            var save = creator.getElementsByClassName('modal-done')[0];
            save.addEventListener('click', function() {
                changed = true;
                if (onchange(input.value) !== false) {
                    inputDialog.modal('close');
                }
            });
            document.body.appendChild(creator);
            inputDialog = $(creator).modal({
                onCloseStart: function() {
                    if (!changed && ondismiss)
                        ondismiss();
                    if (queued.length) {
                        setTimeout(function() {
                            changed = false;
                            var item = queued.shift();
                            inputDialog.modal('open');
                            completer = item.pop();
                            ondismiss = item.pop();
                            input.value = item.pop()() || "";
                            onchange = item.pop();
                            header.innerHTML = item.pop();
                        }, 20);
                    }
                    else {
                        isOpen = false;
                        completer =
                            ondismiss =
                            onchange = null;
                    }
                },
                onCloseEnd: AutoCloseable.onCloseEnd,
                onOpenEnd: AutoCloseable.onOpenEnd
            });
        }
        return {
            caption: caption,
            onclick: function() {
                if (!isOpen) {
                    isOpen = true;
                    changed = false;
                    inputDialog.modal('open');
                    header.innerHTML = caption;
                    input.value = getValue() || "";
                    input.focus();
                    ondismiss = ondismis;
                    onchange = onchang;
                    completer = complete;
                }
                else queued.push([caption, onchange, getValue, ondismiss, completer]);
            }
        };
    };

    var getText = function(text, func, defText, values) {
        if(values){
            values = values.map(function(e){
                return e.toLowerCase();
            }).sort()
        }
        text = text.split("\n").join("</br>")
        var dialog = createInputDialog(text, func, function() {
            return defText;
        }, func, values && {
            complete: function(text) {
                text = text.toLowerCase();
                return values.filter(function(e) {
                    return e.indexOf(text) > -1;
                });
            }
        });
        dialog.onclick();
    };

    global.Notify = {
        notify: notify,
        error: warn,
        modal: modal,
        warn: warn,
        info: info,
        prompt: getText,
        ask: ask,
    };
})(Modules);