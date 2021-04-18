var fs = require('fs');
var paths = require('path');
var root = '/sdcard/AppProjects/Flick/app/src/main/assets/';
var uglify = require('uglify-js');
var text = fs.readFileSync(root + 'index.html', 'utf8');
var Re = /\<script[^\>]*src\s*=\s*['"]([^'"]*)['"][^\>]*\>\s*\<\/script\>/g;
var moduleUrlHack = ";ace.config.set('basePath','./src-min-noconflict');";

function stripSpace(text) {
    return text.replace(/^[ \t]+/gm, "");
}
var bundleText = "";
var bundle = text.replace(Re, function(match, path) {
    console.log(path);
    if (path.indexOf("eruda") > -1) return "";
    if (path.startsWith('./src-min-noconflict'))
        return match;
    var text = fs.readFileSync(paths.resolve(root, path), 'utf8');
    try {
        fs.unlinkSync(paths.resolve(root, path));
        if (!path.endsWith('.min.js'))
            text = uglify.minify(text, {
                fromString: true
            }).code;
    } catch (e) {
        console.log(e);
    }
    bundleText += ";" + text;
    if (path == 'main.js') {
        return "<script src=\"./bundle.js\" type=\"text/javascript\"></script>";
    }
    return "";
});
bundle = bundle.replace(/(\s)+/g,"$1");
fs.writeFileSync(root + 'index.html', bundle);
fs.writeFileSync(root + 'bundle.js', bundleText);