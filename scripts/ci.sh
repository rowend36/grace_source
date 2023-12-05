cd libs/
git clone https://github.com/rowend36/grace_source.git --branch ace
rmdir ace
mv grace_source ace
cd ace
npm ci
cd ../../
scripts/build_ace.sh
scripts/bundle.sh
