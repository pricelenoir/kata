#include <bits/stdc++.h>

std::mutex m;
long long counter = 0;

int main() {
    auto work = [] {
        for (int i = 0; i < 1000; ++i) {
            std::lock_guard<std::mutex> g(m);
            ++counter;
        }
    };
    std::thread a(work), b(work);
    a.join();
    b.join();
    std::cout << "ok\n";
}
