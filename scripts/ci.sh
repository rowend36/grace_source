cd libs/
rmdir ace
git worktree add ace/ ace
cd ace
npm ci
cd ../../
scripts/build_ace.sh
scripts/bundle.sh
