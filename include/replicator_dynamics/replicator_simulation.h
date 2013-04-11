#ifndef REPLICATOR_SIM_H
#define REPLICATOR_SIM_H

struct StrategyProfiles;
struct Game;
struct PopCollection;
struct Population;

struct PayoffCache {
	int count;
	double **payoff_cache;
};

typedef struct PayoffCache payoffcache_t;

payoffcache_t * PayoffCache_create(struct Game *game, struct StrategyProfiles *profiles);
void PayoffCache_destroy(payoffcache_t *cache);

typedef void (*cb_func)(struct Game *game, int generation, struct PopCollection *generation_pop);

struct PopCollection * replicator_dynamics(struct Game *game, struct PopCollection *start_pops, double alpha, double effective_zero, int max_generations, cb_func on_generation);
double earned_payoff(int player, int strategy, struct PopCollection *pops, struct StrategyProfiles *profiles, payoffcache_t *payoff_cache);
double average_earned_payoff(int player, struct PopCollection *pops, struct StrategyProfiles *profiles, payoffcache_t *payoff_cache);
void update_population_proportions(double alpha, int player, struct Population *pop, struct PopCollection *curr_pops, struct StrategyProfiles *profiles, payoffcache_t *payoff_cache);

#endif
