//Git Commands Configuration
define(function (require, exports, module) {
    var GitCommands = require("./git_commands").GitCommands;
    var appConfig = require("grace/core/config").Config.registerAll(
        null,
        "git"
    );
    var configure = require("grace/core/config").Config.configure;
    var Notify = require("grace/ui/notify").Notify;
    var forEach = require("grace/core/utils").Utils.asyncForEach;

    function doConfig(ev, prov, done) {
        var el = $(
            Notify.modal({
                header: "Authentication",
                form: [
                    {
                        type: "text",
                        name: "userName",
                        caption: "Username",
                        placeholder: "Leave empty",
                    },
                    {
                        type: "email",
                        name: "userEmail",
                        caption: "Email",
                    },
                    {
                        type: "password",
                        name: "userPass",
                        caption:
                            "Password (Passwords are stored as plain text. It is advised you use a personal access token.)",
                    },
                    "<span id='showPassword' class='material-icons text-icon'>visibility</span>",
                    {
                        type: "accept",
                        name: "saveToDisk",
                        caption: "Write details to git .config file",
                    },
                ],
                footers: ["Cancel", "Save"],
                dismissible: true,
            })
        );
        el.find("#showPassword").click(function () {
            el.find("#userPass").attr("type", "text");
            $(this)
                .hide()
                .finish()
                .delay(2000)
                .queue()
                .push(function () {
                    el.find("#userPass").attr("type", "password");
                    $(this).show();
                });
        });
        var config = {
            name: "gitUsername",
            password: "gitPassword",
            email: "gitEmail",
        };
        forEach(
            Object.keys(config),
            function (i, index, next) {
                if (!appConfig[config[i]]) {
                    prov.getConfig({
                        path: "user." + i,
                    })
                        .then(function (a) {
                            appConfig[config[i]] = a;
                        })
                        .finally(next);
                } else next();
            },
            function () {
                el.find("#userPass").val(appConfig.gitPassword);
                el.find("#userName").val(appConfig.gitUsername);
                el.find("#userEmail").val(appConfig.gitEmail);
            }
        );

        el.on("submit", function (e) {
            e.preventDefault();
            el.modal("close");
            if (
                done &&
                done({
                    email: el.find("#userEmail").val(),
                    username: el.find("#userName").val(),
                    password: el.find("#userPass").val(),
                }) == false
            ) {
                return;
            }
            configure("gitEmail", el.find("#userEmail").val(), "git", true);
            configure("gitPassword", el.find("#userPass").val(), "git", true);
            configure("gitUsername", el.find("#userName").val(), "git", true);
            if (el.find("#saveToDisk")[0].checked) {
                var dict = [
                    ["user.email", "gitEmail"],
                    ["user.password", "gitPassword"],
                    ["user.name", "gitUsername"],
                ];
                forEach(dict, function (p, i, next) {
                    prov.setConfig({
                        path: p[0],
                        value: appConfig[p[1]],
                    }).finally(next);
                });
            }
        });
    }
    GitCommands.doConfig = doConfig;
});
