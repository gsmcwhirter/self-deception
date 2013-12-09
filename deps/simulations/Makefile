CFLAGS=-g -fopenmp -O2 -Wall -Wextra -DNDEBUG $(OPTFLAGS)
LFLAGS=-lm -lgomp $(OPTLIBS)
SRC?=src
PREFIX?=/usr/local

SOURCES1=$(wildcard $(SRC)/replicator_*.c $(SRC)/distributions.c $(SRC)/randomkit.c)
OBJECTS1=$(patsubst %.c,%.o,$(SOURCES1))
SOURCES2=$(wildcard $(SRC)/urnlearning_*.c $(SRC)/distributions.c $(SRC)/randomkit.c)
OBJECTS2=$(patsubst %.c,%.o,$(SOURCES2))
HEADERS=$(wildcard src/*.h tests/*.h)

TEST_SRC=$(wildcard tests/*_tests.c)
TESTS=$(patsubst %.c,%,$(TEST_SRC))

TARGET1=build/libreplicator.a
SO_TARGET1=$(patsubst %.a,%.so,$(TARGET1))
TARGET2=build/liburnlearning.a
SO_TARGET2=$(patsubst %.a,%.so,$(TARGET2))
DIST_NAME?=c-simulations

# The Target Build
all: $(TARGET1) $(SO_TARGET1) $(TARGET2) $(SO_TARGET2) 

dev: CFLAGS=-g -fopenmp -Wall -Wextra $(OPTFLAGS)
dev: all

$(TARGET1) $(TARGET2): CFLAGS += -fPIC

$(TARGET1): build $(OBJECTS1)
	ar rcs $@ $(OBJECTS1)
	ranlib $@

$(SO_TARGET1): $(TARGET1) $(OBJECTS1)
	$(CC) -shared $(OBJECTS1) $(LFLAGS) -o $@
	
$(TARGET2): build $(OBJECTS2)
	ar rcs $@ $(OBJECTS2)
	ranlib $@

$(SO_TARGET2): $(TARGET2) $(OBJECTS2)
	$(CC) -shared $(OBJECTS2) $(LFLAGS) -o $@

build:
	@mkdir -p build

$(TESTS): LFLAGS += -ldl
$(TESTS):
	$(CC) $(CFLAGS) $@.c $(LFLAGS) -o $@ 

# The Unit Tests
.PHONY: test devtest clean
test: CFLAGS += -Isrc
test: LFLAGS += -Lbuild -lreplicator -lurnlearning
test: $(TESTS)
	sh ./tests/runtests.sh
	
devtest: CFLAGS=-g -fopenmp -Wall -Wextra $(OPTFLAGS)
devtest: test
	
# The Cleaner
clean:
	rm -rf build dist $(OBJECTS1) $(OBJECTS2) $(TESTS) dist/$(DIST_NAME).tar.gz
	rm -f tests/tests.log tests/*.serial
	find . -name "*.gc*" -exec rm {} \;
	rm -rf `find . -name "*.dSYM" -print`

# The Install
# install: all
# 	install -d $(PREFIX)/lib/
# 	install -d $(PREFIX)/include/simulations/
# 	install $(TARGET1) $(PREFIX)/lib/
# 	install $(TARGET2) $(PREFIX)/lib/
# 	install $(SO_TARGET1) $(PREFIX)/lib/
# 	install $(SO_TARGET2) $(PREFIX)/lib/
# 	install $(HEADERS) $(PREFIX)/include/simulations/

# The Checker
BADFUNCS='[^_.>a-zA-Z0-9](str(n?cpy|n?cat|xfrm|n?dup|str|pbrk|tok|_)|stpn?cpy|a?sn?printf|byte_)'
check:
	@echo Files with potentially dangerous functions?
	@egrep $(BADFUNCS) $(SOURCES1) $(SOURCES2) || true

# The Packager
dist: all
	@mkdir -p dist/$(DIST_NAME)
	cp $(TARGET1) dist/$(DIST_NAME)
	cp $(TARGET2) dist/$(DIST_NAME)
	cp $(SO_TARGET1) dist/$(DIST_NAME)
	cp $(SO_TARGET2) dist/$(DIST_NAME)
	@mkdir -p dist/$(DIST_NAME)/include
	cp -r src/*.h dist/$(DIST_NAME)/include
	tar czvfC dist/$(DIST_NAME).tar.gz dist $(DIST_NAME)
