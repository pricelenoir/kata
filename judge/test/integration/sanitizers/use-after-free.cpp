#include <bits/stdc++.h>

int main() {
    int* p = new int(7);
    delete p;
    volatile int x = *p;  // volatile: the read can't be optimized away
    (void)x;
    std::cout << "ok\n";
}
