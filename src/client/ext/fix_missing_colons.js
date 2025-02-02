define(function(require,exports,module) {
    var Actions = require("grace/core/actions").Actions;
    var defaultProvider = function(editor, range) {
        var begin = range ? range.start.row : 0;
        var end = range ? range.end.row : Infinity;
        var endC = range ? range.end.column : Infinity;
        var spark = [];
        var anno = editor.session.getAnnotations();
        for (var i = anno.length - 1; i >= 0; i--) {
            if ((anno[i].row >= begin && (anno[i].row < end || (anno[i].row == end && anno[i].column <
                    endC))) && anno[i].raw == "Missing semicolon.") {
                end = anno[i].row;
                endC = anno[i].column;
                spark.push(anno[i]);
            }
        }
        return spark;
    };
    var fixMissingSemicolons = function(editor, interactive) {
        var range = editor.getSelectionRange();
        if (range.start.row == range.end.row) {
            range = null;
        }
        var spark = (editor.session.getMode().getMissingColons || defaultProvider)(editor.session, range);
        if (!interactive) {
            editor.session.markUndoGroup(); // start new undo group
            for (var j in spark) {
                editor.session.insert(spark[j], ";");
            }

            return spark.length;
        }

        var cursor = Object.assign({}, editor.getSelection().cursor);
        var timeout;
        var stop = function(ev) {
            clearTimeout(timeout);
            if (!ev)
                editor.gotoLine(cursor.row + 1, cursor.column);
            window.removeEventListener('click', stop);
        };
        window.addEventListener('click', stop);

        var fix = function() {
            var p = spark.shift();
            if (p) {
                editor.gotoLine(p.row + 1, p.column);
                editor.insert(";");
                timeout = setTimeout(fix, interactive.speed || 100);
            } else {
                stop();
            }
        };
        fix();
    };
    Actions.addAction({
        name: "Fix missing semicolons",
        exec: fixMissingSemicolons,
        isAvailable: function(editor) {
            return editor.session.getMode().getMissingColons ||
                editor.session.getMode().$id == "ace/mode/javascript";
        }
    });
}); /*_EndDefine*/