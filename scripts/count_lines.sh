DIR=`dirname $0`
DIR=$DIR/..
find $DIR/src/ -type f |
    grep -v 'libs/\|node_modules' |
    grep 'css$\|js$'|
    xargs -l cat |
    wc -l|
    awk '{total+=$1}END{print total " lines in directory"}'
