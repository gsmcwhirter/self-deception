#include <stdio.h>
#include <errno.h>

#ifdef _OPENMP
#include <omp.h>
#endif

int 
main(int argc, char *argv[]){
#ifdef _OPENMP
	printf("Threads: %i\n", omp_get_max_threads());
#else
	printf("No openmp");
#endif

	return 0;
}

