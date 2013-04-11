CFLAGS=-g -O2 -Wall -Wextra -Iinclude -Ideps -rdynamic -DNDEBUG $(OPTFLAGS)
LFLAGS=-Llib -lm -lreplicator_simulations -lsaneopt $(OPTLIBS)
PREFIX?=/usr/local

SOURCES=$(wildcard src/**/*.c src/*.c deps/*.c)
OBJECTS=$(patsubst %.c,%.o,$(SOURCES))
HEADERS=$(wildcard include/**/*.h include/*.h deps/*.h)

TEST_SRC=$(wildcard tests/*_tests.c)
TESTS=$(patsubst %.c,%,$(TEST_SRC))

TARGET=build/self_deception_sim

# The Target Build
all: $(TARGET)

dev: CFLAGS=-g -Wall -Wextra -Iinclude -rdynamic $(OPTFLAGS)
dev: all

$(TARGET): CFLAGS += -fPIC
$(TARGET): build $(OBJECTS)
	$(CC) $(CFLAGS) $(OBJECTS) $(LFLAGS) -o $@ 

build:
	@mkdir -p build

$(TESTS):
	$(CC) $(CFLAGS) $@.c $(LFLAGS) -o $@ 

# The Unit Tests
.PHONY: tests
test: LFLAGS += -Lbuild -lreplicator_simulations
test: $(TESTS)
	sh ./tests/runtests.sh
	
# The Cleaner
clean:
	rm -rf build dist $(OBJECTS) $(TESTS) dist/$(DIST_NAME).tar.gz
	rm -f tests/tests.log
	find . -name "*.gc*" -exec rm {} \;
	rm -rf `find . -name "*.dSYM" -print`

# The Install
#install: all
#	install -d $(PREFIX)/lib/
#	install -d $(PREFIX)/include/replicator_dynamics/
#	install $(TARGET) $(PREFIX)/lib/
#	install $(SO_TARGET) $(PREFIX)/lib/
#	install $(HEADERS) $(PREFIX)/include/replicator_dynamics/

# The Checker
BADFUNCS='[^_.>a-zA-Z0-9](str(n?cpy|n?cat|xfrm|n?dup|str|pbrk|tok|_)|stpn?cpy|a?sn?printf|byte_)'
check:
	@echo Files with potentially dangerous functions?
	@egrep $(BADFUNCS) $(SOURCES) || true

# The Packager
#dist: all
#	@mkdir -p dist/$(DIST_NAME)
#	cp $(TARGET) dist/$(DIST_NAME)
#	cp $(SO_TARGET) dist/$(DIST_NAME)
#	cp -r include dist/$(DIST_NAME)
#	tar czvfC dist/$(DIST_NAME).tar.gz dist $(DIST_NAME)
