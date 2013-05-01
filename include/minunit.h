#undef NDEBUG
#ifndef _minunit_h
#define _minunit_h

#include <stdio.h>
#include "dbg.h"
#include <stdlib.h>

#define mu_suite_start() char *message = NULL

#define mu_assert(test, message) do { assertions_checked++; if (!(test)) { log_err(message); return message; } } while (0)
#define mu_run_test(test) do {debug("\n-----%s", " " #test); \
    message = test(); tests_run++; if (message) return message; } while (0)

#define RUN_TESTS(name) int main(int argc, char *argv[]) {\
    debug("----- RUNNING: %s", argv[0]);\
    debug("               %i arguments", argc);\
        printf("----\nRUNNING: %s\n", argv[0]);\
        char *result = name();\
        if (result != 0) {\
            printf("FAILED: %s\n", result);\
        }\
        else {\
            printf("ALL TESTS PASSED\n");\
        }\
    printf("Tests run: %d\n", tests_run);\
    printf("Assertions checked: %d\n", assertions_checked);\
        exit(result != 0);\
}

int tests_run;
int assertions_checked;

#endif
