/*jshint esversion:8*/
/*globals git*/
_Define(function(global) {
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var addDiffDoc = FileUtils.postChannel.bind(null, 'create-diff-doc');
    var addDoc = global.addDoc;
    var GitCommands = global.GitCommands;
    var relative = FileUtils.relative;
    
    FileUtils.ownChannel('diffs-git', function(doc, ev, cb) {
        addDoc(null, doc);
        var abort = new Utils.AbortSignal();
        var targetFile = ev.filepath;
        var opts = {
            fs: FileUtils.getFileServer(ev.fs),
            gitdir: ev.gitdir,
            trees: ev.refs.map(function(e) {
                switch (e) {
                    case 'ours':
                    case 'theirs':
                    case 'base':
                    case 'index':
                        return git.STAGE();
                }
                return git.TREE({
                    ref: e
                });
            }),
            map: abort.control(async function(filepath, items) {
                if (!filepath || filepath == ".") return;
                if (filepath == targetFile) {
                    var decoder = new TextDecoder('utf8');
                    var views = (await Promise.all(items.map(getContent.bind(null,
                        ev)))).map(
                        function(e) {
                            return e ? decoder.decode(e) : "";
                        });
                    abort.abort();
                    cb(views, ev.refs.join('|'), ev);
                } else if (!targetFile.startsWith(filepath + '/')) {
                    return null;
                }
            }, null),
            reduce: Utils.noop
        };
        git.walk(opts);
    });
    
    
    /*Only works for conflict entries*/
    async function getStage(e, stage, ev) {
        const oids = await e.oids();
        const oid = oids[stage] || oids[0];
        if (!oid) return "";
        try {
            var obj = await git.readObject({
                fs: FileUtils.getFileServer(ev.fs),
                gitdir: ev.gitdir,
                oid: oid
            });
            return obj.object;
        } catch (e) {
            return "";
        }

    }
    async function getContent(ev, e, i) {
        if (!e) return "";
        switch (ev.refs[i]) {
            case 'ours':
                return getStage(e, 2, ev);
            case 'base':
                return getStage(e, 1, ev);
                /*falls through*/
            case 'theirs':
                return getStage(e, 3, ev);
                /*falls through*/
            case 'index':
                return getStage(e, 0, ev);
            default:
                return e.content();
        }
    }
    
    GitCommands.diff = function(ev, prov) {
        FileUtils.getDocFromEvent(ev, function(doc) {
            addDiffDoc('git', doc, {
                fs: prov.fs.id,
                gitdir: prov.gitdir,
                filepath: relative(prov.dir, ev.filepath),
                refs: ['index']
            },true);
        });
    };
});