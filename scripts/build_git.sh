DIR=`dirname $0`
cd $DIR/../libs/git
npm run-script build 
cp dist/isomorphic-git-mod.js ../../src/client/ext/git/libs/isomorphic-git-mod.js
