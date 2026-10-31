#include <cstdio>
int main() {
    static char line[4096];
    for (int i = 0; i < 4095; ++i) line[i] = 'x';
    for (;;) std::fputs(line, stdout);
}
