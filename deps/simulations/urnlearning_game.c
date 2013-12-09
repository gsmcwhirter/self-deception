#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include "urnlearning_urns.h"
#include "urnlearning_game.h"
#include "randomkit.h"

urngame_t *
UrnGame_create(unsigned int num_players, unsigned int *num_urns, unsigned int **types, double ***initial_counts, urn_interaction func)
{
    assert(num_urns != NULL);
    assert(types != NULL);
    
    unsigned int i, j;
    
    urngame_t *urngame = malloc(sizeof(urngame_t));
    assert(urngame != NULL);
    
    urngame->num_players = num_players;
    urngame->types = malloc(urngame->num_players * sizeof(unsigned int *));
    assert(urngame->types != NULL);
    
    for (i = 0; i < num_players; i++){
        *(urngame->types + i) = malloc(*(num_urns + i) * sizeof(unsigned int));
        assert(*(urngame->types + i) != NULL);
        for (j = 0; j < *(num_urns + i); j++){
            *(*(urngame->types + i) + j) = *(*(types + i) + j); 
        }
    }
    
    if (func != NULL){
        urngame->interaction_function = func;    
    }
    else {
        urngame->interaction_function = default_urnlearning_interaction;
    }
    urngame->player_urns = malloc(urngame->num_players * sizeof(urncollection_t *));
    assert(urngame->player_urns != NULL);
    
    for (i = 0; i < urngame->num_players; i++){
        *(urngame->player_urns + i) = UrnCollection_create(*(num_urns + i), *(types + i), (initial_counts == NULL) ? NULL : *(initial_counts + i));
    }
    
    return urngame;
}

void
UrnGame_destroy(urngame_t *urngame)
{
    unsigned int i;
    if (urngame != NULL){
        for (i = 0; i < urngame->num_players; i++){
            UrnCollection_destroy(*(urngame->player_urns + i));
            
            free(*(urngame->types + i));
        }
        free(urngame->types);
        free(urngame->player_urns);
        free(urngame);
    }
}

void
UrnGame_copy(urngame_t *source, urngame_t *target)
{
    assert(source != NULL);
    assert(target != NULL);
    assert(source->num_players == target->num_players);
    if (source == NULL || target == NULL || source->num_players != target->num_players){
        exit(EXIT_FAILURE);
    }
    
    unsigned int i;
    
    for (i = 0; i < source->num_players; i++){
        UrnCollection_copy(*(source->player_urns + i), *(target->player_urns + i));
    }
}

urngame_t *
UrnGame_clone(urngame_t *urngame)
{
    assert(urngame != NULL);
    if (urngame == NULL){
        exit(EXIT_FAILURE);
    }
    
    unsigned int i;
    unsigned int * num_urns = malloc(urngame->num_players * sizeof(unsigned int));
    for (i = 0; i < urngame->num_players; i++){
        *(num_urns + i) = (*(urngame->player_urns + i))->num_urns;
    }
    
    urngame_t * newgame = UrnGame_create(urngame->num_players, num_urns, urngame->types, NULL, urngame->interaction_function);
    UrnGame_copy(urngame, newgame);
    free(num_urns);
    return newgame;
}

unsigned int * 
default_urnlearning_interaction(unsigned int players, urncollection_t **player_urns, rk_state *rand_state_ptr)
{   
    unsigned int state;
    state = (unsigned int)rk_interval((*(player_urns + 0))->num_urns - 1, rand_state_ptr); //-1 because this is inclusive
    
    unsigned int * state_action_profile = malloc((players + 1) * sizeof(unsigned int));
    unsigned int i;
    
    unsigned int last_action = state;
    for (i = 0; i < players; i++){
        *(state_action_profile + i) = Urn_randomSelect(*((*(player_urns + i))->urns + last_action), rand_state_ptr);
        last_action = *(state_action_profile + i); 
    }
    
    #ifndef NDEBUG
    printf("Interaction:\n");
    printf("\tState: %i\n", state);
    printf("\tActions:");
    for (i = 0; i < players; i++){
        printf("  %i", *(state_action_profile + i));
    }
    printf("\n");
    #endif
    
    *(state_action_profile + players) = state;
    
    return state_action_profile;
}
