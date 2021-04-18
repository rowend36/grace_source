/*jshint esversion: 8,esnext:false*/
_Define(function(global){
    var TREE=git.TREE, WORKDIR=git.WORKDIR, STAGE=git.STAGE;
    const flat =
        typeof Array.prototype.flat === 'undefined' ?
        entries => entries.reduce((acc, x) => acc.concat(x), []) :
        entries => entries.flat();
    /*Checks whether it is safe to checkout
     a ref, isomorphic git implementation is kinda buggy
     Basically, we want to be sure all files that are uncommitted
     will not need to be changed
    */
    async function analyze({
        fs,
        cache,
        onProgress,
        dir,
        gitdir,
        ref,
        force,
        filepaths
    }) {
        let count = 0;
        return git.walk({
            fs,
            cache,
            dir,
            gitdir,
            trees: [TREE({ ref }), WORKDIR(),TREE({ref:'HEAD'})],
            map: async function(fullpath, [commit, workdir, stage]) {
                if (fullpath === '.') return;
                // match against base paths
                if (filepaths && !filepaths.some(base => worthWalking(fullpath, base))) {
                    return null;
                }
                // Emit progress event
                if (onProgress) {
                    await onProgress({ phase: 'Analyzing workdir', loaded: ++count });
                }
                const key = [!!stage, !!commit, !!workdir].map(Number).join('');
                switch (key) {
                    // Impossible case.
                    case '000':
                        return;
                        // Ignore workdir files that are not tracked and not part of the new commit.
                    case '001':
                        // OK, make an exception for explicitly named files.
                        if (force && filepaths && filepaths.includes(fullpath)) {
                            return ['delete', fullpath];
                        }
                        return null;
                        // New entries
                    case '010':
                        {
                            switch (await commit.type()) {
                                case 'tree':
                                    {
                                        return ['mkdir', fullpath];
                                    }
                                case 'blob':
                                    {
                                        return [
                                            'create',
                                            fullpath
                                        ];
                                    }
                                case 'commit':
                                    {
                                        return [
                                            'mkdir-index',
                                            fullpath
                                        ];
                                    }
                                default:
                                    {
                                        return [
                                            'error',
                                            `new entry Unhandled type ${await commit.type()}`,
                                        ];
                                    }
                            }
                        }
                        // New entries but there is already something in the workdir there.
                    case '011':
                        {
                            switch (`${await commit.type()}-${await workdir.type()}`) {
                                case 'tree-tree':
                                    {
                                        return; // noop
                                    }
                                case 'tree-blob':
                                case 'blob-tree':
                                    {
                                        return ['conflict', fullpath];
                                    }
                                case 'blob-blob':
                                    {
                                        // Is the incoming file different?
                                        if ((await commit.oid()) !== (await workdir.oid())) {
                                            if (force) {
                                                return [
                                                    'update',
                                                    fullpath
                                                ];
                                            }
                                            else {
                                                return ['conflict', fullpath];
                                            }
                                        }
                                        else {
                                            // Is the incoming file a different mode?
                                            if ((await commit.mode()) !== (await workdir.mode())) {
                                                if (force) {
                                                    return [
                                                        'update',
                                                        fullpath
                                                    ];
                                                }
                                                else {
                                                    return ['conflict', fullpath];
                                                }
                                            }
                                            else {
                                                return [
                                                    'create-index',
                                                    fullpath
                                                ];
                                            }
                                        }
                                    }
                                case 'commit-tree':
                                    {
                                        // TODO: submodule
                                        // We'll ignore submodule directories for now.
                                        // Users prefer we not throw an error for lack of submodule support.
                                        // gitlinks
                                        return;
                                    }
                                case 'commit-blob':
                                    {
                                        // TODO: submodule
                                        // But... we'll complain if there is a *file* where we would
                                        // put a submodule if we had submodule support.
                                        return ['conflict', fullpath];
                                    }
                                default:
                                    {
                                        return ['error', `new entry Unhandled type ${commit.type}`];
                                    }
                            }
                        }
                        // Something in stage but not in the commit OR the workdir.
                        // Note: I verified this behavior against canonical git.
                    case '100':
                        {
                            return ['delete-index', fullpath];
                        }
                        // Deleted entries
                        // TODO: How to handle if stage type and workdir type mismatch?
                    case '101':
                        {
                            switch (await stage.type()) {
                                case 'tree':
                                    {
                                        return ['rmdir', fullpath];
                                    }
                                case 'blob':
                                    {
                                        // Git checks that the workdir.oid === stage.oid before deleting file
                                        if ((await stage.oid()) !== (await workdir.oid())) {
                                            if (force) {
                                                return ['delete', fullpath];
                                            }
                                            else {
                                                return ['conflict', fullpath];
                                            }
                                        }
                                        else {
                                            return ['delete', fullpath];
                                        }
                                    }
                                case 'commit':
                                    {
                                        return ['rmdir-index', fullpath];
                                    }
                                default:
                                    {
                                        return [
                                            'error',
                                            `delete entry Unhandled type ${await stage.type()}`,
                                        ];
                                    }
                            }
                        }
                        /* eslint-disable no-fallthrough */
                        // File missing from workdir
                    case '110':
                        // Possibly modified entries
                    case '111':
                        {
                            /* eslint-enable no-fallthrough */
                            switch (`${await stage.type()}-${await commit.type()}`) {
                                case 'tree-tree':
                                    {
                                        return;
                                    }
                                case 'blob-blob':
                                    {
                                        // If the file hasn't changed, there is no need to do anything.
                                        // Existing file modifications in the workdir can be be left as is.
                                        // Check for local changes that would be lost
                                        if (workdir) {
                                            // Note: canonical git only compares with the stage. But we're smart enough
                                            // to compare to the stage AND the incoming commit.
                                            if (
                                                (await workdir.oid()) !== (await stage.oid()) &&
                                                (await workdir.oid()) !== (await commit.oid())
                                            ) {
                                                if (force) {
                                                    return [
                                                        'update',
                                                        fullpath
                                                    ];
                                                }
                                                else {
                                                    return ['conflict', fullpath];
                                                }
                                            }
                                        }
                                        else {
                                            if (force) {
                                                return [
                                                    'update',
                                                    fullpath
                                                ];
                                            }
                                            else if (
                                                (await stage.oid()) === (await commit.oid()) &&
                                                (await stage.mode()) === (await commit.mode())
                                            ) {
                                                return;
                                            }
                                        }
                                        // Has file mode changed?
                                        if ((await commit.mode()) !== (await stage.mode())) {
                                            return [
                                                'update',
                                                fullpath
                                            ];
                                        }
                                        // TODO: HANDLE SYMLINKS
                                        // Has the file content changed?
                                        if ((await commit.oid()) !== (await stage.oid())) {
                                            return [
                                                'update',
                                                fullpath
                                            ];
                                        }
                                        else {
                                            return;
                                        }
                                    }
                                case 'tree-blob':
                                    {
                                        return ['update-dir-to-blob', fullpath, await commit.oid()];
                                    }
                                case 'blob-tree':
                                    {
                                        return ['update-blob-to-tree', fullpath];
                                    }
                                case 'commit-commit':
                                    {
                                        return [
                                            'mkdir-index',
                                            fullpath
                                        ];
                                    }
                                default:
                                    {
                                        return [
                                            'error',
                                            `update entry Unhandled type ${await stage.type()}-${await commit.type()}`,
                                        ];
                                    }
                            }
                        }
                }
            },
            // Modify the default flat mapping
            reduce: async function(parent, children) {
                children = flat(children);
                if (!parent) {
                    return children;
                }
                else if (parent && parent[0] === 'rmdir') {
                    children.push(parent);
                    return children;
                }
                else {
                    children.unshift(parent)
                    return children
                }
            },
        })
    }
    global.analyze = analyze;
})/*_EndDefine*/