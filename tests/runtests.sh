echo "Running unit tests:"

echo `pwd`
for i in tests/*_tests
do
    if test -f $i
    then
        if LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH $VALGRIND ./$i 2>> tests/tests.log
        then
            echo $i PASS
        else
            echo "ERROR in test $i: here's tests/tests.log"
            echo "------"
            tail tests/tests.log
            exit 1
        fi
    fi
done

echo ""
