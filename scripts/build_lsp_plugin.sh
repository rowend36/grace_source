DIR=`dirname $0`
DIR=$DIR/..
cd $DIR/libs/lsp_client_deps

echo 'Building client dependencies....'
webpack --output-library-type amd ./index.js --mode=production && cp ./dist/main.js ../../src/client/ext/language/lsp/libs/open_rpc_lsp.js

echo 'Building server.....'
cd ../lsp_server
npx tsc
cp src/config.yml dist/
echo "Done"
