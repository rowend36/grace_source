#!/usr/bin/bash
DIR=`dirname $0`
DIR=$DIR/..

echo "Building worker $1..."
if [[ "tern" == $1 ]] || [[ "ts" == $1 ]]; then
    preprocess $DIR/libs/$1_worker/$1_worker.js $DIR/libs/$1_worker > $DIR/src/client/ext/language/$1/libs/$1_worker.js
else echo "Unknown worker $1. Did you mean 'tern' or 'ts'"
fi
