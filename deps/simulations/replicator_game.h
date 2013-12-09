#ifndef REPLICATOR_SIM_GAME_H
#define REPLICATOR_SIM_GAME_H

#define CACHE_NONE 0
#define CACHE_PROFILES 1
#define CACHE_PAYOFFS 2

#define CACHE_ALL 3

typedef unsigned int cache_mask;
typedef double *(*payoff_function)(int players, int *strategy_profile);

struct PopCollection;

struct StrategyProfiles {
    int count;
    int size;
    int *types;
    int has_cached_info;
    int **profiles;
    int ***player_strategy_profiles;
};

typedef struct StrategyProfiles strategyprofiles_t;

strategyprofiles_t * StrategyProfiles_create(int players, int *types, cache_mask cache);
int * StrategyProfiles_getProfile(strategyprofiles_t *sprofs, int num);
int * StrategyProfiles_getPlayerProfile(strategyprofiles_t *sprofs, int player, int strategy, int num);
int StrategyProfiles_getPlayerProfileNumber(strategyprofiles_t *sprofs, int player, int strategy, int num);
void StrategyProfiles_destroy(strategyprofiles_t *sprofs);

struct Game {
    int populations;
    int players;
    int *types;
    payoff_function payoffs;
};

typedef struct Game game_t;

game_t * Game_create(int players, int populations, int *types, payoff_function payoffs);
void Game_destroy(game_t *game);
strategyprofiles_t * Game_StrategyProfiles_create(game_t *game, cache_mask cache);

struct PopCollection * Game_PopCollection_create(game_t *game);

struct PayoffCache {
	int count;
	int has_cached_info;
	int free_profiles;
	payoff_function payoffs;
	strategyprofiles_t *profiles;
	double **payoff_cache;
};

typedef struct PayoffCache payoffcache_t;

payoffcache_t * PayoffCache_create(game_t *game, strategyprofiles_t *profiles, cache_mask do_cache);
double * PayoffCache_getPayoffs(payoffcache_t *cache, int profile_index);
void PayoffCache_destroy(payoffcache_t *cache);

#endif
