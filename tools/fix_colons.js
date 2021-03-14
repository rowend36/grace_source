_Define(function(global) {
    var Editors = global.Editors;
    var defaultProvider = function(editor, range) {
        var begin = range ? range.start.row : 0;
        var end = range ? range.end.row : Infinity;
        var spark = [];
        var anno = editor.getAnnotations();
        for (var i = anno.length - 1; i >= 0; i--) {
            if (anno[i].row >= begin && anno[i].row < end && anno[i].raw == "Missing semicolon.") {
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
        
        var cursor = Object.assign({},editor.getSelection().cursor);
        var timeout;
        var stop = function(ev) {
            clearTimeout(timeout);
            if (!ev)
                editor.gotoLine(cursor.row+1, cursor.column);
            window.removeEventListener('click', stop);
        };
        window.addEventListener('click', stop);

        var fix = function() {
            var p = spark.shift();
            if (p) {
                editor.gotoLine(p.row+1, p.column);
                editor.insert(";");
                timeout = setTimeout(fix, interactive.speed || 100);
            }
            else {
                stop();
            }
        };
        fix();
    };
    Editors.addCommands({
        name: "fix missing semicolons",
        exec: fixMissingSemicolons
    });
})/*_EndDefine*/