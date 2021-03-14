_Define(function(global) {
    function createForm(form) {
        var el = document.createElement('form');
        for (var i in form) {
            var t = form[i];
            var caption = document.createElement('label');
            caption.innerText = t.caption;
            var input = document.createElement('input');
            input.setAttribute("type", t.type);
            input.setAttribute("name", t.name);
            input.setAttribute("value", t.value || "");
            el.appendChild(caption);
            el.appendChild(input);
        }
        return el;
    }

    function parseForm(form, e) {
        var params = [];
        for (var i = 0; i < e.children.length; i++) {
            var conf = e.children[i];
            if (conf.tagName == "INPUT") {
                params[conf.name] = conf.value;
            }
        }
        return params;
    }

    function validateForm(form, el) {

    }
    global.Form = {
        create: createForm,
        parse: parseForm,
        validate: validateForm,
    };
})/*_EndDefine*/