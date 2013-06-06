#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <errno.h>
#include <inttypes.h>

#include <simulations/urnlearning_urns.h>
#include <simulations/urnlearning_game.h>
#include <simulations/urnlearning_simulation.h>
#include <simulations/randomkit.h>

#include "commander.h"
#include "timestamp.h"

#ifdef _OPENMP
#include <omp.h>
#endif

#define UNUSED(x) (void)(x)
#define SITUATIONS 2
#define STATES 3
#define MESSAGES 3

double max_payoff = 1.0;
double inspect_prob = 0.85;
double inspect_cost = 0.25;

rk_state rand_state;
int rk_state_set = 0;
int be_verbose = 0;
int dump_to_files = 0;
unsigned long duplications = 1;
long threads = 1;
unsigned long generations = 1000000;

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
        if (sample < inspect_prob){
            switch (situation){
                case 0: //pure common interest
                    real_action = representation;
                    break;    
                case 1: //partial common interest
                    if (representation > 1){
                        real_action = representation;
                    }
                    else {
                        real_action = 1 - representation;
                    }
                    break;
                default:
                    exit(EXIT_FAILURE);
                    break;
            }
            
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
            *(*(payoffs + 0) + representation) = ((state == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
            *(*(payoffs + 1) + message) = ((state == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
            *(*(payoffs + 2) + action) = ((state == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
            break;
        case 1: //partial common interest
            if (state > 1){
                *(*(payoffs + 0) + representation) = ((state == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
                *(*(payoffs + 1) + message) = ((state == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
                *(*(payoffs + 2) + action) = ((state == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
            }
            else {
                sender_desired_act = 1 - state;
                *(*(payoffs + 0) + representation) = ((sender_desired_act == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
                *(*(payoffs + 1) + message) = ((sender_desired_act == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
                *(*(payoffs + 2) + action) = ((state == real_action) ? max_payoff - inspect * inspect_cost : 0.0);
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

unsigned int * 
urnlearning_interaction(unsigned int players, urncollection_t **player_urns, rk_state *rand_state_ptr)
{   
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
display_game(urngame_t * game, FILE *outfile){
    unsigned int i, j;
    
    if (outfile == NULL){
        outfile = stdout;
    }
    
    char *prefix = "  ";
    for (i = 0; i < game->num_players; i++){
        fprintf(outfile, "Player %i\n", i);
        urncollection_t * urncoll = *(game->player_urns + i);
        for (j = 0; j < urncoll->num_urns; j++){
            Urn_display(*(urncoll->urns + j), prefix, outfile);
            fprintf(outfile, "\n");
        }
    }
}

static void
handle_verbose(command_t *self)
{
    UNUSED(self);
    be_verbose = 1;
    printf("verbose output enabled.\n");
}

static void
handle_files(command_t *self)
{
    UNUSED(self);
    dump_to_files = 1;
    
    if (be_verbose){
        printf("dumping output to files.\n");
    }
}

static void
handle_duplications(command_t *self)
{
    if (self->arg != NULL){
        errno = 0;
        duplications = strtoul(self->arg, NULL, 0);
        if (errno || duplications == 0){
            printf("Number of duplications is invalid.\n");
            exit(EXIT_FAILURE);
        }
    }
}

static void
handle_interactions(command_t *self){
    if (self->arg != NULL){
        errno = 0;
        generations = strtoul(self->arg, NULL, 0);
        if (errno || generations == 0){
            printf("Number of interactions is invalid.\n");
            exit(EXIT_FAILURE);
        }
    }
}

static void
handle_threads(command_t *self)
{
    if (self->arg != NULL){
        errno = 0;
        threads = strtol(self->arg, NULL, 0);
        if (errno || threads == 0){
            printf("Number of threads is invalid.\n");
            exit(EXIT_FAILURE);
        }
    }
}

static void
handle_inspect_prob(command_t *self)
{
    if (self->arg != NULL){
        errno = 0;
        inspect_prob = strtod(self->arg, NULL);
        if (errno || inspect_prob < 0.0 || inspect_prob > 1.0){
            printf("Inspection probability is invalid.\n");
            exit(EXIT_FAILURE);
        }
    }
}

static void
handle_inspect_cost(command_t *self)
{
    if (self->arg != NULL){
        errno = 0;
        inspect_cost = strtod(self->arg, NULL);
        if (errno || inspect_cost < 0.0){
            printf("Inspection cost is invalid.");
            exit(EXIT_FAILURE);
        }
    }
}

unsigned numDigits(const unsigned n) {
    if (n < 10) return 1;
    return 1 + numDigits(n / 10);
}

int 
main(int argc, char *argv[])
{
    int64_t start_time = timestamp();
    command_t options;
    command_init(&options, argv[0], "0.0.1");
    command_option(&options, "-v", "--verbose", "enable verbose stuff", handle_verbose);
    command_option(&options, "-f", "--files", "dump output to files", handle_files);
    command_option(&options, "-i", "--interactions <arg>", "number of interactions to run (default 1000000)", handle_interactions);
    command_option(&options, "-N", "--duplications <arg>", "number of duplications to run (default 1)", handle_duplications);
    command_option(&options, "-M", "--threads <arg>", "number of threads to use (openmp, default 1)", handle_threads);
    command_option(&options, "-p", "--inspect_prob <arg>", "probability of successful inspection (default 0.85)", handle_inspect_prob);
    command_option(&options, "-c", "--inspect_cost <arg>", "cost of inspection (default 0.25)", handle_inspect_cost);
    command_parse(&options, argc, argv);
    
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
    unsigned long dup;

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
    
    printf("Running %lu duplications for %lu interactions...\n", duplications, generations);
    
#ifdef _OPENMP
    omp_set_dynamic(0);
    omp_set_nested(1);
    
    if (threads < 0){
        int num_procs = omp_get_num_procs();
        if (num_procs < 2){
            threads = 1;
        }
        else {
            threads = num_procs - 1;
        }
    }
    
    omp_set_num_threads(threads);
    
    #ifdef NDEBUG
    if (be_verbose){
    #endif
    printf("Number of threads: %li\n", threads);
    #ifdef NDEBUG
    }
    #endif    
    
    #pragma omp parallel for
#endif
    for (dup = 0; dup < duplications; dup++){
        #ifdef NDEBUG
        if (be_verbose){
        #endif
        printf("Starting duplication %lu...\n", dup + 1);
        #ifdef NDEBUG
        }
        #endif
    
        int64_t dup_start_time = timestamp(); 
        urngame_t *gamedup = UrnGame_clone(game);
        
        #ifdef NDEBUG
        if (be_verbose){
        #endif
        printf("Done cloning the game for duplication %lu.\n", dup + 1);
        #ifdef NDEBUG
        }
        #endif
    
        FILE *outfile = NULL;
        char *filename;
        int filename_size = numDigits(dup + 1) + 17; //17 is the length of "duplication_.out" plus the terminating null
        
        if (dump_to_files){
            filename = malloc(filename_size * sizeof(char));
            snprintf(filename, filename_size, "duplication_%lu.out", dup + 1);
            outfile = fopen(filename, "w");
            free(filename);
        }
        else {
            outfile = stdout;
        }
        
        fprintf(outfile, "Running for %lu interactions.\n\n", generations);
    
        fprintf(outfile, "Initial State:\n");
        display_game(gamedup, outfile);
        fprintf(outfile, "\n");
        urnlearning_dynamics(gamedup, generations, payoffs);
        fprintf(outfile, "done.\n\n");
        
        //reports
        display_game(gamedup, outfile);
        
        UrnGame_destroy(gamedup);
        
        fprintf(outfile, "\nTime taken: %" PRId64 " ms\n", timestamp() - dup_start_time);
        
        if (dump_to_files){
            fclose(outfile);
        }
        
        #ifdef NDEBUG
        if (be_verbose){
        #endif
        printf("Done duplication %lu.\n", dup + 1);
        #ifdef NDEBUG
        }
        #endif
    }
    
    for (i = 0; i < num_players; i++){
        free(*(types + i));
        for (j = 0; j < *(urn_counts + i); j++){
            free(*(*(initial_counts + i) + j));
        }
        free(*(initial_counts + i));
    }
    free(types);
    free(initial_counts);
    free(urn_counts);
    UrnGame_destroy(game);
    command_free(&options);
    
    #ifdef NDEBUG
    if (be_verbose){
    #endif
    printf("Total time: %" PRId64 " ms\n", timestamp() - start_time);
    #ifdef NDEBUG
    }
    #endif
    
    return 0;
}
