#include <bits/stdc++.h>

int* make() { return new int[16]; }

int main() {
    int* p = make();
    p[0] = 1;
    p = nullptr;
    std::cout << "ok\n";
}
