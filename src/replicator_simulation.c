// Exploratory simulations for the double-state game

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

//#include <replicator_dynamics/randomkit.h>
#include "replicator_population.h"
#include "replicator_game.h"
#include "replicator_simulation.h"

#define VERSION "0.0.1"

#define UNUSED(x) (void)(x)
#define SITUATIONS 2
// 3
#define STATES 2
// 3
#define MESSAGES 2
#define MAX_PAYOUT 1.0 
#define INSPECT_COST 0.5
#define INSPECT_PROB 0.75
#define ALPHA 0.0
#define EFFECTIVE_ZERO 0.00000008
#define MAX_GENERATIONS 0
#define GEN_REPORT_INTERVAL 1
//9
#define GEN_REPORT_PER_ROW 8
//0
#define USE_CACHING 1

//thirds
const double state_probs[STATES] = {0.5, 0.5};
const double sit_probs[SITUATIONS] = {0.5, 0.5};

extern int simulation_num_procs;
extern int simulation_max_threads;

// Gets the value of the bit-th bit (counting from 0) of the number in the given base (3 for my purposes)
int 
base_n_bit(const int base, const int number, const int bit)
{
    return (number / (int)pow(base, bit)) % base;
}

/* Not the right way for replicator expectations
int
get_real_action(int action, int repr)
{
    if (action == STATES){
        rk_state rand_state;
        rk_randomseed(&rand_state);
        double sample = rk_double(&rand_state);
        
        if (sample < INSPECT_PROB){
            return repr;
        }
        else {
            return (int)rk_interval(STATES - 1, &rand_state); // -1 b/c inclusive
        }
    }
    else {
        return action;
    }
}
*/

double * 
game_payoffs(int players, int *profile)
{
    double *payoffs = malloc(players * sizeof(double));
    double prob;
    int i, sit, state, representation, message, action, /*real_action,*/ inspect, sender_desired_act;
    
    for (i = 0; i < players; i++){
        *(payoffs + i) = 0;
    }
    
    for (sit = 0; sit < SITUATIONS; sit++){
        for (state = 0; state < STATES; state++){
            prob = sit_probs[sit] * state_probs[state];
            
            representation = base_n_bit(STATES, *(profile + 0), state);
            message = base_n_bit(MESSAGES, *(profile + 1), sit * STATES + representation);
            action = base_n_bit(STATES + 1, *(profile + 2), sit * MESSAGES + message);
            //real_action = get_real_action(action, representation);
            
            if (action == STATES){
                inspect = 1;
                switch (sit){
                    case 0: //pure common interest
                        *(payoffs + 0) += prob * (INSPECT_PROB * ((representation == state) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[state]) * MAX_PAYOUT; 
                        *(payoffs + 1) += prob * (INSPECT_PROB * ((representation == state) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[state]) * MAX_PAYOUT;
                        *(payoffs + 2) += prob * ((INSPECT_PROB * ((representation == state) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[state]) * MAX_PAYOUT - inspect * INSPECT_COST);
                        break;
                    case 1: //minimal divergent interest
                        if (state > 1){ // common interest on all but the first 2 states
                            *(payoffs + 0) += prob * (INSPECT_PROB * ((representation == state) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[state]) * MAX_PAYOUT; 
                            *(payoffs + 1) += prob * (INSPECT_PROB * ((representation == state) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[state]) * MAX_PAYOUT;
                            *(payoffs + 2) += prob * ((INSPECT_PROB * ((representation == state) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[state]) * MAX_PAYOUT - inspect * INSPECT_COST);
                        }
                        else { //totally divergent interest in the first two states
                            sender_desired_act = 1 - state;
                            *(payoffs + 0) += prob * (INSPECT_PROB * ((representation == sender_desired_act) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[sender_desired_act]) * MAX_PAYOUT; 
                            *(payoffs + 1) += prob * (INSPECT_PROB * ((representation == sender_desired_act) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[sender_desired_act]) * MAX_PAYOUT;
                            *(payoffs + 2) += prob * ((INSPECT_PROB * ((representation == state) ? 1.0 : 0.0) + (1 - INSPECT_PROB) * state_probs[state]) * MAX_PAYOUT - inspect * INSPECT_COST);
                        }
                        break;
                    default: //how did we get here?
                        assert(0);
                        break;
                }
            } 
            else if (action < STATES){
                inspect = 0;
                switch (sit){
                    case 0: //pure common interest
                        *(payoffs + 0) += prob * ((action == state) ? MAX_PAYOUT : 0); 
                        *(payoffs + 1) += prob * ((action == state) ? MAX_PAYOUT : 0);
                        *(payoffs + 2) += prob * ((action == state) ? MAX_PAYOUT : 0);
                        break;
                    case 1: //minimal divergent interest
                        if (state > 1){ // common interest on all but the first 2 states
                            *(payoffs + 0) += prob * ((action == state) ? MAX_PAYOUT : 0); 
                            *(payoffs + 1) += prob * ((action == state) ? MAX_PAYOUT : 0);
                            *(payoffs + 2) += prob * ((action == state) ? MAX_PAYOUT : 0);
                        }
                        else { //totally divergent interest in the first two states
                            sender_desired_act = 1 - state;
                            *(payoffs + 0) += prob * ((action == sender_desired_act) ? MAX_PAYOUT : 0); 
                            *(payoffs + 1) += prob * ((action == sender_desired_act) ? MAX_PAYOUT : 0);
                            *(payoffs + 2) += prob * ((action == state) ? MAX_PAYOUT : 0);
                        }
                        break;
                    default: //how did we get here?
                        assert(0);
                        break;
                }
            }
            else {
                //how did this happen?
                assert(0);
            }
        }
    }
    
    return payoffs;
}

void
describe_strategy(char *prefix, int player, int strategy)
{
    int i, j;
    switch (player){
        case 0: //unconscious
            for (i = 0; i < STATES; i++){
                printf("%s%i->%i\n", prefix, i, base_n_bit(STATES, strategy, i));
            }
            break;
        case 1: //conscious
            for (j = 0; j < SITUATIONS; j++){
                printf("%sSituation %i:\n", prefix, j);
                for (i = 0; i < STATES; i++){
                    printf("%s  %i->%i\n", prefix, i, base_n_bit(MESSAGES, strategy, j * STATES + i));
                }
            }
            break;
        case 2: //receiver
            for (j = 0; j < SITUATIONS; j++){
                printf("%sSituation %i:\n", prefix, j);
                for (i = 0; i < MESSAGES; i++){
                    printf("%s  %i->%i\n", prefix, i, base_n_bit(STATES + 1, strategy, j * MESSAGES + i));
                }
            }
            break;
        default: //how did we get here?
            assert(0);
            break;
    }
}

void
report_populations(char *prefix, popcollection_t *popc)
{
    int i, j, k, mod;
    population_t *pop;

    for (i = 0; i < popc->size; i++){
        pop = *(popc->populations + i);
        mod = pop->size % GEN_REPORT_PER_ROW;
        printf("%sPopulation %i:\n", prefix, i);
        for (j = 0; j < (pop->size - mod); j += GEN_REPORT_PER_ROW){
            printf("%s", prefix);
            for (k = 0; k < GEN_REPORT_PER_ROW; k++){
                printf("  %e", *(pop->proportions + j + k));
            }
            printf("\n");
        }
        
        if (mod > 0){
            printf("%s", prefix);
            for (k = 0; k < mod; k++){
                printf("  %e", *(pop->proportions + pop->size - mod + k));
            }
            printf("\n");
        }
    }
}

void
generation_report(game_t *game, int generation, popcollection_t *popc)
{
    UNUSED(game);
    
    char *prefix = "\t";
    //print out every GEN_REPORT_INTERVAL generations
    if ((generation % GEN_REPORT_INTERVAL) == 0){
        printf("Generation %i:\n", generation);
        report_populations(prefix, popc);
        printf("\n");
    }
}

void
final_report(game_t *game, popcollection_t *final_pop, double effective_zero)
{
    UNUSED(game);
    char *prefix = "\t  ";
    int i, j;
    population_t *pop;
    
    for (i = 0; i < final_pop->size; i++){
        pop = *(final_pop->populations + i);
        printf("Population %i:\n", i);
        for (j = 0; j < pop->size; j++){
            if (*(pop->proportions + j) > effective_zero){
                printf("\tStrategy %i (%e):\n", j, *(pop->proportions + j));
                describe_strategy(prefix, i, j);
            }
        }
    }
}

int 
main(int argc, char *argv[])
{
    UNUSED(argc);
    UNUSED(argv);

    int *strategies = malloc(sizeof(int) * 3);
    // For the unconscious
    *(strategies + 0) = pow(STATES, STATES);
    // For the conscious
    *(strategies + 1) = pow(MESSAGES, STATES * SITUATIONS);
    // For the receiver
    *(strategies + 2) = pow(STATES + 1, MESSAGES * SITUATIONS);
    
    int i;
    
    double alpha = ALPHA;
    double effective_zero = EFFECTIVE_ZERO;
    int max_gens = MAX_GENERATIONS;
    
    printf("Procedure:\n");
    printf("\t1. Nature chooses a Situation.\n");
    printf("\t2. Nature chooses a State of the World.\n");
    printf("\t3a. The Unconscious observes the State but not Situation.\n");
    printf("\t3b. The Unconscious Represents the State to the Conscious.\n");
    printf("\t4a. The Conscious observes the Representation and the Situation, but not the actual State.\n");
    printf("\t4b. The Conscious sends a Message to the Receiver.\n");
    printf("\t5a. The Receiver observes the Message and the Situation, but not the Representation or State.\n");
    printf("\t5b. The Receiver elects to Inspect the Representation at a cost, or not.\n");
    printf("\t5c. If the receiver chooses Inspect, then with some probability learns the actual Representation, otherwise a random Representation.\n");
    printf("\t5d. The Receiver selects an Action, strategically without Inspecting the Representation, or best-response when Inspecting.\n");
    printf("\t6. Payoffs are determined by the State, Action, and Inspect parameters.\n");
    printf("\n");
    printf("Situation types: %i\n", SITUATIONS);
    printf("\tProbabilities:");
    for (i = 0; i < SITUATIONS; i++){
        printf(" %e", sit_probs[i]);
    }
    printf("\n");
    printf("States of the World: %i\n", STATES);
    printf("\tProbabilities:");
    for (i = 0; i < STATES; i++){
        printf(" %e", state_probs[i]);
    }
    printf("\n");
    printf("Messages available: %i\n", MESSAGES);
    printf("Cost of inspection: %e\n", INSPECT_COST);
    printf("Strategies for the Unconscious: %i\n", *(strategies + 0));
    printf("Strategies for the Conscious: %i\n", *(strategies + 1));
    printf("Strategies for the Receiver: %i\n", *(strategies + 2));
    printf("Effective Zero: %e\n", effective_zero);
    printf("Probability of Inspect Success: %e\n", INSPECT_PROB);
    printf("Cost of Inspecting: %e\n", INSPECT_COST);
    printf("Payoff for Success: %f\n", MAX_PAYOUT);
    printf("Alpha value: %e\n", alpha);
    printf("Max Generations: %i\n", max_gens);
    printf("\n");
    
    unsigned int count;
    count = (*(strategies + 0)) * (*(strategies + 1)) * (*(strategies + 2)) * ((int)sizeof(double) * 3 + (int)sizeof(double *));
    printf("Caching Memory Estimate (B): %u\n", count);
    
    double kb;
    kb = (double)count / 1024.0;
    printf("Caching Memory Estimate (kB): %f\n", kb);
    
    double mb;
    mb = kb / 1024.0;
    printf("Caching Memory Estimate (MB): %f\n", mb);
    printf("\n");
    
    replicator_dynamics_setup();
    printf("Number of Processors: %i\n", simulation_num_procs);
    printf("Maximum Threads: %i\n", simulation_max_threads);
    printf("\n");
    
    char *prefix = "\t";
    game_t *game = Game_create(3, 3, strategies, game_payoffs);
    popcollection_t *start_pop = Game_PopCollection_create(game);
    PopCollection_randomize(start_pop);
    printf("Starting Populations:\n");
    report_populations(prefix, start_pop);
    printf("\n");
    
    assert(game != NULL);
    assert(start_pop != NULL);
    
    printf("Starting simulations...\n");
    popcollection_t *final_pop = replicator_dynamics(game, start_pop, alpha, effective_zero, max_gens, CACHE_NONE, generation_report);
    printf("Done simulations.\n");
    printf("Final Populations:\n");
    report_populations("\t", final_pop);
    printf("\n");
    
    final_report(game, final_pop, effective_zero);

    free(strategies);
    PopCollection_destroy(start_pop);
    PopCollection_destroy(final_pop);
    Game_destroy(game);
    return 0;
}
