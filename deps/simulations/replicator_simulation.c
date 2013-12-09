#include <assert.h>
#include <stdlib.h>
#include <math.h>
#include "replicator_simulation.h"
#include "replicator_population.h"
#include "replicator_game.h"

//#include <stdio.h>

#ifdef _OPENMP
#include <omp.h>
#define OMP 1
#else
#define OMP 0
#endif

#ifdef OMP_STATIC_THREADS
#define AUTO_THREAD 0
#else
#define AUTO_THREAD 1
#endif

extern int simulation_num_procs = 1;
extern int simulation_max_threads = 1;

int setup_done = 0;

void 
replicator_dynamics_setup()
{
    if (OMP){
        omp_set_nested(1);
        simulation_num_procs = omp_get_num_procs();
        if (AUTO_THREAD){
            //printf("Auto thread calc.\n");
            omp_set_dynamic(1);
            simulation_max_threads = omp_get_max_threads();
        }
        else {
            //printf("Manual thread calc.\n");
            omp_set_dynamic(0);
            simulation_max_threads = simulation_num_procs - 1;
        }
    }
    else {
        simulation_max_threads = 1;
    }
    
    setup_done = 1;
}

popcollection_t *
replicator_dynamics(game_t *game, popcollection_t *start_pops, double alpha, double effective_zero, int max_generations, cache_mask caching, cb_func on_generation)
{   
    int free_start = 0;
    assert(game != NULL);
    if (game == NULL){
        exit(EXIT_FAILURE);
    }
    
    if (!setup_done){
        replicator_dynamics_setup();
    }
    
    if (start_pops == NULL){
        start_pops = Game_PopCollection_create(game);
        PopCollection_randomize(start_pops);
        free_start = 1;
    }
        
    int generation = 0;
    
    popcollection_t * curr_pops = PopCollection_clone(start_pops);
    popcollection_t * next_pops = PopCollection_clone(start_pops);
    popcollection_t * end_pops = PopCollection_clone(start_pops);
    
    //printf("pops ok\n");
    
    strategyprofiles_t *profiles = Game_StrategyProfiles_create(game, caching);
    assert(profiles != NULL);
    if (profiles == NULL){
        exit(EXIT_FAILURE);
    }
    
    //printf("profiles ok\n");
    
    payoffcache_t *payoff_cache = PayoffCache_create(game, profiles, caching);
    assert(payoff_cache != NULL);
    if (payoff_cache == NULL){
        exit(EXIT_FAILURE);
    }
    
    //printf("payoffs ok\n");
    
    int i;
    
    PopCollection_copy(next_pops, start_pops);
    
    int *subthreads;
    int free_subthreads = 0;
    
    #ifdef _OPENMP
    int threads = next_pops->size;
    if (threads > simulation_max_threads){
        threads = simulation_max_threads;
    }
    
    subthreads = malloc(next_pops->size * sizeof(int));
    free_subthreads = 1;
    int available_threads = 0;
    if (next_pops->size > 1){
        available_threads = simulation_max_threads - threads;
        float weight = 0;
        for (i = 0; i < next_pops->size; i++){
            weight += (float)((*(next_pops->populations + i))->size);
        }
        
        for (i = 0; i < next_pops->size; i++){
            *(subthreads + i) = (int)(((float)((*(next_pops->populations + i))->size) / weight * (float)available_threads));
        }
    }
    
    /*
    printf("Main threads: %i\n", threads);
    printf("Available threads: %i\n", available_threads);
    printf("Threading distribution:\n");
    for (i = 0; i < next_pops->size; i++){
        printf("\tPop %i: %i\n", i, *(subthreads + i));
    }
    */
    #endif
    
    do {
        generation++;
        PopCollection_copy(curr_pops, next_pops);
        
        if (next_pops->size == 1){
            update_population_proportions(alpha, 0, *(next_pops->populations), curr_pops, profiles, payoff_cache, &simulation_max_threads);
        }
        else {
            #ifdef _OPENMP
            omp_set_num_threads(threads);
            #pragma omp parallel 
            {
                #pragma omp for
            #endif
                for (i = 0; i < next_pops->size; i++){
                    #ifdef _OPENMP
                    update_population_proportions(alpha, i, *(next_pops->populations + i), curr_pops, profiles, payoff_cache, subthreads + i);
                    #else
                    update_population_proportions(alpha, i, *(next_pops->populations + i), curr_pops, profiles, payoff_cache, NULL);
                    #endif
                }
            #ifdef _OPENMP
            }
            #endif
            
        }
        
        if (on_generation != NULL){
            on_generation(game, generation, next_pops);
        }
    } while((max_generations == 0 || generation < max_generations) && !PopCollection_equal(curr_pops, next_pops, effective_zero));
    
    if (free_subthreads){
        free(subthreads);
    }
    
    PopCollection_copy(end_pops, next_pops);
    
    //printf("sims ok\n");
    
    PopCollection_destroy(curr_pops);
    PopCollection_destroy(next_pops);
    PayoffCache_destroy(payoff_cache);
    StrategyProfiles_destroy(profiles);
    
    if (free_start){
        PopCollection_destroy(start_pops);
    }
    
    return end_pops;
}

double
earned_payoff(int player, int strategy, popcollection_t *pops, strategyprofiles_t *profiles, payoffcache_t *payoff_cache)
{
    assert(pops != NULL);
    assert(profiles != NULL);
    assert(payoff_cache != NULL);
    if (pops == NULL || profiles == NULL || payoff_cache == NULL){
        exit(EXIT_FAILURE);
    }
    
    double payoff = 0;
    int num_profiles = profiles->count / *(profiles->types + player);
    int profile_index;
    int profile_number;
    double *profile_payoffs;
    int *profile;
    double profile_prob;
    int pl_i;
    for (profile_index = 0; profile_index < num_profiles; profile_index++){
        profile_prob = 1;
        //profile_number = *(*(*(profiles->player_strategy_profiles + player) + strategy) + profile_index);
        profile_number = StrategyProfiles_getPlayerProfileNumber(profiles, player, strategy, profile_index); 
        //profile = *(profiles->profiles + profile_number);
        profile = StrategyProfiles_getProfile(profiles, profile_number);
        //profile_payoffs = *(payoff_cache->payoff_cache + profile_number);
        profile_payoffs = PayoffCache_getPayoffs(payoff_cache, profile_number);
        
        for (pl_i = 0; pl_i < profiles->size; pl_i++){
            if (pl_i != player){
                if (pops->size == 1){
                    profile_prob = *((*(pops->populations))->proportions + *(profile + pl_i)) * profile_prob;
                }
                else {
                    profile_prob = *((*(pops->populations + pl_i))->proportions + *(profile + pl_i)) * profile_prob;
                }
            }
        }
        
        payoff = payoff +  (*(profile_payoffs + player)) * profile_prob;
        free(profile);
        free(profile_payoffs);
    }
    
    return payoff;
}

double
average_earned_payoff(int player, popcollection_t *pops, strategyprofiles_t *profiles, payoffcache_t *payoff_cache)
{
    assert(pops != NULL);
    assert(profiles != NULL);
    assert(payoff_cache != NULL);
    if (pops == NULL || profiles == NULL || payoff_cache == NULL){
        exit(EXIT_FAILURE);
    }

    int strategy;
    double avg_payoff = 0;
    for (strategy = 0; strategy < *(pops->pop_sizes + player); strategy++){
        if (pops->size == 1){
            avg_payoff = avg_payoff + *((*(pops->populations))->proportions + strategy) * earned_payoff(player, strategy, pops, profiles, payoff_cache);
        }
        else {
            avg_payoff = avg_payoff + *((*(pops->populations + player))->proportions + strategy) * earned_payoff(player, strategy, pops, profiles, payoff_cache);
        }
    }
    
    return avg_payoff;
}

void 
update_population_proportions(double alpha, int player, population_t *pop, popcollection_t *curr_pops, strategyprofiles_t *profiles, payoffcache_t *payoff_cache, int *threads)
{
    assert(pop != NULL);
    assert(curr_pops != NULL);
    assert(profiles != NULL);
    assert(payoff_cache != NULL);
    if (pop == NULL || curr_pops == NULL || profiles == NULL || payoff_cache == NULL){
        exit(EXIT_FAILURE);
    }
    
    int offset;
    
    if (curr_pops->size == 1){
        offset = 0;
    }
    else {
        offset = player;
    }

    int strategy;
    int c = pop->size;
    #ifdef _OPENMP
    //printf("OMP\n");
    //printf("Subthreads ptr: %p\n", threads);
    
    /*
    if (threads != NULL){
        printf("Threads value: %i\n", *threads);
    }
    */
    
    if (threads != NULL && (*threads) > 0){
        //printf("Setting omp_set_num_threads to %i\n", *threads);
        omp_set_num_threads(*threads);
    }
    else {
        omp_set_num_threads(1);
    }
    
    #pragma omp parallel
    {
        //printf("Using %i threads...\n", omp_get_num_threads());
        #pragma omp for
    #endif
        for (strategy = 0; strategy < c; strategy++){
            if (*((*(curr_pops->populations + offset))->proportions + strategy) != 0){
                *(pop->proportions + strategy) = (*((*(curr_pops->populations + offset))->proportions + strategy)) * (alpha + earned_payoff(player, strategy, curr_pops, profiles, payoff_cache)) / (alpha + average_earned_payoff(player, curr_pops, profiles, payoff_cache));
            }
            else {
                *(pop->proportions + strategy) = 0;
            }
        }
    #ifdef _OPENMP
    }
    #endif
}
