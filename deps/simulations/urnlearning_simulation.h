#ifndef URNLEARNING_SIM_H
#define URNLEARNING_SIM_H

#include "urnlearning_urns.h"
#include "urnlearning_game.h"

typedef double ** (*payoff_function)(unsigned int players, unsigned int **types, unsigned int * state_action_profile);

void urnlearning_dynamics(urngame_t *urngame, unsigned long max_iterations, payoff_function payoffs);

#endif
