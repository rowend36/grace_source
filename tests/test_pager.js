var pedit, edit, splitEdit, firstEdit, mainEditor;
    firstEdit = global.getMainEditor();
    firstEdit.id = 'main';
    var doc = global.getActiveDoc();
    var numClones = 0;
    var tests = [
        function() {
            Editors.$focusEditor(firstEdit);
            edit = mainEditor = firstEdit;
        },
        function() {
            pedit = edit = Editors.createEditor(new DocumentFragment(), true);
            pedit.id = 'plugin';
            edit.hostEditor = mainEditor;
            Editors.$focusEditor(edit);
        },
        function() {
            edit.$setActive();
        },
        function() {
            mainEditor.$setActive();
            edit = mainEditor;
        },
        function() {
            mainEditor.execCommand('Add Split');
            mainEditor = splitEdit = edit = global.getEditor();
            splitEdit.id = 'split';
            numClones++;
        },function() {
            mainEditor.execCommand('Add Split');
            var tempEdit =  global.getEditor();
            tempEdit.execCommand('Remove Split');
            edit = mainEditor = firstEdit;
        },
        function() {
            pedit.$setActive();
            mainEditor = firstEdit;
            edit = pedit;
        },
    ];
    function run(infer,p){
        if(infer<10)return;
        Utils.asyncForEach(tests, function(test, i, next) {
            console.log('Running ' + test);
            test();
            Utils.assert(edit === global.getEditor(), 'edit#' + i);
            Utils.assert(mainEditor === global.getMainEditor(), 'main#' + i);
            Utils.assert((doc.clones?doc.clones.length:0) === numClones, 'doc#' + i);
            setTimeout(next, infer);
        },function(){
            global.Notify.info('Run ' + p++);
            run(infer>>1,p);
        });
    }
    run(500,1);