(function(global){
    var exports;
    global.requireMerge = function() {
        if (exports) {
            return exports;
        }
        else exports = {};
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
                ours = await _currentBranch({ fs, gitdir, fullname: true })
            }
            ours = await git.expandRef({
                fs,
                gitdir,
                ref: ours,
            })
            theirs = await git.expandRef({
                fs,
                gitdir,
                ref: theirs,
            })
            const ourOid = await git.resolveRef({
                fs,
                gitdir,
                ref: ours,
            })
            const theirOid = await git.resolveRef({
                fs,
                gitdir,
                ref: theirs,
            })
            // find most recent common ancestor of ref a and ref b
            const baseOids = await git.findMergeBase({
                fs,
                cache,
                gitdir,
                oids: [ourOid, theirOid],
            })
            if (baseOids.length !== 1) {
                throw new MergeNotSupportedError()
            }
            const baseOid = baseOids[0]
            // handle fast-forward case
            if (baseOid === theirOid) {
                return {
                    oid: ourOid,
                    alreadyMerged: true,
                }
            }
            if (baseOid === ourOid) {
                if (!dryRun && !noUpdateBranch) {
                    await git.writeRef({ fs, gitdir, ref: ours, value: theirOid })
                }
                return {
                    oid: theirOid,
                    fastForward: true,
                }
            }
            else {
                // not a simple fast-forward
                if (fastForwardOnly) {
                    throw new FastForwardError()
                }
                // try a fancier merge
                const tree = await exports.mergeTree({
                    fs,
                    gitdir,
                    ourOid,
                    theirOid,
                    baseOid,
                    ourName: ours,
                    baseName: 'base',
                    theirName: theirs,
                    dryRun,
                })
                if (!message) {
                    message = `Merge branch '${abbreviateRef(theirs)}' into ${abbreviateRef(
            ours
          )}`
                }
                const oid = await git.commit({
                    fs,
                    cache,
                    gitdir,
                    message,
                    ref: ours,
                    tree,
                    parent: [ourOid, theirOid],
                    author,
                    committer,
                    signingKey,
                    dryRun,
                    noUpdateBranch,
                })
                return {
                    oid,
                    tree,
                    mergeCommit: true,
                }
            }
        }
        var TREE = git.TREE;
        var _walk = git.walk;
        var MergeNotSupportedError = git.Errors.MergeNotSupportedError;
        
        var basename = global.FileUtils.basename;
        var join  = global.FileUtils.join;
        
        /**
         * Create a merged tree
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
         * @returns {Promise<string>} - The SHA-1 object id of the merged tree
         *
         */
        exports.mergeTree = async function({
            fs,
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
            const baseTree = TREE({ ref: baseOid })
            const theirTree = TREE({ ref: theirOid })

            const results = await _walk({
                fs,
                dir,
                gitdir,
                trees: [ourTree, baseTree, theirTree],
                map: async function(filepath, [ours, base, theirs]) {
                    const path = basename(filepath)
                    // What we did, what they did
                    const ourChange = await modified(ours, base)
                    const theirChange = await modified(theirs, base)
                    switch (`${ourChange}-${theirChange}`) {
                        case 'false-false':
                            {
                                return {
                                    mode: await base.mode(),
                                    path,
                                    oid: await base.oid(),
                                    type: await base.type(),
                                }
                            }
                        case 'false-true':
                            {
                                return theirs ? {
                                    mode: await theirs.mode(),
                                    path,
                                    oid: await theirs.oid(),
                                    type: await theirs.type(),
                                } : undefined
                            }
                        case 'true-false':
                            {
                                return ours ? {
                                    mode: await ours.mode(),
                                    path,
                                    oid: await ours.oid(),
                                    type: await ours.type(),
                                } : undefined
                            }
                        case 'true-true':
                            {
                                // Modifications
                                if (
                                    ours &&
                                    base &&
                                    theirs &&
                                    (await ours.type()) === 'blob' &&
                                    (await base.type()) === 'blob' &&
                                    (await theirs.type()) === 'blob'
                                ) {
                                    return exports.mergeBlobs({
                                        fs,
                                        gitdir,
                                        path,
                                        ours,
                                        base,
                                        theirs,
                                        ourName,
                                        baseName,
                                        theirName,
                                    })
                                }
                                // all other types of conflicts fail
                                throw new MergeNotSupportedError()
                            }
                    }
                },
                /**
                 * @param {TreeEntry} [parent]
                 * @param {Array<TreeEntry>} children
                 */
                reduce: async(parent, children) => {
                    const entries = children.filter(Boolean) // remove undefineds

                    // automatically delete directories if they have been emptied
                    if (parent && parent.type === 'tree' && entries.length === 0) return

                    if (entries.length > 0) {
                        const oid = await git.writeTree({
                            fs,
                            gitdir,
                            type: 'tree',
                            tree: entries,
                            dryRun,
                        })
                        parent.oid = oid
                    }
                    return parent
                },
            })
            return results.oid
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
         * @param {boolean} [args.dryRun = false]
         *
         */
        exports.mergeBlobs = async function({
            fs,
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
            dryRun
        }) {
            const type = 'blob'
            // Compute the new mode.
            // Since there are ONLY two valid blob modes ('100755' and '100644') it boils down to this
            const mode =
                (await base.mode()) === (await ours.mode()) ?
                await theirs.mode() :
                await ours.mode()
            // The trivial case: nothing to merge except maybe mode
            if ((await ours.oid()) === (await theirs.oid())) {
                return { mode, path, oid: await ours.oid(), type }
            }
            // if only one side made oid changes, return that side's oid
            if ((await ours.oid()) === (await base.oid())) {
                return { mode, path, oid: await theirs.oid(), type }
            }
            if ((await theirs.oid()) === (await base.oid())) {
                return { mode, path, oid: await ours.oid(), type }
            }
            // if both sides made changes do a merge
            const { mergedText, cleanMerge } = mergeFile({
                ourContent: Buffer.from(await ours.content()).toString('utf8'),
                baseContent: Buffer.from(await base.content()).toString('utf8'),
                theirContent: Buffer.from(await theirs.content()).toString('utf8'),
                ourName,
                theirName,
                baseName,
                format,
                markerSize,
            })
            if (!cleanMerge) {
                // all other types of conflicts fail
                throw new MergeNotSupportedError()
            }
            const oid = await writeObject({
                fs,
                gitdir,
                type: 'blob',
                object: Buffer.from(mergedText, 'utf8'),
                dryRun,
            })
            return { mode, path, oid, type }
        }
        return exports;
    }
})(Modules);