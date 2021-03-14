_Define(function(global) {
    var exports;
    //return a list of conflicts 
    //instead of merge not supported error;
    global.requireMerge = function() {
        if (exports) {
            return exports;
        }
        else exports = {};
        const abbreviateRx = new RegExp('^refs/(heads/|tags/|remotes/)?(.*)')

        function abbreviateRef(ref) {
            const match = abbreviateRx.exec(ref)
            if (match) {
                if (match[1] === 'remotes/' && ref.endsWith('/HEAD')) {
                    return match[2].slice(0, -5)
                }
                else {
                    return match[2]
                }
            }
            return ref;
        }
        var TREE = git.TREE;
        var _walk = git.walk;
        var MergeNotSupportedError = git.Errors.MergeNotSupportedError;
        var MissingParameterError = git.Errors.MissingParameterError;
        var FastForwardError = git.Errors.FastForwardError;
        var _writeObject = git.writeObject;
        var basename = global.FileUtils.filename;
        var join = global.FileUtils.join;

        const _findMergeBase = git.findMergeBase;
        const _resolveRef = git.resolveRef;
        const _expandRef = git.expandRef;

        exports.merge = async function({
            fs,
            cache,
            gitdir,
            ours,
            theirs,
            fastForwardOnly = false,
            dryRun = false,
            noUpdateBranch = false,
            message,
            author,
            committer,
            signingKey,
        }) {
            if (ours === undefined) {
                ours = await _currentBranch({ cache: cache, fs, gitdir, fullname: true })
            }
            ours = await _expandRef({
                fs,
                gitdir,
                cache,
                ref: ours,
            })
            theirs = await _expandRef({
                fs,
                gitdir,
                cache,
                ref: theirs,
            })
            const ourOid = await _resolveRef({
                fs,
                gitdir,
                cache,
                ref: ours,
            })
            const theirOid = await _resolveRef({
                fs,
                gitdir,
                cache,
                ref: theirs,
            })
            // find most recent common ancestor of ref a and ref b
            const baseOids = await _findMergeBase({
                fs,
                cache,
                gitdir,
                oids: [ourOid, theirOid],
            })
            const baseOid = baseOids[0]
            if (baseOids.length === 1) {

                // handle fast-forward case
                if (baseOid === theirOid) {
                    return {
                        oid: ourOid,
                        alreadyMerged: true,
                    }
                }
                if (baseOid === ourOid) {
                    if (!dryRun && !noUpdateBranch) {
                        await git.writeRef({ fs, gitdir, cache, ref: ours, value: theirOid })
                    }
                    return {
                        oid: theirOid,
                        fastForward: true,
                    }
                }
            }
            // not a simple fast-forward
            if (fastForwardOnly) {
                throw new FastForwardError()
            }
            // try a fancier merge
            const tree = await exports.diffTree({
                fs,
                gitdir,
                ourOid,
                theirOid,
                baseOid,
                cache,
                ourName: ours,
                baseName: 'base',
                theirName: theirs,
            });
            return {
                fs,
                gitdir,
                ours,
                theirs,
                tree,
                cache,
                ourOid,
                theirOid,
                baseOid,
                author,
                committer,
                signingKey,
            };

        }


        const writeTrees = async function({
            fs,
            cache,
            gitdir,
            tree,
            dryRun,
            ourOid,
            theirOid,
            ours,
            theirs
        }) {
            const ourTree = TREE({ ref: ourOid })
            const theirTree = TREE({ ref: theirOid })
            const resolve = {};
            tree.forEach(function(e) {
                resolve[e.path] = e;
                if (!e.type) throw new MissingParameterError('type');
                if (e.conflict) throw new MergeNotSupportedError();
                if (e.head) return;
                if (e.type == 'tree') return;
                if (!e.mode) {
                    throw new MissingParameterError('mode');
                }
                if (!(e.oid || e.result)) {
                    throw new MissingParameterError('oid');
                }
            });
            var Buf = new TextEncoder('utf8');
            return await _walk({
                fs,
                gitdir,
                cache: cache,
                trees: [ourTree, theirTree],
                map: async function(filepath, [ourItem, theirItem]) {
                    //later on this could be the index
                    var a = resolve[filepath];
                    if (a) {
                        if (a.isDelete) {
                            return null
                        }
                        var head = (a.head == ours ? ourItem : a.head == theirs ? theirItem : null)

                        if (!a.mode) {
                            if (head) a.mode = (await head.mode())
                            else {
                                //tree
                                a.mode = (await ((ourItem || theirItem).mode()))
                            }
                        }
                        if (!a.oid) {
                            if (head) a.oid = (await head.oid())
                            else if (a.mergedText) {
                                a.oid = await _writeObject({
                                    fs,
                                    gitdir,
                                    cache,
                                    type: 'blob',
                                    object: Buf.encode(a.mergedText),
                                    dryRun
                                });
                            }
                            else if (a.type != 'tree') {
                                throw new MissingParameterError('oid');
                            }
                        }
                        return {
                            //clean object
                            type: a.type,
                            oid: a.oid,
                            mode: a.mode,
                            path: a.path
                        }
                    }
                    else {
                        return {
                            mode: await ourItem.mode(),
                            path: filepath,
                            oid: await ourItem.oid(),
                            type: await ourItem.type()
                        }
                    }
                },
                reduce: async function(parent, children) {
                    children = children.filter(Boolean);
                    if (parent.type == 'tree' && !parent.oid) {
                        //filter out empty directories
                        if (children.length < 1) return;
                        parent.oid = await _writeObject({
                            fs,
                            cache,
                            gitdir,
                            type: 'tree',
                            object: children,
                            dryRun
                        });
                    }
                    return parent;
                }
            });
        }

        exports.completeMerge = async function({
            fs,
            cache,
            gitdir,
            dryRun,
            ourOid,
            theirOid,
            ours,
            theirs,
            author,
            committer,
            signingKey,
            message = `Merge branch '${abbreviateRef(theirs)}' into ${abbreviateRef(ours)}`
        }) {
            var tree = await writeTrees.apply(null, arguments);
            const oid = await git.commit({
                fs,
                cache,
                gitdir,
                message,
                ref: ours,
                tree: tree.oid,
                parent: [ourOid, theirOid],
                author,
                committer,
                signingKey,
            })
            return oid;
        }
        var _currentBranch = git.currentBranch;
        /**
         * Show the changes needed to create a merge tree
         *
         * @param {Object} args
         * @param {import('../models/FileSystem.js').FileSystem} args.fs
         * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
         * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
         * @param {string} args.ourOid - The SHA-1 object id of our tree
         * @param {string} args.baseOid - The SHA-1 object id of the base tree
         * @param {string} args.theirOid - The SHA-1 object id of their tree
         * @param {string} [args.ourName='ours'] - The name to use in conflicted files for our hunks
         * @param {string} [args.baseName='base'] - The name to use in conflicted files (in diff3 format) for the base hunks
         * @param {string} [args.theirName='theirs'] - The name to use in conflicted files for their hunks
         * @param {boolean} [args.dryRun=false]
         *
         * @returns {Promise<Object>} - The proposed new tree
         *
         */
        exports.diffTree = async function({
            fs,
            cache,
            dir,
            gitdir = join(dir, '.git'),
            ourOid,
            baseOid,
            theirOid,
            ourName = 'ours',
            baseName = 'base',
            theirName = 'theirs',
            dryRun = false,
        }) {
            const ourTree = TREE({ ref: ourOid })
            const theirTree = TREE({ ref: theirOid })
            if (baseOid) {
                const baseTree = TREE({ ref: baseOid });
                trees = [ourTree, theirTree, baseTree]
            }
            else {
                trees = [ourTree, theirTree]
            }
            //A ready merge consists of things
            /*1 - {
                path,
                mode,
                oid,
                type
            }*/
            /*head param supplies any of path,mode,type*/
            /*isDelete param means the path is deleted any of path,mode,type*/
            //mode changes are autosolved for directories
            //using either base or ours
            //File mode changes are also autosolveable
            //For now, both are not shown in preview
            //Once the merge conflicts are resolved, we only have
            //to run completeMerge
            //type conflicts will require the user to cancel merge
            //for now since we have no index
            //but perharps later, we can add a rename/choose feature ie move
            const results = await _walk({
                fs,
                dir,
                gitdir,
                trees,
                cache,
                map: async function(filepath, [ours, theirs, base]) {
                    const path = basename(filepath)
                    if (!(await modified(ours, theirs))) {
                        if (ours && (await ours.type() == 'tree')) {
                            if ((await ours.oid()) == (await theirs.oid())) {
                                //succeed early
                                return null;
                            }
                            //new tree
                            return {
                                //no mode as isomorphic git supports only
                                //one tree mode
                                path,
                                type: 'tree'
                            };
                        }
                        return null;
                    }
                    const ourChange = await modified(ours, base)
                    const theirChange = await modified(theirs, base)
                    switch (`${ourChange}-${theirChange}`) {
                        case 'false-true':
                            {
                                return {
                                    head: theirName,
                                    path,
                                    type: await (theirs || ours).type(),
                                    isAdd: !ours,
                                    isDelete: !theirs
                                }
                            }
                        case 'true-false':
                            {
                                //we do not need this
                                /*{
                                    head: ourName,
                                    path,
                                    type: await(ours || theirs).type()
                                    isAdd: !theirs,
                                    isDelete: !ours
                                }*/
                                return
                            }
                        case 'true-true':
                            {
                                // Modifications
                                var ourType = (ours || null) && await ours.type();
                                var theirType = (theirs || null) && await theirs.type();

                                //Most common file changed in both branches
                                if (ourType == 'blob' && theirType == 'blob') {
                                    var baseType = (base || null) && await base.type();
                                    if (baseType == 'blob') {
                                        var res = await mergeBlobs({
                                            fs,
                                            cache,
                                            gitdir,
                                            path,
                                            ours,
                                            base,
                                            theirs,
                                            ourName,
                                            baseName,
                                            theirName,
                                        });
                                        return res;
                                    }
                                    var result = { path, type: 'blob' };
                                    if ((await ours.mode()) == (await theirs.mode())) {
                                        result.mode = (await ours.mode());
                                    }
                                    else {
                                        result.mode = (await ours.mode());
                                        result.modeConflict = (await theirs.mode());
                                    }
                                    if ((await ours.oid()) == (await theirs.oid())) {
                                        result.oid = (await ours.oid());
                                    }
                                    else {
                                        var a = new TextDecoder('utf8');
                                        Object.assign(result, mergeFile({
                                            ourContent: a.decode(await ours.content()),
                                            baseContent: "",
                                            theirContent: a.decode(await theirs.content()),
                                            ourName,
                                            baseName,
                                            theirName,
                                            format: 'diff'
                                        }));
                                        result.conflict = true;
                                    }
                                    return result;

                                }
                                if (!ourType || !theirType) {
                                    //File Deleted in one branch and modified in other
                                    return {
                                        conflict: true,
                                        path,
                                        type: ourType || theirType,
                                        present: ourType ? ourName : theirName,
                                        absent: ourType ? theirName : ourName
                                    }
                                }
                                // all other types of conflicts fail
                                var change = `${ourType}-${theirType}`;
                                return {
                                    conflict: true,
                                    path,
                                    type: change
                                }

                            }
                    }

                }
            });
            return results;
        }

        /**
         *
         * @param {WalkerEntry} entry
         * @param {WalkerEntry} base
         *
         */
        async function modified(entry, base) {
            if (!entry && !base) return false
            if (entry && !base) return true
            if (!entry && base) return true
            if ((await entry.type()) === 'tree' && (await base.type()) === 'tree') {
                return false
            }
            if (
                (await entry.type()) === (await base.type()) &&
                (await entry.mode()) === (await base.mode()) &&
                (await entry.oid()) === (await base.oid())
            ) {
                return false
            }
            return true
        }

        /**
         *
         * @param {Object} args
         * @param {import('../models/FileSystem').FileSystem} args.fs
         * @param {string} args.gitdir
         * @param {string} args.path
         * @param {WalkerEntry} args.ours
         * @param {WalkerEntry} args.base
         * @param {WalkerEntry} args.theirs
         * @param {string} [args.ourName]
         * @param {string} [args.baseName]
         * @param {string} [args.theirName]
         * @param {string} [args.format]
         * @param {number} [args.markerSize]
         *
         */
        const LINEBREAKS = /^.*(\r?\n|$)/gm
        var diff3Merge = global.diff3Merge;
        var mergeFile = exports.mergeFile = function({
            ourContent,
            baseContent,
            theirContent,
            ourName = 'ours',
            baseName = 'base',
            theirName = 'theirs',
            format = 'diff',
            markerSize = 7,
        }) {
            const ours = ourContent.match(LINEBREAKS)
            const base = baseContent.match(LINEBREAKS)
            const theirs = theirContent.match(LINEBREAKS)
            // Here we let the diff3 library do the heavy lifting.
            const result = diff3Merge(ours, base, theirs)

            // Here we note whether there are conflicts and format the results
            let mergedText = ''
            let cleanMerge = true
            for (const item of result) {
                if (item.ok) {
                    mergedText += item.ok.join('')
                }
                if (item.conflict) {
                    cleanMerge = false
                    mergedText += `${'<'.repeat(markerSize)} ${ourName}\n`
                    mergedText += item.conflict.a.join('')
                    if (mergedText[mergedText.length - 1] != "\n") {
                        mergedText += "\n";
                    }
                    if (format === 'diff3') {
                        mergedText += `${'|'.repeat(markerSize)} ${baseName}\n`
                        mergedText += item.conflict.o.join('')
                    }
                    mergedText += `${'='.repeat(markerSize)}\n`
                    mergedText += item.conflict.b.join('')
                    if (mergedText[mergedText.length - 1] != "\n") {
                        mergedText += "\n";
                    }
                    mergedText += `${'>'.repeat(markerSize)} ${theirName}\n`
                }
            }
            return { conflict: !cleanMerge, mergedText, result }
        }

        var mergeBlobs = async function({
            fs,
            cache,
            gitdir,
            path,
            ours,
            base,
            theirs,
            ourName,
            theirName,
            baseName,
            format,
            markerSize,
        }) {
            const type = 'blob'
            // Compute the new mode.
            // Since there are ONLY two valid blob modes ('100755' and '100644') it boils down to this
            const mode =
                (await base.mode()) === (await ours.mode()) ?
                await theirs.mode() :
                await ours.mode()
            // The trivial cases: nothing to merge except maybe mode
            // if only one side made oid changes, return that side's oid
            if ((await theirs.oid()) === (await base.oid())) {
                //only mode changed
                return { mode, path, head: ourName }
            }
            if ((await ours.oid()) === (await base.oid())) {
                //changed our content
                //but not necessarily mode
                if ((await ours.mode()) == mode) {
                    mode = undefined;
                }
                return { mode, path, head: theirName }
            }
            if ((await ours.oid()) === (await theirs.oid())) {
                //only mode changed
                return { mode, path, head: ourName }
            }
            // if both sides made changes do a merge
            var a = new TextDecoder('utf8');
            const result = mergeFile({
                ourContent: a.decode(await ours.content()),
                baseContent: a.decode(await base.content()),
                theirContent: a.decode(await theirs.content()),
                ourName,
                theirName,
                baseName,
                format,
                markerSize,
            });
            result.mode = mode;
            result.path = path;
            result.type = type;
            return result;
        }
        return exports;
    }
})/*_EndDefine*/