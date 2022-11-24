define(function (require, exports, module) {
    /*globals Base64*/
    require("grace/libs/js/base64");
    var Notify = require("grace/ui/notify").Notify;
    var table = require("grace/ui/ui_utils").tabulate;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var Fileviews = require("grace/ext/fileview/fileviews").Fileviews;

    function preview(ondismiss) {
        return Notify.modal(
            {
                body: "<div class='preview-content'></div>",
            },
            ondismiss
        ).getElementsByClassName("preview-content")[0];
    }
    var ONE_MB = require("grace/core/utils").Utils.parseSize("1mb");

    function previewImage(ev) {
        var url;
        var a = preview(function () {
            img = null;
            if (url) {
                URL.revokeObjectURL(url);
            }
        });

        var img = document.createElement("img");
        a.appendChild(img);
        img.style.maxWidth = "100%";
        img.style.minWidth = "30px";
        img.style.margin = "auto";
        var meta = document.createElement("div");
        a.appendChild(meta);

        var data = {
            name: ev.filepath,
        };
        meta.innerHTML = table(data);
        img.onload = function () {
            data.width = img.naturalWidth;
            data.height = img.naturalHeight;
            meta.innerHTML = table(data);
        };
        if (ev.fs.href) {
            img.src = FileUtils.join(ev.fs.href, encodeURI(ev.filepath));
        } else {
            ev.fs.readFile(ev.filepath, function (e, res) {
                if (e) Notify.error(e);
                if (img) {
                    if (!res.buffer) res = new Uint8Array(res);
                    if (res.length < ONE_MB) {
                        img.src =
                            "data:image/" +
                            require("grace/core/file_utils").FileUtils.extname(
                                ev.filepath
                            ) +
                            ";base64," +
                            Base64.encode(res);
                    } else {
                        url = URL.createObjectURL(new Blob([res]));
                        img.src = url;
                    }
                }
            });
        }
    }

    function createFontFace(path, type, img) {
        var id = require("grace/core/utils").Utils.genID("ff");
        var style = document.createElement("style");
        style.id = id;
        style.innerHTML = [
            "@font-face {",
            "font-family: " + '"' + id + '"' + ";",
            "src: url(" +
                '"' +
                path +
                '"' +
                ") format(" +
                '"' +
                type +
                '"' +
                ");",
            "}",
        ].join("\n");
        document.head.appendChild(style);
        img.style.fontFamily = id;
        img.innerText =
            "ABCDEFGHIJKLMONOPQRSTUVWXYZ\nabcdefghijklmonopqrstuvwxyz\n012345789\n[]{}|_-`~:;%$#*()!";

        return id;
    }

    function deleteFontFace(id) {
        var a = document.getElementById(id);
        a.remove();
    }
    var mimes = {
        ttf: "truetype",
        otf: "truetype",
        woff: "woff",
    };

    function previewFont(ev) {
        var mime =
            mimes[
                require("grace/core/file_utils").FileUtils.extname(ev.filepath)
            ];
        var url, font;
        var a = preview(function () {
            img = null;
            if (url) {
                URL.revokeObjectURL(url);
            }
            deleteFontFace(font);
        });

        var img = document.createElement("textarea");
        img.style.whiteSpace = "pre-wrap";
        img.className = "border-secondary";
        img.innerText = "<<<<loading<<<<<";
        a.appendChild(img);
        img.style.width = "100%";
        img.style.minHeight = "10em";
        img.style.margin = "auto";
        var meta = document.createElement("div");
        a.appendChild(meta);
        var data = {
            name: ev.filepath,
        };
        meta.innerHTML = table(data);
        if (ev.fs.href) {
            font = createFontFace(
                FileUtils.join(ev.fs.href, encodeURI(ev.filepath)),
                mime,
                img
            );
        } else {
            ev.fs.readFile(ev.filepath, function (e, res) {
                if (img) {
                    if (!res.buffer) res = new Uint8Array(res);
                    if (res.length < ONE_MB) {
                        font = createFontFace(
                            "data:application/binary" +
                                require("grace/core/file_utils").FileUtils.extname(
                                    ev.filepath
                                ) +
                                ";base64," +
                                Base64.encode(res),
                            mime,
                            img
                        );
                    } else {
                        url = URL.createObjectURL(new Blob([res]));
                        font = createFontFace(url, mime, img);
                    }
                }
            });
        }
    }

    function previewVideo(ev, isAudio) {
        var url;
        var a = preview(function () {
            img = null;
            if (url) {
                URL.revokeObjectURL(url);
            }
        });

        var img = document.createElement(isAudio ? "audio" : "video");
        img.setAttribute("controls", "true");
        a.appendChild(img);
        img.style.maxWidth = "100%";
        img.style.minWidth = "30px";
        img.style.margin = "auto";
        var meta = document.createElement("div");
        a.appendChild(meta);

        var data = {
            name: ev.filepath,
        };
        meta.innerHTML = table(data);
        img.addEventListener("loadedmetadata", function () {
            if (!isAudio) {
                data.width = img.videoWidth;
                data.height = img.videoHeight;
            }
            data.duration = img.duration;
            meta.innerHTML = table(data);
        });
        if (ev.fs.href) {
            img.src = FileUtils.join(ev.fs.href, encodeURI(ev.filepath));
        } else {
            ev.fs.readFile(ev.filepath, function (e, res) {
                if (img) {
                    url = URL.createObjectURL(new Blob([res]));
                    img.src = url;
                }
            });
        }
    }

    function previewAudio(ev) {
        previewVideo(ev, true);
    }
    var previewers = {
        jpg: previewImage,
        png: previewImage,
        gif: previewImage,
        jpeg: previewImage,
        mp4: previewVideo,
        "3gp": previewVideo,
        mp3: previewAudio,
        ogg: previewAudio,
        midi: previewAudio,
        ttf: previewFont,
        otf: previewFont,
        woff: previewFont,
        woff2: previewFont,
    };
    Fileviews.on("pick-file", function (ev) {
        if (FileUtils.isBinaryFile(ev.filename)) {
            var ext = FileUtils.extname(ev.filename).toLowerCase();
            if (previewers[ext]) {
                ev.preventDefault();
                previewers[ext](ev);
            }
        }
    });
});