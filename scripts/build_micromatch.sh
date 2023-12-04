#Ugly code to build micromatch without a webpack config
#Bundle micromatch
DIR=`dirname $0`
cd $DIR/../libs/micromatch
webpack --entry micromatch -o ./micromatch/ --resolve-fallback-name path --resolve-fallback-alias path-browserify --target=web --target=es5 --output-library-type umd --output-library-name micromatch --mode="production" --no-optimization-minimize
#Add the process global
echo "(function(k = typeof module === 'object'){ var module = k ? module: {};" > ./micromatch/main2.js
cat ./node_modules/process/browser.js  >> ./micromatch/main2.js
echo "if(!k) module = undefined;" >> ./micromatch/main2.js
cat ./micromatch/main.js >> ./micromatch/main2.js
echo "})()" >> ./micromatch/main2.js
#Transpile to es5
./babel.js ./micromatch/main2.js
#Minify
echo "Minify"
npx uglifyjs -c "toplevel=true,keep_fnames=false,passes=2" -m "toplevel=true"  ./micromatch/main2-es5.js -o ../../src/client/ext/file_utils/libs/micromatch.js -e
echo "Done"
