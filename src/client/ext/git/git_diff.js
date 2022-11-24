/*jshint esversion:8*/
/*globals git*/
define(function (require, exports, module) {
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Utils = require('grace/core/utils').Utils;
    var Docs = require('grace/docs/docs').Docs;

    var StopSignal = require('grace/ext/stop_signal').StopSignal;
    var registerDiffFactory = require('grace/ext/diff').registerDiffFactory;
    var createDiffView = require('grace/ext/diff').createDiffView;
    var relative = FileUtils.relative;

    registerDiffFactory('git', function (ev, cb) {
        var doc;
        if (typeof ev.doc == 'string') doc = Docs.get(ev.doc);
        else {
            doc = ev.doc;
            ev.doc = doc && doc.id;
        }
        var panes = {}; //map names to content
        var names = []; //The pane to render views in ie theirs,ours,origin
        var refs = []; //The refs to read, must be more than 0
        Object.keys(ev.panes).forEach(function (key) {
            if (ev.panes[key] === ev.doc) panes[key] = doc;
            else {
                names.push(key);
                refs.push(ev.panes[key]);
            }
        });
        var task = new StopSignal();
        var targetFile = ev.filepath;
        var opts = {
            fs: FileUtils.getFileServer(ev.fs),
            gitdir: ev.gitdir,
            trees: refs.map(function (e) {
                //get the trees
                switch (e) {
                    case 'ours':
                    case 'theirs':
                    case 'base':
                    case 'index':
                        return git.STAGE();
                }
                return git.TREE({
                    ref: e,
                });
            }),
            map: task.control(async function (filepath, items) {
                if (!filepath || filepath == '.') return;
                if (targetFile.startsWith(filepath + '/')) return;
                if (filepath == targetFile) {
                    var decoder = new TextDecoder('utf8');
                    await Promise.all(
                        refs.map(async function (ref, i) {
                            var content = await getContent(ev, ref, items[i]);
                            panes[names[i]] = content
                                ? decoder.decode(content)
                                : '';
                        })
                    );
                    task.stop();
                    cb(panes, refs.join('|'), ev);
                }
                return null;
            }, null),
            reduce: Utils.noop,
        };
        git.walk(opts).finally(task.control(cb.bind(null, null)));
    });

    /*Only works for conflict entries*/
    async function getStage(ev, stage, e) {
        const oids = (await e.conflictData()).oids;
        console.log(oids);
        const oid = oids[stage] || oids[0];
        if (!oid) return '';
        try {
            var obj = await git.readObject({
                fs: FileUtils.getFileServer(ev.fs),
                gitdir: ev.gitdir,
                oid: oid,
            });
            return obj.object;
        } catch (e) {
            return '';
        }
    }
    async function getContent(ev, ref, e) {
        if (!e) return '';
        switch (ref) {
            case 'ours':
                return getStage(ev, 2, e);
            case 'base':
                return getStage(ev, 1, e);
            case 'theirs':
                return getStage(ev, 3, e);
            case 'index':
                return getStage(ev, 0, e);
            default:
                return e.content();
        }
    }

    exports.diff = function (ev, prov) {
        FileUtils.getDocFromEvent(ev, function (doc) {
            createDiffView(
                'git',
                {
                    doc: doc.id,
                    fs: prov.fs.id,
                    gitdir: prov.gitdir,
                    filepath: relative(prov.dir, ev.filepath),
                    panes: {origin: 'index', ours: doc.id},
                },
                true
            );
        });
    };
});