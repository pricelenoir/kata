// kata-run: the trusted half of a judge sandbox.
//
// Runs as root inside the container (with only CAP_SETUID, CAP_SETGID and
// CAP_KILL) and executes untrusted programs as uid/gid 65534. Different uid
// means the untrusted code can't ptrace, signal, or read the memory of this
// process — so the measurements it reports, and the test inputs it holds,
// stay out of reach even though both run in the same container.
//
//   kata-run put <path> <max-bytes>
//       Copy stdin to <path> as the sandbox user (refuses to overwrite).
//
//   kata-run batch [options] -- <command> [args...]
//       stdin is a stream of frames: "<length>\n" followed by <length> bytes.
//       For each frame, runs <command> once with those bytes as its stdin
//       and writes one JSON line describing the run to stdout. Frames are
//       read lazily, so the caller can send the next test only after seeing
//       the previous result (and stop early by closing stdin).
//
//   batch options:
//       --cpu-ms N       CPU time limit (default 1000)
//       --wall-ms N      wall clock limit (default 3 x cpu + 1000)
//       --mem-mb N       stack limit; the judge reports MLE from peak RSS, and
//                        the container's memory cgroup is the hard backstop
//       --fsize-mb N     largest file the program may write (default 16)
//       --stdout-max N   bytes of stdout kept before output_limit (default 16 MiB)
//       --stderr-max N   bytes of stderr kept; the rest is counted, not kept
//       --env K=V        extra environment variable (repeatable)
//
// Expected outputs never enter the container: the judge compares outside.

#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define SANDBOX_UID 65534
#define SANDBOX_GID 65534
#define MAX_ENV 32

struct options {
  long cpu_ms;
  long wall_ms;
  long mem_mb;
  long fsize_mb;
  size_t stdout_max;
  size_t stderr_max;
  char *env[MAX_ENV + 8];
  int env_count;
  char **argv;
};

struct buffer {
  char *data;
  size_t len;  // bytes kept
  size_t cap;
  size_t total;  // bytes seen
};

static void die(const char *what) {
  fprintf(stderr, "kata-run: %s: %s\n", what, strerror(errno));
  exit(2);
}

static long now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1000L + ts.tv_nsec / 1000000L;
}

static void drop_privileges(void) {
  if (setgroups(0, NULL) != 0 || setgid(SANDBOX_GID) != 0 || setuid(SANDBOX_UID) != 0) {
    die("drop privileges");
  }
  // Paranoia: if regaining root works, the drop didn't stick.
  if (getuid() != SANDBOX_UID || geteuid() != SANDBOX_UID || setuid(0) == 0) {
    fprintf(stderr, "kata-run: privilege drop did not stick\n");
    _exit(2);
  }
}

// SIGKILL every process owned by the sandbox user. A helper drops to that
// uid and calls kill(-1), which reaches exactly the processes it's allowed
// to signal — all of them, including double-forked daemons that escaped
// the process group — but never this (root) process.
static void kill_sandbox_processes(void) {
  for (int round = 0; round < 3; round++) {
    pid_t helper = fork();
    if (helper == 0) {
      drop_privileges();
      kill(-1, SIGKILL);
      _exit(0);
    }
    if (helper > 0) waitpid(helper, NULL, 0);
  }
}

static void buffer_append(struct buffer *b, const char *src, size_t n, size_t keep_max) {
  b->total += n;
  if (b->len >= keep_max) return;
  size_t take = n;
  if (b->len + take > keep_max) take = keep_max - b->len;
  if (b->len + take > b->cap) {
    size_t cap = b->cap ? b->cap : 4096;
    while (cap < b->len + take) cap *= 2;
    char *p = realloc(b->data, cap);
    if (!p) die("realloc");
    b->data = p;
    b->cap = cap;
  }
  memcpy(b->data + b->len, src, take);
  b->len += take;
}

static void print_base64(const char *data, size_t len) {
  static const char tbl[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const unsigned char *s = (const unsigned char *)data;
  size_t i = 0;
  for (; i + 2 < len; i += 3) {
    putchar(tbl[s[i] >> 2]);
    putchar(tbl[((s[i] & 3) << 4) | (s[i + 1] >> 4)]);
    putchar(tbl[((s[i + 1] & 15) << 2) | (s[i + 2] >> 6)]);
    putchar(tbl[s[i + 2] & 63]);
  }
  if (i < len) {
    putchar(tbl[s[i] >> 2]);
    if (i + 1 < len) {
      putchar(tbl[((s[i] & 3) << 4) | (s[i + 1] >> 4)]);
      putchar(tbl[(s[i + 1] & 15) << 2]);
    } else {
      putchar(tbl[(s[i] & 3) << 4]);
      putchar('=');
    }
    putchar('=');
  }
}

static void set_limit(int resource, rlim_t soft, rlim_t hard) {
  struct rlimit rl = {soft, hard};
  if (setrlimit(resource, &rl) != 0) die("setrlimit");
}

// Reads "<length>\n" from fd 0 one byte at a time, so nothing past the
// header is consumed. Returns 0 on clean EOF before any byte.
static int read_header(long long *len) {
  char line[32];
  size_t n = 0;
  for (;;) {
    char c;
    ssize_t r = read(0, &c, 1);
    if (r < 0 && errno == EINTR) continue;
    if (r <= 0) {
      if (n == 0) return 0;
      fprintf(stderr, "kata-run: truncated frame header\n");
      exit(2);
    }
    if (c == '\n') break;
    if (n + 1 >= sizeof line || c < '0' || c > '9') {
      fprintf(stderr, "kata-run: bad frame header\n");
      exit(2);
    }
    line[n++] = c;
  }
  line[n] = '\0';
  *len = atoll(line);
  return 1;
}

// Stages one test's input in a root-only directory and hands back a
// read-only descriptor to an already-unlinked file: the program gets it as
// stdin, and nothing else in the sandbox can open it by name.
static int stage_input(long long len) {
  const char *dir = getenv("KATA_RUN_DIR");
  char path[256];
  snprintf(path, sizeof path, "%s/inputXXXXXX", dir && *dir ? dir : "/run/kata");
  int wfd = mkstemp(path);
  if (wfd < 0) die("mkstemp");
  int rfd = open(path, O_RDONLY | O_CLOEXEC);
  if (rfd < 0) die("open input");
  unlink(path);
  char buf[65536];
  while (len > 0) {
    ssize_t r = read(0, buf, len < (long long)sizeof buf ? (size_t)len : sizeof buf);
    if (r < 0 && errno == EINTR) continue;
    if (r <= 0) {
      fprintf(stderr, "kata-run: truncated frame body\n");
      exit(2);
    }
    for (ssize_t off = 0; off < r;) {
      ssize_t w = write(wfd, buf + off, (size_t)(r - off));
      if (w < 0) die("write input");
      off += w;
    }
    len -= r;
  }
  close(wfd);
  return rfd;
}

static void run_child(const struct options *o, int infd, int outfd, int errfd) {
  setpgid(0, 0);
  if (dup2(infd, 0) < 0 || dup2(outfd, 1) < 0 || dup2(errfd, 2) < 0) _exit(126);
  close_range(3, ~0U, 0);

  long cpu_s = (o->cpu_ms + 999) / 1000 + 1;
  set_limit(RLIMIT_CPU, (rlim_t)cpu_s, (rlim_t)cpu_s + 1);
  set_limit(RLIMIT_CORE, 0, 0);
  set_limit(RLIMIT_NOFILE, 128, 128);
  set_limit(RLIMIT_FSIZE, (rlim_t)o->fsize_mb << 20, (rlim_t)o->fsize_mb << 20);
  // Deep recursion is fair game, so the stack may use the whole memory
  // limit. No RLIMIT_AS: glibc sizes every thread's stack reservation from
  // RLIMIT_STACK, so an address-space cap breaks ordinary threaded code.
  if (o->mem_mb > 0) {
    rlim_t mem = (rlim_t)o->mem_mb << 20;
    set_limit(RLIMIT_STACK, mem, mem);
  }
  // If the container's memory cgroup fills up, the untrusted program is the
  // one the OOM killer should take, never kata-run.
  int oom = open("/proc/self/oom_score_adj", O_WRONLY);
  if (oom >= 0) {
    if (write(oom, "1000", 4) < 0) {
      // best effort
    }
    close(oom);
  }

  drop_privileges();
  if (chdir("/work") != 0 && chdir("/tmp") != 0) _exit(126);
  // execvpe searches kata-run's own PATH (the image's), not the child env.
  execvpe(o->argv[0], o->argv, o->env);
  fprintf(stderr, "kata-run: exec %s: %s\n", o->argv[0], strerror(errno));
  _exit(127);
}

static void run_one(int index, int infd, const struct options *o) {
  int out_pipe[2], err_pipe[2];
  if (pipe2(out_pipe, O_CLOEXEC) != 0 || pipe2(err_pipe, O_CLOEXEC) != 0) die("pipe");

  long start = now_ms();
  pid_t pid = fork();
  if (pid < 0) die("fork");
  if (pid == 0) run_child(o, infd, out_pipe[1], err_pipe[1]);
  setpgid(pid, pid);
  close(out_pipe[1]);
  close(err_pipe[1]);

  struct buffer out = {0}, err = {0};
  struct pollfd fds[2] = {{out_pipe[0], POLLIN, 0}, {err_pipe[0], POLLIN, 0}};
  int open_fds = 2, reaped = 0, timed_out = 0, output_limit = 0, status = 0;
  struct rusage ru;
  memset(&ru, 0, sizeof ru);
  char chunk[65536];

  while (open_fds > 0 || !reaped) {
    if (!reaped && wait4(pid, &status, WNOHANG, &ru) == pid) {
      reaped = 1;
      // Anything still alive is a leftover background process holding our
      // pipes open; it doesn't get to outlive the test.
      kill_sandbox_processes();
    }
    long elapsed = now_ms() - start;
    if (!timed_out && !reaped && elapsed > o->wall_ms) {
      timed_out = 1;
      kill(-pid, SIGKILL);
      kill_sandbox_processes();
    }
    if (elapsed > o->wall_ms + 5000) break;  // nothing left can be holding us

    if (open_fds == 0) {
      struct timespec ts = {0, 5 * 1000000L};
      nanosleep(&ts, NULL);
      continue;
    }
    int r = poll(fds, 2, 10);
    if (r < 0 && errno != EINTR) die("poll");
    for (int i = 0; i < 2; i++) {
      if (fds[i].fd < 0 || !(fds[i].revents & (POLLIN | POLLHUP | POLLERR))) continue;
      ssize_t n = read(fds[i].fd, chunk, sizeof chunk);
      if (n > 0) {
        if (i == 0) buffer_append(&out, chunk, (size_t)n, o->stdout_max);
        else buffer_append(&err, chunk, (size_t)n, o->stderr_max);
        if (!output_limit && (out.total > o->stdout_max || err.total > o->stdout_max)) {
          output_limit = 1;
          kill(-pid, SIGKILL);
          kill_sandbox_processes();
        }
      } else if (n == 0 || (errno != EINTR && errno != EAGAIN)) {
        close(fds[i].fd);
        fds[i].fd = -1;
        open_fds--;
      }
    }
  }
  if (!reaped) {
    kill(-pid, SIGKILL);
    kill_sandbox_processes();
    wait4(pid, &status, 0, &ru);
  }
  for (int i = 0; i < 2; i++) {
    if (fds[i].fd >= 0) close(fds[i].fd);
  }
  // Reap reparented leftovers (we're their subreaper).
  while (waitpid(-1, NULL, WNOHANG) > 0) {
  }

  long wall = now_ms() - start;
  long cpu = ru.ru_utime.tv_sec * 1000L + ru.ru_utime.tv_usec / 1000L + ru.ru_stime.tv_sec * 1000L +
             ru.ru_stime.tv_usec / 1000L;

  printf("{\"index\":%d,", index);
  if (WIFEXITED(status)) printf("\"exit\":%d,\"signal\":null,", WEXITSTATUS(status));
  else printf("\"exit\":null,\"signal\":%d,", WIFSIGNALED(status) ? WTERMSIG(status) : 0);
  printf("\"timed_out\":%s,\"output_limit\":%s,", timed_out ? "true" : "false", output_limit ? "true" : "false");
  printf("\"cpu_ms\":%ld,\"wall_ms\":%ld,\"rss_kb\":%ld,", cpu, wall, ru.ru_maxrss);
  printf("\"stdout_bytes\":%zu,\"stderr_bytes\":%zu,\"stdout\":\"", out.total, err.total);
  print_base64(out.data, out.len);
  printf("\",\"stderr\":\"");
  print_base64(err.data, err.len);
  printf("\"}\n");
  fflush(stdout);
  free(out.data);
  free(err.data);
}

static int cmd_put(int argc, char **argv) {
  if (argc != 4) {
    fprintf(stderr, "usage: kata-run put <path> <max-bytes>\n");
    return 2;
  }
  long long max = atoll(argv[3]);
  drop_privileges();
  int fd = open(argv[2], O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0644);
  if (fd < 0) die("open");
  char buf[65536];
  long long total = 0;
  for (;;) {
    ssize_t r = read(0, buf, sizeof buf);
    if (r < 0 && errno == EINTR) continue;
    if (r < 0) die("read");
    if (r == 0) break;
    total += r;
    if (total > max) {
      unlink(argv[2]);
      fprintf(stderr, "kata-run: file exceeds %lld bytes\n", max);
      return 3;
    }
    for (ssize_t off = 0; off < r;) {
      ssize_t w = write(fd, buf + off, (size_t)(r - off));
      if (w < 0) die("write");
      off += w;
    }
  }
  return close(fd) == 0 ? 0 : 1;
}

static int cmd_batch(int argc, char **argv) {
  struct options o = {
      .cpu_ms = 1000,
      .wall_ms = -1,
      .mem_mb = 0,
      .fsize_mb = 16,
      .stdout_max = 16u << 20,
      .stderr_max = 64u << 10,
  };
  o.env[o.env_count++] = "PATH=/usr/local/bin:/usr/bin:/bin";
  o.env[o.env_count++] = "HOME=/tmp";
  o.env[o.env_count++] = "TMPDIR=/tmp";
  o.env[o.env_count++] = "LANG=C.UTF-8";
  // Keeps glibc from creating a 64 MiB malloc arena per thread, which would
  // make peak RSS of threaded programs noisier than it needs to be.
  o.env[o.env_count++] = "MALLOC_ARENA_MAX=2";

  int i = 2;
  for (; i < argc && strcmp(argv[i], "--") != 0; i++) {
    const char *a = argv[i];
    const char *v = i + 1 < argc ? argv[i + 1] : NULL;
    if (!v) break;
    if (!strcmp(a, "--cpu-ms")) o.cpu_ms = atol(v);
    else if (!strcmp(a, "--wall-ms")) o.wall_ms = atol(v);
    else if (!strcmp(a, "--mem-mb")) o.mem_mb = atol(v);
    else if (!strcmp(a, "--fsize-mb")) o.fsize_mb = atol(v);
    else if (!strcmp(a, "--stdout-max")) o.stdout_max = (size_t)atoll(v);
    else if (!strcmp(a, "--stderr-max")) o.stderr_max = (size_t)atoll(v);
    else if (!strcmp(a, "--env") && o.env_count < MAX_ENV) o.env[o.env_count++] = (char *)v;
    else {
      fprintf(stderr, "kata-run: unknown option %s\n", a);
      return 2;
    }
    i++;
  }
  if (i >= argc - 1) {
    fprintf(stderr, "usage: kata-run batch [options] -- <command> [args...]\n");
    return 2;
  }
  o.env[o.env_count] = NULL;
  o.argv = &argv[i + 1];
  if (o.wall_ms < 0) o.wall_ms = o.cpu_ms * 3 + 1000;

  prctl(PR_SET_CHILD_SUBREAPER, 1);
  signal(SIGPIPE, SIG_DFL);

  long long len;
  for (int index = 0; read_header(&len); index++) {
    int infd = stage_input(len);
    run_one(index, infd, &o);
    close(infd);
  }
  return 0;
}

int main(int argc, char **argv) {
  if (argc >= 2 && !strcmp(argv[1], "put")) return cmd_put(argc, argv);
  if (argc >= 2 && !strcmp(argv[1], "batch")) return cmd_batch(argc, argv);
  fprintf(stderr, "usage: kata-run put|batch ...\n");
  return 2;
}
