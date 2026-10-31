#include <cstdlib>
#include <cstring>
// Touch every page so it's real memory, not just a reservation.
int main() {
    for (;;) {
        char* p = static_cast<char*>(std::malloc(64 << 20));
        if (!p) return 3;
        std::memset(p, 1, 64 << 20);
    }
}
