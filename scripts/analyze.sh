for i in $(ls -t android/app/src/main/assets/bundle*)
do du $i
done
