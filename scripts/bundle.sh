DIR=`dirname $0`
DIR=`realpath $DIR`
echo "This will take up to 15 minutes..."
time node $DIR/requirejs/bin/r.js -o $DIR/requirejs.config.js|grep -v "Uglify file:"
