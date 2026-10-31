#include <cstdio>
#include <pthread.h>
#include <unistd.h>
static void* idle(void*) { pause(); return nullptr; }
// The pid limit must stop this well short of 10,000.
int main() {
    int made = 0;
    for (; made < 10000; ++made) {
        pthread_t t;
        if (pthread_create(&t, nullptr, idle, nullptr) != 0) break;
    }
    std::puts(made < 10000 ? "contained" : "escaped");
    std::fflush(stdout);
    _exit(0);
}
