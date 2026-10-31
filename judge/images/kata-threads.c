// Preloaded into every judged program (LD_PRELOAD, set by the judge).
//
// glibc sizes each new thread's stack from RLIMIT_STACK, which the judge
// sets as high as the memory limit so deep recursion on the main thread
// works. Without this, every std::thread would reserve that much too, and
// gVisor counts those reservations as resident memory.
#define _GNU_SOURCE
#include <pthread.h>

__attribute__((constructor)) static void kata_default_thread_stacks(void) {
  pthread_attr_t attr;
  if (pthread_attr_init(&attr) != 0) return;
  pthread_attr_setstacksize(&attr, 8u << 20);
  pthread_setattr_default_np(&attr);
  pthread_attr_destroy(&attr);
}
