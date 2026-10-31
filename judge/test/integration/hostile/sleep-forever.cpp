#include <unistd.h>
// Uses no CPU, so only the wall-clock limit can stop it.
int main() { for (;;) sleep(60); }
