int depth(volatile int n) { volatile char pad[4096]; pad[0] = 1; return depth(n + 1) + pad[0]; }
int main() { return depth(0); }
