#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include "urnlearning_urns.h"
#include "randomkit.h"

urn_t * 
Urn_create(unsigned int types, double *initial_counts)
{
    urn_t * urn = malloc(sizeof(urn_t));
    assert(urn != NULL);
    if (urn == NULL){
        exit(EXIT_FAILURE);
    }

    unsigned int i;

    urn->types = types;
    urn->counts = malloc(urn->types * sizeof(double));
    assert(urn->counts != NULL);
    if (urn->counts == NULL){
        exit(EXIT_FAILURE);
    }
    urn->proportions = malloc(urn->types * sizeof(double));
    assert(urn->proportions != NULL);
    if (urn->proportions == NULL){
        exit(EXIT_FAILURE);
    }
    
    for (i = 0; i < urn->types; i++){
        *(urn->counts + i) = 0.0;
        *(urn->proportions + i) = 0.0;
    }
    
    if (initial_counts == NULL){
        double *initial_counts2 = malloc(urn->types * sizeof(double));
        for (i = 0; i < urn->types; i++){
            *(initial_counts2 + i) = 0.0;
        }
        Urn_update(urn, initial_counts2);
        free(initial_counts2);
    }
    else {
        Urn_update(urn, initial_counts);
    }
    
    return urn;
}

void 
Urn_destroy(urn_t * urn)
{
    if (urn != NULL){
        free(urn->counts);
        free(urn->proportions);
        free(urn);
    }
}

void 
Urn_update(urn_t *urn, double *count_updates)
{
    assert(urn != NULL);
    if (urn == NULL){
        exit(EXIT_FAILURE);
    }
    
    #ifndef NDEBUG
    char *prefix = "    ";
    printf("Updating Urn:\n");
    printf("  Starting Values:\n");
    Urn_display(urn, prefix);
    #endif
    
    unsigned int i;
    double total = 0;
    for (i = 0; i < urn->types; i++){
        *(urn->counts + i) += *(count_updates + i);
        total += *(urn->counts + i);
    }
    
    if (total > 0){
        for (i = 0; i < urn->types; i++){
            *(urn->proportions + i) = *(urn->counts + i) / total;
        }
    }
    else {
        for (i = 0; i < urn->types; i++){
            *(urn->proportions + i) = 0.0;
        }
    }
    
    #ifndef NDEBUG
    printf("  Ending Values:\n");
    Urn_display(urn, prefix);
    #endif
}

unsigned int 
Urn_select(urn_t *urn, double random_draw)
{
    int draw_failed = 1;
    unsigned int draw_value;
    unsigned int i;
    double cumulative = 0.0;
    for (i = 0; i < urn->types; i++){
        cumulative += *(urn->proportions + i);
        if (cumulative >= random_draw){
            draw_value = i;
            draw_failed = 0;
            break;
        }
    }
    
    if (draw_failed){
        draw_value = urn->types;
    }
    
    #ifndef NDEBUG
    char *prefix = "    ";
    printf("Urn Selection:\n");
    printf("  Urn Data:\n");
    Urn_display(urn, prefix);
    printf("  Random Draw: %g\n", random_draw);
    printf("  Draw Value: %i\n", draw_value);
    #endif
    
    return draw_value;
}

unsigned int
Urn_randomSelect(urn_t *urn, rk_state *rand_state_ptr)
{
    assert(urn != NULL);
    if (urn == NULL){
        exit(EXIT_FAILURE);
    }
    
    if (rand_state_ptr == NULL){
        rk_state rand_state;
        rk_randomseed(&rand_state);
        rand_state_ptr = &rand_state;    
    }
    
    double random_draw = rk_double(rand_state_ptr);
    
    return Urn_select(urn, random_draw);
}

void 
Urn_display(urn_t * urn, char *prefix, FILE *outfile)
{
    assert(urn != NULL);
    if (urn == NULL){
        exit(EXIT_FAILURE);
    }
    
    if (outfile == NULL){
        outfile = stdout;
    }
    
    unsigned int i;
    fprintf(outfile, "%sCounts:", prefix);
    for (i = 0; i < urn->types; i++){
        fprintf(outfile, "  %g", *(urn->counts + i));
    }
    fprintf(outfile, "\n");
    fprintf(outfile, "%sProportions:", prefix);
    for (i = 0; i < urn->types; i++){
        fprintf(outfile, "  %g", *(urn->proportions + i));
    }
    fprintf(outfile, "\n");
}

void 
Urn_copy(urn_t *source, urn_t *target)
{
    assert(source != NULL);
    assert(target != NULL);
    assert(source->types == target->types);
    if (source == NULL || target == NULL || source->types != target->types){
        exit(EXIT_FAILURE);
    }
    
    unsigned int i;
    for (i = 0; i < source->types; i++){
        *(target->counts + i) = *(source->counts + i);
        *(target->proportions + i) = *(source->proportions + i);
    }
}

urn_t *
Urn_clone(urn_t *urn)
{
    assert(urn != NULL);
    if (urn == NULL){
        exit(EXIT_FAILURE);
    }
    
    urn_t * newurn = Urn_create(urn->types, NULL);
    Urn_copy(urn, newurn);
    
    return newurn;
}

urncollection_t * 
UrnCollection_create(unsigned int num_urns, unsigned int * types, double **initial_counts)
{
    assert(types != NULL);
    if (types == NULL){
        exit(EXIT_FAILURE);
    }

    urncollection_t * urnc = malloc(sizeof(urncollection_t));
    assert(urnc != NULL);
    if (urnc == NULL){
        exit(EXIT_FAILURE);
    }
    
    urnc->num_urns = num_urns;
    urnc->urns = malloc(num_urns * sizeof(urn_t *));
    assert(urnc->urns != NULL);
    if (urnc->urns == NULL){
        exit(EXIT_FAILURE);
    }
    
    unsigned int i;
    for (i = 0; i < urnc->num_urns; i++){
        *(urnc->urns + i) = Urn_create(*(types + i), (initial_counts == NULL) ? NULL : *(initial_counts + i));
        assert(*(urnc->urns + i) != NULL);
        if (*(urnc->urns + i) == NULL){
            exit(EXIT_FAILURE);
        }
    }
    
    return urnc;
}

void 
UrnCollection_destroy(urncollection_t *urnc)
{
    unsigned int i;
    if (urnc != NULL){
        for (i = 0; i < urnc->num_urns; i++){
            Urn_destroy(*(urnc->urns + i));
        }
        free(urnc->urns);
        free(urnc);
    }
}

void
UrnCollection_copy(urncollection_t *source, urncollection_t *target)
{
    assert(source != NULL);
    assert(target != NULL);
    assert(source->num_urns == target->num_urns);
    if (source == NULL || target == NULL || source->num_urns != target->num_urns){
        exit(EXIT_FAILURE);
    }
    
    unsigned int i;
    for (i = 0; i < source->num_urns; i++){
        Urn_copy(*(source->urns + i), *(target->urns + i));
    }
}

urncollection_t *
UrnCollection_clone(urncollection_t *urnc)
{
    assert(urnc != NULL);
    if (urnc == NULL){
        exit(EXIT_FAILURE);
    }
    
    unsigned int * types = malloc(urnc->num_urns * sizeof(unsigned int));
    unsigned int i;
    for (i = 0; i < urnc->num_urns; i++){
        *(types + i) = (*(urnc->urns + i))->types;
    }
    
    urncollection_t * newurnc = UrnCollection_create(urnc->num_urns, types, NULL);
    UrnCollection_copy(urnc, newurnc);
    free(types);
    return newurnc;
}
