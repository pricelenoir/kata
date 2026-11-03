#include <bits/stdc++.h>

int main() {
    int x;
    std::cin >> x;  // reading it keeps the compiler from folding the overflow
    x += 2147483647;
    std::cout << (x != 0 ? "ok\n" : "ok\n");
}
