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
#define INSPECT_PROB 0.85
#define INSPECT_COST 0.25
#define NUM_GENERATIONS 300000000

rk_state rand_state;
int rk_state_set = 0;

double ** 
payoffs(unsigned int players, unsigned int **types, unsigned int * state_action_profile)
{
    assert(types != NULL);
    if (types == NULL){
        exit(EXIT_FAILURE);
    }

    double **payoffs = malloc(players * sizeof(double *));
    assert(payoffs != NULL);
    if (payoffs == NULL){
        exit(EXIT_FAILURE);
    }
    
    unsigned int i, j, tmp;
    
    //set payoffs to zero
    for (i = 0; i < players; i++){
        if (i == 0){
            tmp = players;
        }
        else {
            tmp = i-1;
        }
        *(payoffs + i) = malloc(*(*(types + i) + *(state_action_profile + tmp)) * sizeof(double));
        assert(*(payoffs + i) != NULL);
        if(*(payoffs + i) == NULL){
            exit(EXIT_FAILURE);
        }
        
        for (j = 0; j < *(*(types + i) + *(state_action_profile + tmp)); j++){
            *(*(payoffs + i) + j) = 0.0;
        }
    }
    
    //calculate actual payoffs
    unsigned int situation, state, representation, message, action, inspect, real_action, sender_desired_act;
    double sample;
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
        
        sample = rk_double(&rand_state);
        if (sample < INSPECT_PROB){
            real_action = representation;
        }
        else {
            real_action = (unsigned int)rk_interval(STATES - 1, &rand_state); // -1 b/c inclusive
        }
    }
    else {
        inspect = 0;
        real_action = action;
    }
    
    switch (situation){
        case 0: //pure common interest
            *(*(payoffs + 0) + representation) = ((state == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
            *(*(payoffs + 1) + message) = ((state == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
            *(*(payoffs + 2) + action) = ((state == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
            break;
        case 1: //partial common interest
            if (state > 1){
                *(*(payoffs + 0) + representation) = ((state == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
                *(*(payoffs + 1) + message) = ((state == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
                *(*(payoffs + 2) + action) = ((state == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
            }
            else {
                sender_desired_act = 1 - state;
                *(*(payoffs + 0) + representation) = ((sender_desired_act == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
                *(*(payoffs + 1) + message) = ((sender_desired_act == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
                *(*(payoffs + 2) + action) = ((state == real_action) ? MAX_PAYOFF - inspect * INSPECT_COST : 0.0);
            }   
            break;
        default:
            exit(EXIT_FAILURE);
            break;
    }
    
    #ifndef NDEBUG
    printf("Payoffs:\n");
    for (i = 0; i < players; i++){
        if (i == 0){
            tmp = players;
        }
        else {
            tmp = i-1;
        }
        
        for (j = 0; j < *(*(types + i) + *(state_action_profile + tmp)); j++){
            printf("  %g", *(*(payoffs + i) + j));
        }
        
        printf("\n");
    }
    #endif
    
    return payoffs;
}

//unsigned int gen_done = 0;

unsigned int * 
urnlearning_interaction(unsigned int players, urncollection_t **player_urns, rk_state *rand_state_ptr)
{   
    //gen_done++;
    //printf("\r\r");
    //printf("Generation %i...\n", gen_done);

    assert(player_urns != NULL);
    if (player_urns == NULL){
        exit(EXIT_FAILURE);
    }
    
    assert(rand_state_ptr != NULL);
    if (rand_state_ptr == NULL){
        exit(EXIT_FAILURE);
    }

    unsigned int situation;
    situation = (unsigned int)rk_interval(SITUATIONS - 1, rand_state_ptr); // - 1 b/c inclusive
    unsigned int state;
    state = (unsigned int)rk_interval((*(player_urns + 0))->num_urns - 1, rand_state_ptr); // -1 b/c inclusive
    
    unsigned int * state_action_profile = malloc((players + 2) * sizeof(unsigned int));
    unsigned int i;
    
    unsigned int last_action = state;
    for (i = 0; i < players; i++){
        /*
        printf("situation: %i\n", situation);
        printf("player: %i\n", i);
        printf("last action: %i\n", last_action);
        */
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
        
    }
    
    #ifndef NDEBUG
    printf("Interaction:\n");
    printf("  Situation: %i\n", situation);
    printf("  State: %i\n", state);
    printf("  Actions:");
    printf("  %i  %i  %i\n", *(state_action_profile + 0) - situation * STATES, *(state_action_profile + 1) - situation * MESSAGES, *(state_action_profile + 2));
    #endif
    
    *(state_action_profile + players) = state;
    *(state_action_profile + players + 1) = situation;
    
    return state_action_profile;
}

void 
display_game(urngame_t * game){
    unsigned int i, j;
    
    char *prefix = "  ";
    for (i = 0; i < game->num_players; i++){
        printf("Player %i\n", i);
        urncollection_t * urncoll = *(game->player_urns + i);
        for (j = 0; j < urncoll->num_urns; j++){
            Urn_display(*(urncoll->urns + j), prefix);
            printf("\n");
        }
    }
}

int 
main(int argc, char *argv[])
{
    UNUSED(argc);
    UNUSED(argv);
    
    unsigned int num_players = 3;
    unsigned int *urn_counts = malloc(num_players * sizeof(unsigned int));
    assert(urn_counts != NULL);
    if (urn_counts == NULL){
        exit(EXIT_FAILURE);
    }
    *(urn_counts + 0) = STATES;
    *(urn_counts + 1) = SITUATIONS * STATES;
    *(urn_counts + 2) = SITUATIONS * MESSAGES;
    unsigned int **types = malloc(num_players * sizeof(unsigned int *));
    assert(types != NULL);
    if (types == NULL){
        exit(EXIT_FAILURE);
    }
    double ***initial_counts = malloc(num_players * sizeof(double **));
    assert(initial_counts != NULL);
    if (initial_counts == NULL){
        exit(EXIT_FAILURE);
    }
    unsigned int i, j, k;

    for (i = 0; i < num_players; i++){
        *(types + i) = malloc(*(urn_counts + i) * sizeof(unsigned int));
        assert(*(types + i) != NULL);
        if (*(types + i) == NULL){
            exit(EXIT_FAILURE);
        }
        *(initial_counts + i) = malloc(*(urn_counts + i) * sizeof(double *));
        assert(*(initial_counts + i) != NULL);
        if (*(initial_counts + i) == NULL){
            exit(EXIT_FAILURE);
        }
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
            *(*(initial_counts + i) + j) = malloc(*(*(types + i) + j) * sizeof(double));
            assert(*(*(initial_counts + i) + j) != NULL);
            if (*(*(initial_counts + i) + j) == NULL){
                exit(EXIT_FAILURE);
            }
            for (k = 0; k < *(*(types + i) + j); k++){
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
    
    printf("\n");
    display_game(game);
    printf("\n");
    
    unsigned int generations = NUM_GENERATIONS;
    printf("Running for %i interactions...\n", generations);
    urnlearning_dynamics(game, generations, payoffs);
    printf("done.\n\n");
    
    //reports
    display_game(game);
    
    for (i = 0; i < num_players; i++){
        free(*(types + i));
        for (j = 0; j < *(urn_counts + i); j++){
            free(*(*(initial_counts + i) + j));
        }
        free(*(initial_counts + i));
    }
    free(types);
    free(initial_counts);
    
    return 0;
}
