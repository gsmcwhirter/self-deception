#include <stdio.h>
#include <stdlib.h>
#include <math.h>

//#include <pthreads.h> //or maybe use https://github.com/Pithikos/C-Thread-Pool

#include <timestamp.h>
#include <saneopt.h>

#include <replicator_dynamics/replicator_population.h>
#include <replicator_dynamics/replicator_game.h>
#include <replicator_dynamics/replicator_simulation.h>

int 
main(int argc, char *argv[])
{
    char *output_dir;
    char *output_file_pat;
    int states = 3;
    int messages = 3;
    int *strategies = malloc(sizeof(int) * 3);
    *(strategies + 0) = pow(states, states);
    *(strategies + 1) = pow(messages, states);
    *(strategies + 2) = pow(states, messages);
    
    game_t *game = Game_create(3, 3, strategies);

    saneopt_t *option_parser = saneopt_init(argc, argv);
    
    saneopt_alias(option_parser, "toprint", "p");
    
    char *text = saneopt_get(option_parser, "toprint");
    if (text == NULL){
        text = "(NULL)";
    }
    
    printf("Working...\n");
    printf("%s\n", text);
    
    return 0;
}
