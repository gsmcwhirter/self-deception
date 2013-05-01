#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#include <simulations/urnlearning_urns.h>
#include <simulations/urnlearning_game.h>
#include <simulations/urnlearning_simulation.h>
#include <simulations/randomkit.h>

#define UNUSED(x) (void)(x)
#define SITUATIONS 2
#define STATES 3
#define MESSAGES 3
#define MAX_PAYOFF 1.0
#define INSPECT_COST 0.25
#define NUM_GENERATIONS 100000000

rk_state rand_state;
int rk_state_set = 0;

double ** 
payoffs(unsigned int players, unsigned int **types, unsigned int * state_action_profile)
{
    double **payoffs = malloc(players * sizeof(double *));
    
    unsigned int i, j, tmp;
    
    //set payoffs to zero
    for (i = 0; i < players; i++){
        if (i == 0){
            tmp = players;
        }
        else {
            tmp = i-1;
        }
        *(payoffs + i) = malloc(*(*(types + i) + tmp) * sizeof(double));
        for (j = 0; j < *(*(types + i) + tmp); j++){
            *(*(payoffs + i) + j) = 0.0;
        }
    }
    
    //calculate actual payoffs
    unsigned int situation, state, representation, message, action, inspect, real_action, sender_desired_act;
    situation = *(state_action_profile + players + 1);
    state = *(state_action_profile + players);
    representation = *(state_action_profile + 0) - (situation * STATES);
    message = *(state_action_profile + 1) - (situation * MESSAGES);
    action = *(state_action_profile + 2);
    if (action == STATES){
        inspect = 1;
        if (!rk_state_set){
            rk_randomseed(&rand_state);
            rk_state_set = 1;
        }
        
        real_action = (unsigned int)rk_interval(STATES, &rand_state);
    }
    else {
        inspect = 0;
        real_action = action;
    }
    
    switch (situation){
        case 0: //pure common interest
            *(*(payoffs + 0) + state) = ((state == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
            *(*(payoffs + 1) + message) = ((state == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
            *(*(payoffs + 2) + action) = ((state == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
            break;
        case 1: //partial common interest
            if (state > 1){
                *(*(payoffs + 0) + state) = ((state == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
                *(*(payoffs + 1) + message) = ((state == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
                *(*(payoffs + 2) + action) = ((state == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
            }
            else {
                sender_desired_act = 1 - state;
                *(*(payoffs + 0) + state) = ((sender_desired_act == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
                *(*(payoffs + 1) + message) = ((sender_desired_act == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
                *(*(payoffs + 2) + action) = ((state == real_action) ? MAX_PAYOFF : 0.0) - inspect * INSPECT_COST;
            }   
            break;
        default:
            exit(EXIT_FAILURE);
            break;
    }
    
    return payoffs;
}

unsigned int * 
urnlearning_interaction(unsigned int players, urncollection_t **player_urns, rk_state *rand_state_ptr)
{   
    unsigned int situation;
    situation = (unsigned int)rk_interval(SITUATIONS, rand_state_ptr);
    unsigned int state;
    state = (unsigned int)rk_interval((*(player_urns + 0))->num_urns, rand_state_ptr);
    
    unsigned int * state_action_profile = malloc((players + 2) * sizeof(unsigned int));
    unsigned int i;
    
    #ifndef NDEBUG
    printf("Interaction:\n");
    printf("\tSituation: %i\n", situation);
    printf("\tState: %i\n", state);
    printf("\tActions:");
    #endif
    
    unsigned int last_action = state;
    for (i = 0; i < players; i++){
        switch (i){
            case 0:
                last_action = Urn_randomSelect(*((*(player_urns + i))->urns + last_action), rand_state_ptr);
                *(state_action_profile + i) = situation * STATES + last_action;
                break;
            case 1:
                last_action = Urn_randomSelect(*((*(player_urns + i))->urns + (situation * STATES + last_action)), rand_state_ptr);
                *(state_action_profile + i) = situation * MESSAGES + last_action;
                break;
            case 2:
                last_action = Urn_randomSelect(*((*(player_urns + i))->urns + (situation * MESSAGES + last_action)), rand_state_ptr);
                *(state_action_profile + i) = last_action;
                break;
            default:
                exit(EXIT_FAILURE);
                break;            
        }
        
        #ifndef NDEBUG
        printf("  %i", last_action);
        #endif
    }
    
    #ifndef NDEBUG
    printf("\n");
    #endif
    
    *(state_action_profile + players) = state;
    *(state_action_profile + players + 1) = situation;
    
    return state_action_profile;
}

int 
main(int argc, char *argv[])
{
    UNUSED(argc);
    UNUSED(argv);
    
    unsigned int num_players = 3;
    unsigned int num_urns[] = {STATES, SITUATIONS * STATES, SITUATIONS * MESSAGES};
    unsigned int **types = malloc(num_players * sizeof(unsigned int *));
    unsigned int ***initial_counts = malloc(num_players * sizeof(double **));
    unsigned int i, j, k;

    for (i = 0; i < num_players; i++){
        *(types + i) = malloc(*(urn_counts + i) * sizeof(unsigned int));
        *(initial_counts + i) = malloc(*(urn_counts + i) * sizeof(double *));
        for (j = 0; j < *(urn_counts + i); j++){
            switch (i){
                case 0:
                    *(*(types + i) + j) = STATES;
                    break;
                case 1:
                    *(*(types + i) + j) = MESSAGES;
                    break;
                case 2:
                    *(*(types + i) + j) = STATES + 1;
                    break;
            }
            *(*(initial_counts + i) + j) = malloc((j + 1) * sizeof(double));
            for (k = 0; k < (j + 1); k++){
                *(*(*(initial_counts + i) + j) + k) = 1.0;
            }
        }
    }
    
    //actual simulation
    urngame_t * game = UrnGame_create(num_players, urn_counts, types, initial_counts, urnlearning_interaction);
    assert(game != NULL);
    if (game == NULL){
        exit(EXIT_FAILURE);
    }
    
    unsigned int generations = NUM_GENERATIONS;
    urnlearning_dynamics(game, generations, payoffs);
    
    //reports
    
    for (i = 0; i < num_players; i++){
        free(*(types + i));
        for (j = 0; j < *(urn_counts + i); j++){
            free(*(*(initial_counts + i) + j));
        }
        free(*(initial_counts + i));
    }
    free(types);
    free(initial_counts);
}
