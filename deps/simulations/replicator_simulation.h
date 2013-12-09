#ifndef REPLICATOR_SIM_H
#define REPLICATOR_SIM_H

#include "replicator_population.h"
#include "replicator_game.h"


typedef void (*cb_func)(game_t *game, int generation, popcollection_t *generation_pop);

void replicator_dynamics_setup();
popcollection_t * replicator_dynamics(game_t *game, popcollection_t *start_pops, double alpha, double effective_zero, int max_generations, cache_mask caching, cb_func on_generation);
double earned_payoff(int player, int strategy, popcollection_t *pops, strategyprofiles_t *profiles, payoffcache_t *payoff_cache);
double average_earned_payoff(int player, popcollection_t *pops, strategyprofiles_t *profiles, payoffcache_t *payoff_cache);
void update_population_proportions(double alpha, int player, population_t *pop, popcollection_t *curr_pops, strategyprofiles_t *profiles, payoffcache_t *payoff_cache, int *threads);

#endif
