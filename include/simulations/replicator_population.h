#ifndef REPLICATOR_SIM_POP_H
#define REPLICATOR_SIM_POP_H

#include <stdio.h>

struct Population {
    int size;
    double *proportions;
};

typedef struct Population population_t;

population_t * Population_create(int size);
void Population_destroy(population_t *pop);
int Population_equal(population_t *pop1, population_t *pop2, double effective_zero);
void Population_copy(population_t *target, population_t *source);
void Population_randomize(population_t *pop);
void Population_serialize(population_t *pop, FILE * target_file);
population_t * Population_deserialize(FILE * source_file);

struct PopCollection {
    int size;
    int *pop_sizes;
    population_t **populations;
};

typedef struct PopCollection popcollection_t;

popcollection_t * PopCollection_create(int num_pops, int *sizes);
popcollection_t * PopCollection_clone(popcollection_t *original);
void PopCollection_destroy(popcollection_t *coll);
int PopCollection_equal(popcollection_t *coll1, popcollection_t *coll2, double effective_zero);
void PopCollection_copy(popcollection_t *target, popcollection_t *source);
void PopCollection_randomize(popcollection_t *coll);
void PopCollection_serialize(popcollection_t *coll, FILE * target_file);
popcollection_t * PopCollection_deserialize(FILE * source_file);

#endif
