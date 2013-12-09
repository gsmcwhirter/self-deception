#include <assert.h>
#include <stdlib.h>
#include "urnlearning_urns.h"
#include "urnlearning_game.h"
#include "urnlearning_simulation.h"
#include "randomkit.h"

void
urnlearning_dynamics(urngame_t *urngame, unsigned long max_iterations, payoff_function payoff_func){
    rk_state rand_state;
    rk_randomseed(&rand_state);
    
    assert(urngame != NULL);
    if (urngame == NULL){
        exit(EXIT_FAILURE);
    }
    
    assert(payoff_func != NULL);
    if (payoff_func == NULL){
        exit(EXIT_FAILURE);
    }
    
    unsigned long iteration;
    unsigned int i;
    unsigned int tmp;
    for (iteration = 0; iteration < max_iterations; iteration++){
        unsigned int *state_action_profile = urngame->interaction_function(urngame->num_players, urngame->player_urns, &rand_state);
        
        double **payoffs = payoff_func(urngame->num_players, urngame->types, state_action_profile);
        
        for (i = 0; i < urngame->num_players; i++){
            if (i > 0){
                tmp = i - 1;
            }
            else {
                tmp = urngame->num_players;
            }
            Urn_update(*((*(urngame->player_urns + i))->urns + *(state_action_profile + tmp)), *(payoffs + i));
        }
        
        for (i = 0; i < urngame->num_players; i++){
            free(*(payoffs + i));
        }
        free(payoffs);
        free(state_action_profile);
    }
}
