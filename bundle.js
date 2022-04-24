var MATCHER = /_Define\s*\(\s*function\(global\)\s*\{([\s\S]*?(?=\}\);?\s*\/\*_EndDefine\s*\*\/))\}\);?\s*\/\*_EndDefine\*\//gm;
var fs = require('fs');
var paths = require('path');
var root = '/sdcard/AppProjects/Flick/app/src/main/assets/';
var uglify = require('uglify-js');
var text = fs.readFileSync(root + 'index.html', 'utf8');
var Re = /\<script[^\>]*src\s*=\s*['"]([^'"]*)['"][^\>]*\>\s*\<\/script\>/g;
var moduleUrlHack = ";ace.config.set('basePath','./src-min-noconflict');";
var scriptBundle = "";

function iife(text) {
    MATCHER.lastIndex = 0;
    return text.replace(MATCHER, function(text, inner) {
        s = true;
        return "(function(global){" + inner + "})(GRACE);";
    });
}

function stripSpaces(text) {
    return text.replace(/[ \t]*(\n)[ \t]*/g, "\n").replace(/(\s)+/g, "$1");
}
var toHex = function(number) {
    var hex = "";
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    number = Math.floor(number) || 0;
    var base = chars.length;
    while (number > 0) {
        var quot = Math.floor(number / base);
        var rem = number - (quot * base);
        hex = chars[rem] + hex;
        number = quot;
    }
    return hex;
};
var bundleName = "bundle." + toHex(new Date().getTime()) + toHex(Math.random() * 1000) + ".min.js";
var bundle = text.replace(Re, function(match, path) {
    console.log(path);
    //we need eruda for now
    if (path.indexOf("eruda") > -1) return match;
    var text = fs.readFileSync(paths.resolve(root, path), 'utf8');
    var uglified = false;
    try {
        fs.unlinkSync(paths.resolve(root, path));
    } catch (e) {

    }
    if (!path.startsWith('./src-min-noconflict')) {
        //try to uglify
        if (!path.endsWith('.min.js')) {
            text = iife(text);
            try {
                text = uglify.minify(text, {
                    fromString: true
                }).code;
            } catch (e) {
                console.log(e);
                //failed to uglify, just strip spaces
                text = stripSpaces(text);
            }
        }
    }
    scriptBundle += ";" + text;
    if(path.startsWith("./src-min-noconflict/ace")){
        scriptBundle+=moduleUrlHack;
    }
    if (path == 'main.js') {
        return "<script src=\"./" + bundleName + "\" type=\"text/javascript\"></script>";
    }
    return "";
});
bundle = stripSpaces(bundle);
fs.writeFileSync(root + 'index.html', bundle);
fs.writeFileSync(root + bundleName, scriptBundle);
