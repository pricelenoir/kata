#include <cstdio>
#include <unistd.h>
// Double-forks a daemon that keeps stdout open. If kata-run waited for the
// pipe to close it would hang until the wall limit; it must kill the daemon
// as soon as the main process exits instead.
int main() {
    if (fork() == 0) {
        setsid();
        if (fork() == 0) {
            sleep(30);
            std::puts("escaped");
        }
        return 0;
    }
    std::puts("contained");
    std::fflush(stdout);
}
