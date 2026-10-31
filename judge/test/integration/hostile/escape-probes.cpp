#include <arpa/inet.h>
#include <cerrno>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <dirent.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/mount.h>
#include <sys/ptrace.h>
#include <sys/socket.h>
#include <unistd.h>

extern char** environ;

// Each check tries one way out; any success is reported by name.
static int failures = 0;
static void expect(bool contained, const char* what) {
    if (!contained) {
        std::printf("ESCAPED: %s\n", what);
        failures++;
    }
}

int main() {
    expect(getuid() == 65534 && geteuid() == 65534, "running as a privileged uid");
    expect(setuid(0) != 0, "setuid(0) succeeded");

    int s = socket(AF_INET, SOCK_STREAM, 0);
    if (s >= 0) {
        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons(53);
        inet_pton(AF_INET, "1.1.1.1", &addr.sin_addr);
        expect(connect(s, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0, "outbound network");
        close(s);
    }

    expect(opendir("/run/kata") == nullptr, "test input staging dir is listable");
    expect(open("/escape", O_WRONLY | O_CREAT, 0644) < 0, "root filesystem is writable");
    expect(access("/var/run/docker.sock", F_OK) != 0 && access("/run/docker.sock", F_OK) != 0, "docker socket visible");
    expect(kill(1, SIGKILL) != 0, "can signal pid 1");
    expect(ptrace(PTRACE_ATTACH, getppid(), nullptr, nullptr) != 0, "can ptrace kata-run");
    expect(open("/proc/1/environ", O_RDONLY) < 0, "can read init's environment");
    expect(mount("none", "/tmp", "tmpfs", 0, nullptr) != 0, "can mount");

    static const char* allowed[] = {"PATH=", "HOME=", "TMPDIR=", "LANG=", "MALLOC_ARENA_MAX=", "RUST_BACKTRACE="};
    for (char** e = environ; *e; ++e) {
        bool ok = false;
        for (const char* prefix : allowed) ok |= std::strncmp(*e, prefix, std::strlen(prefix)) == 0;
        expect(ok, *e);
    }

    if (failures == 0) std::puts("contained");
}
