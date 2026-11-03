#include <bits/stdc++.h>

// Two threads bump a plain counter behind a "lock" that's just a bool.
bool busy = false;
long long counter = 0;

void work() {
    for (int i = 0; i < 1000; ++i) {
        while (busy) {}
        busy = true;
        ++counter;
        busy = false;
    }
}

int main() {
    std::thread a(work), b(work);
    a.join();
    b.join();
    std::cout << "ok\n";
}
