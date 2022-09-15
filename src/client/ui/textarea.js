define(function(require,exports,module) {
    //make this accessible to modkeyinput and enhanced clipboard
    var InvisibleTextArea = function(el) {
        var receiver = document.createElement('textarea');
        receiver.className = 'keyboard-listener';
        receiver.value = "-";
        receiver.setAttribute('tabIndex', -1);
        receiver.setAttribute('rows', 1000);
        receiver.style.opacity = 0;
        receiver.style.position = 'fixed';
        receiver.style.width = '2px';
        receiver.style.height = '2px';
        receiver.style.overflow = 'hidden';
        receiver.setAttribute("autocomplete", "off");
        receiver.setAttribute("name", require("../core/utils").Utils.genID("qt"));
        el.appendChild(receiver);
        return receiver;
    };
    exports.InvisibleTextArea = InvisibleTextArea;
});