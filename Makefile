CFLAGS=-g -O2 -Wall -Wextra -Iinclude -Ideps -rdynamic -DNDEBUG $(OPTFLAGS)
LFLAGS=-Llib -lm -lurnlearning $(OPTLIBS) #-lsaneopt

SOURCES1=$(wildcard src/replicator_*.c deps/*.c)
OBJECTS1=$(patsubst %.c,%.o,$(SOURCES1))
SOURCES2=$(wildcard src/urnlearning_*.c deps/*.c)
OBJECTS2=$(patsubst %.c,%.o,$(SOURCES2))

TEST_SRC=$(wildcard tests/*_tests.c)
TESTS=$(patsubst %.c,%,$(TEST_SRC))

TARGET1=build/replicator_sim
TARGET2=build/urnlearning_sim

# The Target Build
all: $(TARGET)

dev: CFLAGS=-g -Wall -Wextra -Iinclude -rdynamic $(OPTFLAGS)
dev: all

$(TARGET1) $(TARGET2): CFLAGS += -fPIC
$(TARGET1): LFLAGS += -lreplicator
$(TARGET1): build $(OBJECTS1)
	$(CC) $(CFLAGS) $(OBJECTS1) $(LFLAGS) -o $@ 

$(TARGET2): LFLAGS += -lurnlearning	
$(TARGET2): build $(OBJECTS2)
	$(CC) $(CFLAGS) $(OBJECTS2) $(LFLAGS) -o $@
	
build:
	@mkdir -p build

$(TESTS):
	$(CC) $(CFLAGS) $@.c $(LFLAGS) -o $@ 

# The Unit Tests
#.PHONY: test demo demov
.PHONY: test
test: LFLAGS += -Lbuild -lreplicator -lurnlearning
test: $(TESTS)
	sh ./tests/runtests.sh
	
# The Cleaner
clean:
	rm -rf build dist $(OBJECTS1) $(OBJECTS2) $(TESTS)
	rm -f tests/tests.log
	find . -name "*.gc*" -exec rm {} \;
	rm -rf `find . -name "*.dSYM" -print`

# The Checker
BADFUNCS='[^_.>a-zA-Z0-9](str(n?cpy|n?cat|xfrm|n?dup|str|pbrk|tok|_)|stpn?cpy|a?sn?printf|byte_)'
check:
	@echo Files with potentially dangerous functions?
	@egrep $(BADFUNCS) $(SOURCES1) $(SOURCES2) || true

