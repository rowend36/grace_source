define(function(require,exports,module) {
    var appConfig = require("grace/core/config").Config.registerAll({
            useColorIcons: true,
        },
        "files"
    );
    require("grace/core/config").ConfigEvents.on("application", function(e) {
        if (e.config == "useColorIcons") {
            update();
        }
    });
    var file_colors = (exports.FileIconClasses = {
        html: "orange",
        js: "green",
        css: "blue",
        sass: "pink",
        c: "text-darken-3 cyan",
        cpp: "text-darken-1 cyan",
        h: "text-lighten-1 cyan",
        hpp: "text-lighten-3 cyan",
        less: "pink",
        py: "text-lighten-1 purple",
        java: "yellow",
        json: "text-darken-3 green",
        pdf: "red",
        doc: "lighten-2 red",
        docx: "lighten-2 red",
        md: "text-darken-1 orange",
        jsx: "text-lighten-1 green",
        tsx: "text-lighten-1 amber",
        ts: "amber",
        ttf: "blue-grey",
        m: "text-lighten-1 blue",
        png: "text-darken-2 blue",
        jpg: "text-darken-2 blue",
        otf: "blue-grey",
        mp4: "default",
        mp3: "default",
        eot: "blue-grey",
        svg: "",
        woff: "blue-grey",
        woff2: "blue-grey",
    });
    var icons = {
        file: "insert_drive_file",
        back: "reply",
        folder: "folder",
        // folder_open: "folder_open",
        // folder_close: "folder",
        folder_close: "keyboard_arrow_right",
        folder_open: "keyboard_arrow_down",
    };
    var ext = require("grace/core/file_utils").FileUtils.extname;
    var OldIcons = {
        renderHTML: function(icon, name, cls) {
            if (icon.startsWith('folder_')) {
                cls = (cls ? cls + " " : "") + "folder-icon";
            }
            return (
                "<i class='material-icons " +
                (cls || "") +
                " " +
                (name ? file_colors[ext(name)] || "" : "") +
                "-text'>" +
                icons[icon] +
                "</i>"
            );
        },
        renderEl: function(el, icon, name, cls) {
            if (icon.startsWith('folder_')) {
                cls = (cls ? cls + " " : "") + "folder-icon";
            }
            return el
                .css("background-image", "none")
                .addClass("material-icons")
                .addClass(cls || "")
                .addClass((name ? file_colors[ext(name)] || "" : "") + "-text")
                .text(icons[icon]);
        },
    };
    var allIcons = [
        "actionscript",
        "ai",
        "angular",
        "apache",
        "applescript",
        "archive",
        "bookmark",
        "bower",
        "c#",
        "c",
        "cfc",
        "cfm",
        "clojure",
        "coffescript",
        "cpp",
        "css",
        "default",
        "dlang",
        "doc",
        "docker",
        "ejs",
        "erlang",
        "ex",
        "font",
        "gear",
        "git",
        "go",
        "gradle",
        "graphviz",
        "groovy",
        "gruntfile",
        "gulpfile",
        "haml",
        "haskell",
        "haxe",
        "html",
        "image",
        "jade",
        "java",
        "js",
        "json",
        "jsp",
        "laravel",
        "less",
        "license",
        "liquid",
        "lisp",
        "list",
        "lua",
        "markdown",
        "markup",
        "matlab",
        "mustache",
        "node",
        "npm",
        "ocaml",
        "pdf1",
        "pdf",
        "perl",
        "php",
        "ppt1",
        "ppt",
        "procfile",
        "psd",
        "puppet",
        "python",
        "R",
        "rails",
        "react",
        "ruby",
        "rust",
        "sass",
        "scala",
        "scss",
        "shell",
        "slim",
        "smiley",
        "source",
        "sql",
        "ssh",
        "stylus",
        "swift",
        "tcl",
        "tex",
        "text",
        "textile",
        "todo",
        "twig",
        "typescript",
        "vue",
        "xls1",
        "xls",
        "yaml",
    ];
    var map = {
        jsx: "react",
        tsx: "typescript",
        ts: "typescript",
        py: "python",
        ttf: "font",
        "package.json": "npm",
        m: "matlab",
        jar: "archive",
        zip: "archive",
        png: "image",
        jpg: "image",
        otf: "font",
        mp4: "default",
        mp3: "default",
        eot: "font",
        svg: "source",
        woff: "font",
        woff2: "font",
    };
    var NewIcons = {
        renderHTML: function(icon, name, cls) {
            if (icon.startsWith('folder')) {
                return OldIcons.renderHTML(icon, name, cls);
            }
            return (
                "<i class=' file2x " +
                (cls || "") +
                "' style='background-image:url(libs/icons/files2x/file-" +
                (allIcons.indexOf(ext(name)) > -1 ?
                    ext(name) :
                    map[name] || map[ext(name)] || "text") +
                ".png)'></i>"
            );
        },
        renderEl: function(el, icon, name, cls) {
            if (icon.startsWith('folder')) {
                return OldIcons.renderEl(el, icon, name, cls);
            }
            el.addClass("file2x")
                .addClass(cls || "")
                .css(
                    "backgroundImage",
                    "url(libs/icons/files2x/file-" +
                    (allIcons.indexOf(ext(name)) > -1 ?
                        ext(name) :
                        map[name] || map[ext(name)] || "text") +
                    "@2x.png)"
                )
                .text("");
        },
    };
    exports.FileIcons = {};

    function update() {
        if (appConfig.useColorIcons) {
            Object.assign(exports.FileIcons, OldIcons);
        } else Object.assign(exports.FileIcons, NewIcons);
    }
    update();
});
