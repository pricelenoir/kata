#include <csignal>
#include <cstdio>
#include <string>
#include <fcntl.h>
#include <unistd.h>
// Writes until the file-size limit and the tmpfs quota both stop it.
int main() {
    std::signal(SIGXFSZ, SIG_IGN);
    static char block[1 << 20];
    for (int f = 0; f < 1000; ++f) {
        std::string path = "/work/fill" + std::to_string(f);
        int fd = open(path.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
        if (fd < 0) break;
        bool full = false;
        for (int i = 0; i < 64; ++i) {
            if (write(fd, block, sizeof block) != (ssize_t)sizeof block) { full = true; break; }
        }
        close(fd);
        if (full && f > 8) break;
    }
    std::puts("contained");
}
