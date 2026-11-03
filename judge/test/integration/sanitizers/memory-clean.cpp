#include <bits/stdc++.h>

int main() {
    auto v = std::make_unique<std::vector<int>>(1000, 1);
    std::cout << (std::accumulate(v->begin(), v->end(), 0) == 1000 ? "ok\n" : "bad\n");
}
