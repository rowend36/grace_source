define(function (require, exports, module) {
    'use strict';
    /*globals $*/
    //Bunch of useful stylings
    exports.styleCheckbox = function (el) {
        el = el.find('[type=checkbox]').addClass('checkbox');
        for (var i = 0; i < el.length; i++) {
            var a = el.eq(i);
            //The styling uses the before element of next span
            if (!a.next().is('span')) {
                a.after('<span></span>');
            }
            if (!a.next().is('.checkbox-track,.checkbox-filled-in')) {
                a.next().addClass('checkbox-track');
            }
        }
        el.next()
            .addClass('lever')
            .click(function (e) {
                $(this).prev().click();
                e.stopPropagation();
                e.preventDefault();
            });
    };
    var go = function (e) {
        var ENTER = 13;
        switch (e.keyCode) {
            case ENTER:
                $(this).trigger('go', e);
                break;
        }
    };

    //behaves like a form sort of
    exports.createSearch = function (input, button, onsearch) {
        $(button).on('click', onsearch);
        $(input).on('go', onsearch);
        $(input).on('keypress', go);
    };
    //create a table representing an object
    exports.tabulate = function table(data) {
        var str = "<table class='tabulate'>",
            i;
        for (i in data) {
            str +=
                '<tr><td>' +
                i +
                '</td><td>' +
                (data[i] && typeof data[i] == 'object'
                    ? table(data[i])
                    : data[i]) +
                '</td></tr>';
        }
        if (data && !i) str += data.toString ? data.toString() : 'Object';
        return str + '</table>';
    };
    //filenames - needed this ever since chrome started ignoring css rtl
    exports.styleClip = function (el) {
        el = $(el);
        var all = el.filter('.clipper');
        all.add(el.find('.clipper')).each(function (i, clipper) {
            var text = clipper.innerHTML;
            clipper.innerHTML = '';
            var chunks = [text];
            var t = chunks.length - 1;
            chunks.reverse().forEach(function (e, i) {
                var span = document.createElement('span');
                span.className = 'clipper-text';
                span.innerHTML = (i < t ? '/' : '') + e;
                clipper.appendChild(span);
            });
        });
    };
});