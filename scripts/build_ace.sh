DIR=`dirname $0`
DIR=$DIR/../libs
node $DIR/ace/Makefile.dryice.js $@ -nc
cp -r $DIR/ace/build/src-noconflict/* $DIR/../src/client/libs/ace/

