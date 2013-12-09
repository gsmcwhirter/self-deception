#ifndef URNLEARNING_GAME_H
#define URNLEARNING_GAME_H

#include "urnlearning_urns.h"
#include "randomkit.h"

typedef unsigned int * (*urn_interaction)(unsigned int players, urncollection_t **player_urns, rk_state *random_state);

struct UrnGame {
	unsigned int num_players;
	unsigned int **types;
	urncollection_t **player_urns;
	urn_interaction interaction_function;
};

typedef struct UrnGame urngame_t;

urngame_t * UrnGame_create(unsigned int players, unsigned int *num_urns, unsigned int **types, double ***initial_counts, urn_interaction func);
void UrnGame_destroy(urngame_t *urngame);
unsigned int * default_urnlearning_interaction(unsigned int players, urncollection_t **player_urns, rk_state *rand_state_ptr);
void UrnGame_copy(urngame_t *source, urngame_t *target);
urngame_t * UrnGame_clone(urngame_t *urngame);

#endif
