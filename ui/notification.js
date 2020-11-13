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
    var ask = function(text,yes,no) {
        var answer = confirm(text);
        if(answer){
            setTimeout(yes);
        }
        else{
            setTimeout(no);
        }
    };
    var modal = function(opts,ondismiss){
        var header ="<div class='modal-content'>"+
        '<div class="hoverable modal-header h-30">'+
        opts.header+
        "</div class='modal-content'>"+
        opts.body+
        "</div>";
        var container = document.createElement("div");
        global.watchTheme($(container));
        container.className = "modal modal-container";
        container.innerHTML+=header;
        document.body.appendChild(container);
        var modalEl = $(container);
        var options = {
            inDuration: 100,
            outDuration: 50,
            dismissible:opts.dismissible!==false
        };
        if(options.dismissible){
            options.onCloseEnd = function(){
                ondismiss && ondismiss();
                AutoCloseable.onCloseEnd.apply(this);
                modalEl.modal('destroy');
                modalEl.detach();
            };
            options.onOpenEnd = AutoCloseable.onOpenEnd;
        }
        modalEl.modal(options);
        modalEl.modal('open');
        return container;
    };
    var getText = function(text,func){
        var answer = prompt(text);
        setTimeout(function(){
            func(answer);
        });
    };
    global.Notify = {
        notify:notify,
        error: warn,
        modal:modal,
        warn:warn,
        info:info,
        prompt: getText,
        ask:ask,
    };
})(Modules);