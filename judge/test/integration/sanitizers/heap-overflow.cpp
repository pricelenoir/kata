#include <bits/stdc++.h>

int main() {
    std::vector<int> v(4);
    int* p = v.data();
    p[4] = 1;  // one past the end
    std::cout << "ok\n";
}
