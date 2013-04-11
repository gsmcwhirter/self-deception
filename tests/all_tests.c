#include "minunit.h"
#include <dlfcn.h>
#include <math.h>
#include <assert.h>
#include <replicator_dynamics/replicator_population.h>
#include <replicator_dynamics/replicator_game.h>
#include <replicator_dynamics/replicator_simulation.h>

#include "simulation.h"

#define UNUSED(x) (void)(x)

char *
all_tests() 
{
    mu_suite_start();

    printf("No tests to run.");

    return NULL;
}

RUN_TESTS(all_tests);
