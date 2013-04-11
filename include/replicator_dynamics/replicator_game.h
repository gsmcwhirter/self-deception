#ifndef REPLICATOR_SIM_GAME_H
#define REPLICATOR_SIM_GAME_H

typedef double *(*payoff_function)(int players, int *strategy_profile);

struct PopCollection;

struct StrategyProfiles {
    int count;
    int size;
    int *types;
    int **profiles;
    int ***player_strategy_profiles;
};

typedef struct StrategyProfiles strategyprofiles_t;

strategyprofiles_t * StrategyProfiles_create(int players, int *types);
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
strategyprofiles_t * Game_StrategyProfiles_create(game_t *game);

struct PopCollection * Game_PopCollection_create(game_t *game);

#endif
