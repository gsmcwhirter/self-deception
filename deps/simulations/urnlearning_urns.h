#ifndef URNLEARNING_URNS_H
#define URNLEARNING_URNS_H
#include <stdio.h>

#include "randomkit.h"


struct Urn {
	unsigned int types;
	double *counts;
	double *proportions;
};

typedef struct Urn urn_t;

urn_t * Urn_create(unsigned int types, double *initial_counts);
void Urn_destroy(urn_t * urn);
void Urn_update(urn_t *urn, double *count_updates);
unsigned int Urn_select(urn_t *urn, double random_draw);
unsigned int Urn_randomSelect(urn_t *urn, rk_state *rand_state_ptr);
void Urn_display(urn_t * urn, char *prefix, FILE *outfile);
urn_t * Urn_clone(urn_t *urn);
void Urn_copy(urn_t *source, urn_t *target);

struct UrnCollection {
	unsigned int num_urns;
	urn_t **urns;
};

typedef struct UrnCollection urncollection_t;

urncollection_t * UrnCollection_create(unsigned int num_urns, unsigned int * types, double **initial_counts);
void UrnCollection_destroy(urncollection_t *urnc);
urncollection_t * UrnCollection_clone(urncollection_t *urnc);
void UrnCollection_copy(urncollection_t *source, urncollection_t *target);

#endif
