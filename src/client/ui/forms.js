define(function (require, exports, module) {
    /*globals $*/
    var sentenceCase = require("../core/utils").Utils.sentenceCase;
    var noop = require("../core/utils").Utils.noop;

    function createForm(form, el) {
        el = el || document.createElement("form");
        for (var i in form) {
            var t = form[i];
            createElement(t, el);
        }
        require("./ui_utils").styleCheckbox($(el));
        return el;
    }

    function createElement(t, el) {
        if (typeof t == "string") {
            var p = document.createElement("span");
            p.innerHTML = t;
            el.appendChild(p);
            return;
        }
        var input;
        if (t.type == "div") {
            input = document.createElement("div");
        } else
            input = document.createElement(
                t.type == "select" ? "select" : "input"
            );
        if (t.id) throw new Error("Extraneous property id, do you mean name?");
        if (t.name) {
            input.setAttribute("name", t.name);
            input.id = t.name;
        }
        if (t.className) input.className += " " + t.className;
        switch (t.type) {
            case "div":
                el.appendChild(input);
                createForm(t.children, input);
                break;
            case "text":
            case "select":
            case "email":
            case "password":
            case "number":
            case "search":
                var caption = document.createElement("label");
                caption.innerText = t.caption;
                el.appendChild(caption);
                input.setAttribute("value", t.value || "");
                input.setAttribute("type", t.type);
                el.appendChild(input);
                if (!t.name) throw new Error("Missing property name");
                if (t.type == "select") {
                    input.className += " label-select";
                    var clearfix = document.createElement("div");
                    clearfix.className = "clearfix";
                    el.appendChild(clearfix);
                    clearfix.className += " mb-10";
                } else input.className += " mb-10";
                break;
            case "submit":
            case "button":
                var btn = input;
                btn.style.margin = "10px 10px 5px 0";
                btn.className += " btn btn-small";
                btn.setAttribute("value", t.caption || sentenceCase(name));
                btn.setAttribute("type", t.type);
                if (t.onclick) $(btn).on("click", t.onclick);
                el.appendChild(btn);
                break;
            case "accept":
            case "checkbox":
                if (!t.name) throw new Error("Missing property name");
                var wrapper = document.createElement("div");
                wrapper.className = " mb-10";
                input.setAttribute("type", "checkbox");
                input.checked = !!t.value;
                var span = document.createElement(
                    t.type === "checkbox" ? "span" : "label"
                );
                span.innerText = t.caption;
                span.className += " label";
                if (t.type == "checkbox") {
                    wrapper.appendChild(input);
                    wrapper.appendChild(span);
                } else {
                    span.setAttribute("for", t.name);
                    wrapper.appendChild(span);
                    wrapper.appendChild(input);
                    wrapper.className += " edge_box-1";
                    var filledIn = document.createElement("span");
                    filledIn.className = " side-1 checkbox-filled-in";
                    input.className = "side-1";
                    filledIn.style.paddingLeft = "25px";
                    filledIn.style.width = "25px";
                    wrapper.appendChild(filledIn);
                }
                el.appendChild(wrapper);
                break;
            default:
                throw "Unknown type " + t.type;
        }
    }

    function parseForm(e) {
        var params = {};
        var children = $(e).find("input,select");
        for (var i = 0; i < children.length; i++) {
            var conf = children[i];
            params[conf.name] =
                conf.type == "checkbox" ? conf.checked : conf.value;
        }
        if (i == 0) throw "Cannot parse empty form";
        return params;
    }

    exports.Forms = {
        create: createForm,
        parse: parseForm,
        validate: noop,
    };
}); /*_EndDefine*/