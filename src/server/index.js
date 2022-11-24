var fs = require("fs");
var express = require("express");
var path = require("path");
var debug_static = require("./lib//static");
var urlencoded = require("body-parser").urlencoded;
var corsProxy = require("@isomorphic-git/cors-proxy/middleware.js");
var passwords = require("./lib/passwords");
var doError = require("./lib/error");
var exec = require("child_process").exec;

//Parse commandline arguments
var port = parseInt(process.env.GRACE_PORT) || 0,
    isHelp = false,
    useHttps = false,
    launch = false,
    assetsFolder = path.resolve(__dirname, "../../dist/");

parseCLIOptions(process.argv);
if (isHelp) process.exit();

//Setup Server
var app = express();
//Hosting
var sendHtml = function (res, html) {
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Length", Buffer.byteLength(html));
    res.end(html);
};

app.get("/", function (req, res) {
    sendHtml(res, fs.readFileSync(path.resolve(assetsFolder, "index.html")));
});

//Setup for Cross origin requests
var allowedOrigins = [
    "http://grace.androidplatform.net",
    "https://grace.androidplatform.net",
    "https://files.androidplatform.net",
    "http://files.androidplatform.net",
    "file://",
    /https?:\/\/192\.168\.43.*/,
    // "http://www.apirequest.io",
];
var cors = require("cors")(function (req, cb) {
    cb(null, {
        allowedMethods: ["GET", "POST"],
        origin: req.headers.origin ? allowedOrigins : "*",
    });
});
app.use(cors);
//Git
app.use("/git", corsProxy());
app.get("/*", debug_static.static(assetsFolder, "/root/"));

//HTTP FS needs password
app.use(passwords.middleware);
app.use(urlencoded({extended: true}));
const routes = {
    files: require("./api/files"),
    new: require("./api/new"),
    copy: require("./api/copy"),
    info: require("./api/info"),
    "copy-folder": require("./api/copyFolder"),
    fastGetOid: require("./api/fastGetOid"),
    move: require("./api/move"),
    rename: require("./api/rename"),
    encodings: require("./api/encodings"),
    run: require("./api/run"),
    delete: require("./api/delete"),
    open: require("./api/open"),
    save: require("./api/save"),
    "root/*": debug_static.static(assetsFolder, "/root/"),
    "test/*": function (req, res) {
        res.status(parseInt(req.url.replace("/test/", "") || 200));
        res.json({url: req.url, headers: req.headers, body: req.body});
        res.end();
    },
};
for (var i in routes) {
    app.post("/" + i, routes[i]);
}
// custom 500 page
app.use(function (err, req, res, next) {
    console.error("500 " + err.message + "\n" + err.stack);
    doError({code: "EUNKNOWN"}, res);
});

function parseCLIOptions(args) {
    for (var i = 2; i < args.length && !isHelp; i++) {
        switch (args[i]) {
            case "--port":
                port = parseInt(args[++i]);
                continue;
            case "-p":
            case "--pass":
                passwords.setPassword(String(args[++i]));
                continue;
            case "-d":
            case "--devel":
                assetsFolder = path.resolve(__dirname, "../client/");
                break;
            case "-b":
            case "--browser":
                launch = true;
                break;
            case "--https":
                useHttps = true;
                continue;
            case "--help":
            case "-h":
                isHelp = true;
            /*falls through*/
            default:
                if (!isHelp) {
                    isHelp = true;
                    console.error("Unknown option " + args[i]);
                }
                console.log(
                    "Usage server.js [-p|--port PORT][--pass PASSWORD][--https][-d|--devel][-b|--browser]\n" +
                        "Start a Grace server from specified PORT using PASSWORD with optional https.\n" +
                        "If --devel, load files directly from source as opposed to from build output.\n" +
                        "If --browser, launch default browser"
                );
                break;
        }
    }
}
//Start server
var server;
if (useHttps) {
    var fs = require("fs");
    var https = require("https");
    var privateKey = fs.readFileSync(
        path.resolve(__dirname, "./keys/selfsigned.key"),
        {encoding: "utf8"}
    );
    var certificate = fs.readFileSync(
        path.resolve(__dirname, "./keys/selfsigned.crt"),
        {encoding: "utf8"}
    );
    var credentials = {
        key: privateKey,
        cert: certificate,
    };
    // your express configuration here
    server = https.createServer(credentials, app);
} else {
    var http = require("http");
    server = http.createServer(app);
}
var address;
server.listen(port || 0, function () {
    address =
        (useHttps ? "https" : "http") + "://localhost:" + server.address().port;
    allowedOrigins.unshift(address);
    if (launch) exec("xdg-open " + address);
    console.log(
        "Grace express file server started on " +
            address +
            "; press Ctrl-C to terminate."
    );
});
