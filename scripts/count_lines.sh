DIR=`dirname $0`
DIR=$DIR/..
find $DIR/grace/src/ -type f |grep -v 'libs\/\|node_modules'|grep css$\\\|js$|parallel cat {}|wc -l|awk '{total+=$1}END{print total " lines in directory"}'
