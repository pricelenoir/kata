import type { TraceQuestion } from "@/types/question";

export const networkingQuestions: TraceQuestion[] = [
  {
    id: "networking-tcp-boundaries-01",
    category: "networking",
    difficulty: "easy",
    title: "Message boundaries across two send() calls",
    tags: ["tcp", "sockets", "streams"],
    type: "trace",
    prompt: "What can the server observe from a single recv() call here?",
    snippet: {
      language: "cpp",
      filename: "client_server.cpp",
      code: `// Client, back-to-back:
send(sock, "AB", 2, 0);
send(sock, "CD", 2, 0);

// Server, a single call:
char buf[16];
int n = recv(sock, buf, sizeof(buf), 0);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'n is always 2 and buf holds "AB": one recv() returns exactly one send() call\'s worth of data.',
        'n is always 4 and buf holds "ABCD", since the kernel coalesces pending writes before delivering them.',
        'n is anywhere from 1 to 4, and buf may hold "AB", "ABCD", or a partial split like "A".',
        "recv() blocks until both writes are readable and then returns all 4 bytes in one call.",
      ],
      correctIndex: 2,
    },
    explanation:
      "TCP delivers an ordered byte stream, not discrete messages, and the stack is free to " +
      "coalesce or split writes however it likes at the segment and buffer level. A single " +
      "recv() may return any prefix of the bytes currently sitting in the receive queue, " +
      "regardless of how many send() calls produced them. Segment boundaries can also shift " +
      "under Nagle, path MTU, and retransmission behavior, so a split that never appears in " +
      "testing can appear in production. Application protocols must carry their own framing " +
      "(length prefixes, delimiters) if boundaries matter, because TCP will not preserve them.",
    references: ["https://www.rfc-editor.org/rfc/rfc9293.html"],
  },
  {
    id: "networking-tcp-udp-guarantees-03",
    category: "networking",
    difficulty: "easy",
    title: "UDP delivery and ordering across three datagrams",
    tags: ["udp", "tcp", "reliability"],
    type: "trace",
    prompt:
      "A client sends three UDP datagrams back-to-back, and the server loop calls recvfrom() three times to receive them. What can the server actually observe?",
    snippet: {
      language: "cpp",
      filename: "client_server.cpp",
      code: `// Client:
sendto(sock, "1", 1, 0, (struct sockaddr*)&dest, sizeof(dest));
sendto(sock, "2", 1, 0, (struct sockaddr*)&dest, sizeof(dest));
sendto(sock, "3", 1, 0, (struct sockaddr*)&dest, sizeof(dest));

// Server:
char buf[16];
for (int i = 0; i < 3; i++) {
    recvfrom(sock, buf, sizeof(buf), 0, NULL, NULL);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Exactly 1, 2, 3 in that order: UDP preserves send order, it simply never retransmits what is lost.",
        "All three in order or nothing at all, since the kernel retransmits any datagram left unacknowledged for one RTT.",
        "The first recvfrom() returns all three payloads at once when they are queued together, since the kernel coalesces them.",
        "Any of: all three in order, some out of order, fewer than three if one is dropped, or a duplicate.",
      ],
      correctIndex: 3,
    },
    explanation:
      "UDP is a connectionless, best-effort datagram protocol: each sendto() produces an " +
      "independent IP packet that is routed, queued, and potentially dropped independently of " +
      "the others. The kernel does not buffer, resequence, deduplicate, or retransmit UDP " +
      "datagrams on the application's behalf, so a receiver's sequence of recvfrom() calls " +
      "reflects arrival order (or loss), not send order. Duplicates are rarer than loss but " +
      "genuinely possible, typically from a routing loop or a retransmitting middlebox. What UDP " +
      "does preserve is message boundaries: each recvfrom() returns exactly one datagram, never " +
      "two merged together and never half of one, and an oversized datagram is truncated to the " +
      "supplied buffer with the remainder discarded. Any " +
      "application that needs ordering, completeness, or exactly-once delivery over UDP " +
      "(market-data feeds, QUIC, RTP) implements sequence numbers, gap detection, and recovery " +
      "itself at the application layer.",
    references: ["https://www.rfc-editor.org/rfc/rfc768.html"],
  },
  {
    id: "networking-three-way-handshake-04",
    category: "networking",
    difficulty: "medium",
    title: "Server-side connection state during the three-way handshake",
    tags: ["tcp", "handshake", "connection-state"],
    type: "trace",
    prompt:
      "A server has called listen() and is blocked in accept(). A client calls connect(). The client's SYN reaches the server and the server's SYN-ACK reaches the client, prompting the client to send the final ACK, but that ACK is still in flight over the network. At this instant, what TCP state is the connection in on the server side, and where does it live?",
    snippet: {
      language: "cpp",
      filename: "client_server.cpp",
      code: `// Server:
int lfd = socket(AF_INET, SOCK_STREAM, 0);
bind(lfd, (struct sockaddr*)&addr, sizeof(addr));
listen(lfd, 128);
int cfd = accept(lfd, NULL, NULL); // still blocked here

// Client:
int sock = socket(AF_INET, SOCK_STREAM, 0);
connect(sock, (struct sockaddr*)&addr, sizeof(addr));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "LISTEN, since the kernel creates no per-connection state at all until the handshake completes.",
        "SYN_RCVD, held in the kernel's incomplete-connection queue rather than the accept queue.",
        "ESTABLISHED and already in the accept queue: the server transitions the moment it sends its SYN-ACK.",
        "SYN_SENT, because the server is still waiting on a retransmission of the client's original SYN.",
      ],
      correctIndex: 1,
    },
    explanation:
      "The three-way handshake is SYN, SYN-ACK, ACK. After the server receives the client's SYN " +
      "and replies with SYN-ACK, the kernel tracks that half-open connection in SYN_RCVD state, " +
      "held in the incomplete-connection queue, which is distinct from the accept queue of fully " +
      "established connections that accept() actually pulls from. Only once the final ACK " +
      "arrives does the connection move to ESTABLISHED and into the accept queue, at which point " +
      "a blocked accept() can return it to user space. SYN_SENT is the client-side state after " +
      "it has sent its SYN but before the SYN-ACK comes back. (With SYN cookies active under " +
      "flood conditions, Linux may encode the state into the SYN-ACK sequence number instead of " +
      "keeping a queue entry, but the default non-flooded path is as described.)",
    references: [
      "https://www.rfc-editor.org/rfc/rfc9293.html#name-state-machine-overview",
    ],
  },
  {
    id: "networking-nagle-nodelay-05",
    category: "networking",
    difficulty: "medium",
    title: "Nagle's algorithm and small back-to-back writes",
    tags: ["tcp", "nagle", "latency", "hpc"],
    type: "trace",
    prompt:
      "A low-latency trading client sends an order's fields as several small back-to-back send() calls on a freshly connected TCP socket, without ever calling setsockopt() to set TCP_NODELAY. What happens to the timing of these writes on the wire?",
    snippet: {
      language: "cpp",
      filename: "client_server.cpp",
      code: `int sock = socket(AF_INET, SOCK_STREAM, 0);
connect(sock, (struct sockaddr*)&addr, sizeof(addr));
// No setsockopt(sock, IPPROTO_TCP, TCP_NODELAY, ...)

send(sock, &order_id, sizeof(order_id), 0);
send(sock, &price, sizeof(price), 0);
send(sock, &quantity, sizeof(quantity), 0);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nagle's algorithm holds back the later small writes while earlier data is still unacknowledged.",
        "Each send() leaves as its own segment immediately, since TCP flushes the send buffer on every call.",
        "TCP_NODELAY is the default for connected stream sockets on Linux, so all three writes go out at once.",
        "Nagle delays every small write by a fixed 200ms timer, whether or not data is outstanding.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Nagle's algorithm withholds transmission of a small segment whenever there is already " +
      "unacknowledged data outstanding on the connection, batching subsequent small writes until " +
      "either an ACK arrives or enough data accumulates to fill a segment. There is no fixed " +
      "timer involved: the release condition is the peer's ACK. The first write here goes out " +
      "immediately (nothing is outstanding yet), and the next two get held. That is efficient " +
      "for bulk and interactive transfers but interacts badly with the receiver's delayed-ACK " +
      "timer, producing the classic Nagle plus delayed-ACK stall of tens of milliseconds. " +
      "Latency-sensitive systems set TCP_NODELAY (it is off by default) so each send() reaches " +
      "the wire as soon as the stack can put it there.",
    references: [
      "https://www.rfc-editor.org/rfc/rfc896.html",
      "https://man7.org/linux/man-pages/man7/tcp.7.html",
    ],
  },
  {
    id: "networking-blocking-recv-06",
    category: "networking",
    difficulty: "easy",
    title: "recv() on a non-blocking socket with no data queued",
    tags: ["sockets", "non-blocking", "errno"],
    type: "trace",
    prompt:
      "A socket has been set to non-blocking mode with fcntl(). recv() is called while no data has arrived yet from the peer. What does recv() return?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int flags = fcntl(sock, F_GETFL, 0);
fcntl(sock, F_SETFL, flags | O_NONBLOCK);

char buf[256];
ssize_t n = recv(sock, buf, sizeof(buf), 0);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It blocks until data arrives, since O_NONBLOCK affects only connect() and accept().",
        "It returns 0 immediately, the same value used to indicate an orderly shutdown by the peer.",
        "It returns -1 with errno set to EWOULDBLOCK/EAGAIN, which are the same value on Linux.",
        "It returns -1 with errno set to EINPROGRESS, the code non-blocking sockets use for 'not ready yet'.",
      ],
      correctIndex: 2,
    },
    explanation:
      "On a non-blocking socket with an empty receive queue, recv() returns immediately with -1 " +
      "and errno set to EWOULDBLOCK (or EAGAIN, which expands to the same numeric value on " +
      "Linux; POSIX permits the two to differ, so portable code tests both). This is a normal, " +
      "expected condition rather than a failure, and it has to be distinguished from a return of " +
      "0, which specifically signals that the peer performed an orderly shutdown, and from a " +
      "genuine error such as ECONNRESET. Callers typically wait for readiness via " +
      "select()/poll()/epoll() before retrying rather than spinning. EINPROGRESS belongs to the " +
      "non-blocking connect() path, where it means the handshake is underway, and never appears " +
      "on a read.",
    references: ["https://man7.org/linux/man-pages/man2/recv.2.html"],
  },
  {
    id: "networking-select-poll-epoll-07",
    category: "networking",
    difficulty: "medium",
    title: "select() versus epoll_wait() with 10,000 connections",
    tags: ["epoll", "select", "poll", "scalability"],
    type: "trace",
    prompt:
      "A server manages 10,000 concurrent TCP connections. At any given instant, only about 20 of those sockets typically have data ready. Compare the per-call cost of select() against epoll_wait() for this workload, and explain why it matters.",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both walk the kernel's full interest set on every call; epoll differs only in its calling convention and its richer event flags.",
        "select() is cheaper here, since epoll pays an extra epoll_ctl() syscall per descriptor that select() never needs.",
        "Both are O(n) per call, but epoll amortizes the cost by caching the previous call's ready set in userspace between calls.",
        "select() rescans all 10,000 fds per call and is capped at FD_SETSIZE; epoll_wait() returns only the ready fds from a kernel list.",
      ],
      correctIndex: 3,
    },
    explanation:
      "select() and poll() require the caller to hand the kernel the full interest set on every " +
      "call, and the kernel must walk all n descriptors each time to decide which are ready, an " +
      "O(n) cost per call no matter how few are active. select() carries the additional hard " +
      "limit of FD_SETSIZE descriptors (1024 in glibc by default), and its fd_set is destroyed " +
      "by each call, so the caller rebuilds it every iteration. epoll keeps a persistent " +
      "kernel-side interest list populated via epoll_ctl and pushes descriptors onto a separate " +
      "ready list through wakeup callbacks as events occur, so epoll_wait() costs roughly the " +
      "number of ready fds rather than the number registered. That difference is what makes " +
      "epoll viable for C10K-style workloads of many mostly-idle long-lived connections, where " +
      "select() burns CPU rescanning thousands of idle descriptors every cycle.",
    references: [
      "https://man7.org/linux/man-pages/man7/epoll.7.html",
      "https://man7.org/linux/man-pages/man2/select.2.html",
    ],
  },
  {
    id: "networking-so-reuseaddr-08",
    category: "networking",
    difficulty: "hard",
    title: "What SO_REUSEADDR actually fixes",
    tags: ["so_reuseaddr", "time_wait", "bind"],
    type: "trace",
    prompt:
      "A server process crashes and is immediately restarted, calling bind() on the same TCP port it was previously listening on. Without SO_REUSEADDR, bind() often fails. With SO_REUSEADDR set, can a second, concurrently running process then bind() the exact same local IP:port that the first process is actively listening on?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int optval = 1;
setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval));
bind(sock, (struct sockaddr*)&addr, sizeof(addr));
listen(sock, 128);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No. It lets bind() succeed past sockets stuck in TIME_WAIT, but a second live listener on the identical IP:port still fails with EADDRINUSE.",
        "No. SO_REUSEADDR has nothing to do with TIME_WAIT; its only purpose is letting several processes share one listening port for load balancing.",
        "Yes. Any number of processes may bind the identical address and port, and the kernel round-robins incoming connections between them.",
        "Yes. Modern kernels ignore SO_REUSEADDR entirely, since bind() no longer rejects an address for any reason once the original process is gone.",
      ],
      correctIndex: 0,
    },
    explanation:
      "When a TCP endpoint closes, its 4-tuple typically lingers in TIME_WAIT for 2*MSL (a fixed " +
      "60s on Linux) to absorb delayed duplicate segments, and by default the kernel refuses to " +
      "bind() a new socket to a local address matching one of those, returning EADDRINUSE. After " +
      "a crash it is the previously accepted connections, not the listening socket itself, that " +
      "occupy the port that way. SO_REUSEADDR relaxes exactly that restriction, " +
      "letting bind() succeed against an address occupied only by TIME_WAIT (or other " +
      "non-listening) sockets, which is why long-running servers set it before bind() to survive " +
      "quick restarts. It gets confused with SO_REUSEPORT (Linux 3.9+), which is the option that " +
      "actually permits multiple sockets to bind an identical address and port simultaneously " +
      "and load-balances incoming connections across them. SO_REUSEADDR alone does not grant " +
      "that, and the second bind() still fails.",
    references: ["https://man7.org/linux/man-pages/man7/socket.7.html"],
  },
  {
    id: "networking-accept-backlog-09",
    category: "networking",
    difficulty: "medium",
    title: "listen() backlog and a full accept queue",
    tags: ["tcp", "backlog", "accept", "listen"],
    type: "trace",
    prompt:
      "A server calls listen(sock, 5), giving a backlog of 5, but the application is slow to call accept() and the completed-connection queue fills up with 5 fully established connections. A new client then sends a SYN to start a sixth connection. What happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The SYN is parked in the incomplete-connection queue and promoted the moment accept() is next called, invisible to the client.",
        "The backlog argument is only a hint, so the kernel completes the handshake and queues the connection anyway.",
        "connect() succeeds immediately regardless of the backlog, since the handshake completes whenever the host is reachable.",
        "The kernel drops the SYN by default, so the client pays SYN-retransmission delay and may eventually time out.",
      ],
      correctIndex: 3,
    },
    explanation:
      "listen()'s backlog parameter bounds the queue of fully established, post-handshake " +
      "connections awaiting accept(), and on Linux the effective value is also clamped by " +
      "net.core.somaxconn. Once that queue is full, the kernel stops completing the handshake " +
      "for new SYNs: the default behavior is to drop the SYN silently and let the client's own " +
      "SYN retransmission timer retry, so connect() stalls for seconds and can end in ETIMEDOUT. " +
      "Setting net.ipv4.tcp_abort_on_overflow makes the kernel send an RST instead, turning the " +
      "symptom into a fast ECONNREFUSED. Either way the backlog is a real enforced limit, and " +
      "the practical signature is added latency or outright connection failure for new clients " +
      "while the server process and host look otherwise healthy. That is the classic " +
      "slow-accept-loop bug: an application that fails to drain accept() promptly throttles " +
      "every incoming connection.",
    references: ["https://man7.org/linux/man-pages/man2/listen.2.html"],
  },
  {
    id: "networking-tcp-keepalive-10",
    category: "networking",
    difficulty: "medium",
    title: "Default TCP keepalive timing for dead-peer detection",
    tags: ["tcp", "keepalive", "heartbeat"],
    type: "trace",
    prompt:
      "A trading application enables SO_KEEPALIVE on its sockets and then relies solely on the OS's default keepalive settings to detect a dead peer, for example a counterparty machine that loses power, so no FIN or RST is ever sent. On a stock Linux install, roughly how long before the OS declares the connection dead?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Under a second: keepalive probes run continuously so the stack can detect a dead peer in real time.",
        "About two hours of idleness before the first probe is even sent, then nine further probes 75 seconds apart.",
        "Exactly 30 seconds, the keepalive interval RFC 793 specifies and every conforming stack implements.",
        "About 75 seconds: the first probe goes out after one keepalive interval of idleness, then eight more follow.",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP keepalive is opt-in per socket via SO_KEEPALIVE, and Linux's defaults are tuned for " +
      "reclaiming abandoned connections rather than for failure detection: tcp_keepalive_time " +
      "defaults to 7200 seconds (2 hours) of idleness before the first probe, then " +
      "tcp_keepalive_intvl (75s) between probes and tcp_keepalive_probes (9) before the " +
      "connection is torn down, so a dead peer goes unnoticed for roughly two hours and eleven " +
      "minutes. RFC 1122 explicitly makes keepalive optional and requires the default interval " +
      "to be no less than two hours precisely so it does not generate needless traffic. That " +
      "granularity is useless for systems needing sub-second dead-peer detection, so such " +
      "systems carry an application-level heartbeat with their own aggressive timeout, or at " +
      "minimum override all three sysctls per socket with TCP_KEEPIDLE, TCP_KEEPINTVL, and " +
      "TCP_KEEPCNT.",
    references: [
      "https://man7.org/linux/man-pages/man7/tcp.7.html",
      "https://www.rfc-editor.org/rfc/rfc1122.html#page-101",
    ],
  },
  {
    id: "networking-dns-resolution-11",
    category: "networking",
    difficulty: "medium",
    title: "getaddrinfo() on a low-latency hot path",
    tags: ["dns", "getaddrinfo", "latency"],
    type: "trace",
    prompt:
      "A client calls getaddrinfo('trading-gateway.example.com', ...) to resolve a hostname that has both an A record and an AAAA record, from a thread on the hot path of a low-latency system, immediately before connecting. Which statement about that call is accurate?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It completes in well under a millisecond, since results are cached in the kernel's routing table alongside the route entry.",
        "It is synchronous and blocking with no bounded worst case, and it can return both A and AAAA results for one name.",
        "It is thread-safe and reentrant, unlike the older gethostbyname(), and so does not block the calling thread.",
        "It resolves out of a per-process cache after the first call, so only the very first lookup for a name can be slow.",
      ],
      correctIndex: 1,
    },
    explanation:
      "getaddrinfo() is a blocking, synchronous library call that may consult /etc/hosts, walk " +
      "NSS modules, and ultimately issue one or more network round trips to a DNS resolver, with " +
      "retries across nameservers on failure, so its worst case is unbounded if a resolver is " +
      "slow or unreachable. It legitimately returns multiple addresses spanning both IPv4 (A) " +
      "and IPv6 (AAAA) families, ordered per the destination-address selection rules in RFC " +
      "6724, and signals failure with a nonzero return code such as EAI_NONAME rather than an " +
      "exception, since this is plain C. Bare glibc also does no caching of its own; any caching " +
      "comes from a separate daemon such as nscd or systemd-resolved, so assuming warm lookups " +
      "is unsafe. For latency-critical paths, resolve out of band ahead of time (or " +
      "asynchronously) and keep the resulting sockaddr around.",
    references: [
      "https://man7.org/linux/man-pages/man3/getaddrinfo.3.html",
      "https://www.rfc-editor.org/rfc/rfc6724.html",
    ],
  },
  {
    id: "networking-bandwidth-latency-12",
    category: "networking",
    difficulty: "easy",
    title: "Bandwidth versus latency for a single small message",
    tags: ["bandwidth", "latency", "propagation-delay"],
    type: "trace",
    prompt:
      "System A: 100 Gbps link, 40ms one-way propagation delay (cross-continental fiber). System B: 1 Gbps link, 5 microsecond one-way propagation delay (same-rack, direct fiber). A trading system needs to send a single 200-byte order message and get an ACK back as fast as possible. Which link wins, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "System A, because 100 Gbps serializes the 200 bytes in 16ns against 1.6 microseconds, and serialization dominates a round trip at any distance.",
        "Neither wins measurably: at 200 bytes both links are dominated by fixed NIC and driver processing cost.",
        "System B, because a 200-byte round trip is dominated by propagation delay, and serializing 200 bytes costs ~1.6 microseconds even at 1 Gbps.",
        "System A, because a 100x higher link rate lowers per-packet latency proportionally, distance notwithstanding.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Bandwidth (throughput capacity) and latency (propagation plus serialization and " +
      "processing delay) are orthogonal properties of a link. For a small message, total time is " +
      "dominated by propagation delay plus a negligible serialization component of payload size " +
      "divided by bandwidth; bandwidth only becomes the limiting factor once enough data is in " +
      "flight to fill the pipe. 200 bytes is 1600 bits, so it serializes in 1.6 microseconds at " +
      "1 Gbps and 16 nanoseconds at 100 Gbps, a difference swamped by System A's 80ms round-trip " +
      "propagation against System B's roughly 10 microseconds. That gap is the reason " +
      "trading infrastructure spends its money on short physical paths, colocation, and " +
      "kernel-bypass NICs rather than on raw link speed.",
  },
  {
    id: "networking-tcp-slow-start-13",
    category: "networking",
    difficulty: "medium",
    title: "A new connection versus a warmed-up connection for a 10MB transfer",
    tags: ["tcp", "congestion-control", "slow-start"],
    type: "trace",
    prompt:
      "A client opens a brand-new TCP connection and immediately sends a large 10MB payload. A second client reuses an existing TCP connection that has been actively transferring data for several seconds already, and sends the same 10MB payload. Which transfer finishes faster, all else (bandwidth, RTT) being equal, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The warmed-up one: a fresh connection starts with a small congestion window and roughly doubles it each RTT during slow start.",
        "Identical times, since TCP throughput is determined solely by the receiver's advertised window.",
        "The fresh one, since it carries no retransmission backlog or accumulated congestion state to work around.",
        "Identical times, since slow start covers only the opening few segments and is long finished before 10MB matters.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Loss-based congestion control begins each new connection with a small initial congestion " +
      "window, historically 2 to 4 segments and per RFC 6928 now commonly 10 segments (roughly " +
      "14KB), then grows it exponentially during slow start, about doubling per RTT until it " +
      "reaches the slow-start threshold or hits loss, after which growth becomes conservative. " +
      "Climbing from 14KB to a multi-megabyte in-flight window takes on the order of ten round " +
      "trips, so a fresh connection spends real time throttled well below the path's capacity, " +
      "whereas a connection already pushing data has a large cwnd and can use the link " +
      "immediately. That ramp is the throughput argument for connection pooling and keep-alive. " +
      "What gets amortized is the congestion state the connection has already paid round trips " +
      "to discover, on top of the handshake itself.",
    references: ["https://www.rfc-editor.org/rfc/rfc6928.html"],
  },
  {
    id: "networking-ip-fragmentation-mtu-14",
    category: "networking",
    difficulty: "hard",
    title: "A datagram bigger than the path MTU",
    tags: ["ip", "fragmentation", "mtu", "udp"],
    type: "trace",
    prompt:
      "A UDP application sends a single 3000-byte datagram over a standard Ethernet path with a 1500-byte MTU, with the IP 'Don't Fragment' (DF) bit not set. What happens at the IP layer, and what changes if DF were set instead?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `char payload[3000];
sendto(sock, payload, sizeof(payload), 0,
       (struct sockaddr*)&dest, sizeof(dest));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "sendto() fails with EMSGSIZE either way, since the socket layer rejects any UDP payload larger than the path MTU before it reaches IP.",
        "The payload is truncated to a single 1500-byte packet and the trailing bytes are silently discarded, with sendto() still returning 3000.",
        "Without DF it is fragmented and reassembled at the destination, where one lost fragment kills the whole datagram; with DF it is dropped and ICMP Fragmentation Needed returned.",
        "Either way the stack splits the payload into three independent UDP datagrams, each with its own UDP header, so DF changes nothing and one loss costs only a third of the data.",
      ],
      correctIndex: 2,
    },
    explanation:
      "With DF unset, a 3000-byte UDP payload exceeding the path MTU is split by the sending " +
      "stack (or an intermediate router) into IP fragments carrying offset information for " +
      "reassembly at the destination. Because UDP has no notion of partial delivery, losing a " +
      "single fragment makes the whole datagram undeliverable, and it is discarded silently once " +
      "the reassembly timer expires. With DF set, any device unable to forward the packet within " +
      "its outgoing link's MTU drops it and should return ICMP Type 3 Code 4 (Fragmentation " +
      "Needed), which is the signal Path MTU Discovery depends on; when a firewall filters that " +
      "ICMP, the sender never learns the real MTU and the flow black-holes, a failure mode that " +
      "looks like 'small packets work, large ones vanish'. One caveat on the setup above: Linux's " +
      "default PMTU setting (IP_PMTUDISC_WANT) usually results in DF being set on UDP sends too, " +
      "so this plain sendto() would in practice often fail with EMSGSIZE on Linux rather than " +
      "fragmenting, unless IP_MTU_DISCOVER is changed. Latency-sensitive systems " +
      "size messages under the MTU outright, since a lost fragment wastes the whole message and " +
      "reassembly adds per-packet CPU and reordering risk.",
    references: [
      "https://www.rfc-editor.org/rfc/rfc1191.html",
      "https://man7.org/linux/man-pages/man7/ip.7.html",
    ],
  },
  {
    id: "networking-byte-order-15",
    category: "networking",
    difficulty: "easy",
    title: "Assigning sin_port without htons()",
    tags: ["endianness", "byte-order", "htons"],
    type: "trace",
    prompt:
      "A client fills in a sockaddr_in's port field with a raw host-order integer instead of converting it, on a little-endian x86_64 machine, then calls connect(). What actually happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct sockaddr_in addr;
addr.sin_family = AF_INET;
addr.sin_port = 8080;
addr.sin_addr.s_addr = inet_addr("127.0.0.1");

connect(sock, (struct sockaddr*)&addr, sizeof(addr));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "connect() fails with EINVAL, since the kernel validates that sin_port holds a plausible network-order value.",
        "It connects to port 8080, since x86_64 and the wire format are both little-endian on this path.",
        "The compiler rejects the assignment, since sin_port is a distinct type that requires an explicit conversion.",
        "The stack reads those bytes as big-endian and targets port 36895 (0x901F); nothing flags the missing conversion.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Multi-byte fields in network protocol headers, including sockaddr_in's sin_port and " +
      "sin_addr, are always interpreted in network byte order, which is big-endian, independent " +
      "of the host's native architecture. On a little-endian host like x86_64 the literal 8080 " +
      "(0x1F90) sits in memory low byte first, as 90 1F; without htons() the stack reads those " +
      "same raw bytes as a big-endian value and gets 0x901F, or 36895. Nothing checks this at " +
      "compile time (sin_port is just a uint16_t) and nothing checks it at run time, so it is a " +
      "silent logic bug that connects to or listens on the wrong port. That silence is the " +
      "argument for applying htons()/htonl() on the way out and ntohs()/ntohl() on the way in to " +
      "every multi-byte field crossing the host/wire boundary, even on a big-endian host where " +
      "the macros compile to nothing.",
    references: ["https://man7.org/linux/man-pages/man3/htons.3.html"],
  },
  {
    id: "networking-zero-copy-sendfile-16",
    category: "networking",
    difficulty: "medium",
    title: "What sendfile() actually avoids copying",
    tags: ["zero-copy", "sendfile", "splice"],
    type: "trace",
    prompt:
      "A file server needs to send the contents of a large file on disk out over a TCP socket. Contrast a naive read()+send() loop with using sendfile(out_fd, in_fd, ...). What copy, specifically, does sendfile() eliminate?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both copies across the user/kernel boundary, moving page-cache pages straight into the socket buffer.",
        "All copying including the NIC's own DMA transfer, so the bytes are never moved through memory at all.",
        "Only the socket-buffer copy; the page-cache read into the userspace buffer still happens on every chunk.",
        "Nothing measurable: it is a convenience wrapper over read()+send() with the same copy count.",
      ],
      correctIndex: 0,
    },
    explanation:
      "A conventional read()+send() loop copies file data from the kernel's page cache into a " +
      "userspace buffer, then copies it straight back from that buffer into the kernel's socket " +
      "send buffer: two full data copies plus two syscalls per chunk. sendfile() " +
      "(and splice()/vmsplice() more generally on Linux) lets the kernel move data from the " +
      "source descriptor's page cache to the socket without ever staging it in user space, and " +
      "on NICs that support scatter-gather DMA plus checksum offload the pages can be DMA'd " +
      "directly onto the wire with essentially no CPU-driven copy at all. The DMA transfer " +
      "itself never disappears, and nothing about wire-level behavior changes; what drops is CPU " +
      "time and memory bandwidth per byte, which is what saturates a high-throughput static " +
      "content server long before the link does.",
    references: ["https://man7.org/linux/man-pages/man2/sendfile.2.html"],
  },
  {
    id: "networking-udp-packet-loss-17",
    category: "networking",
    difficulty: "hard",
    title: "SO_RXQ_OVFL and sequence gaps on a UDP feed",
    tags: ["udp", "so_rxq_ovfl", "recvmsg", "packet-loss", "market-data"],
    type: "trace",
    prompt:
      "A market-data receiver consumes a UDP multicast feed whose every payload carries a " +
      "monotonic sequence number. To tell drops that happened inside this host apart from loss " +
      "upstream, the operator enables SO_RXQ_OVFL and reads the ancillary counter attached to " +
      "every recvmsg(). During one burst the receiver logs the values below: eight sequence " +
      "numbers are missing. What does that log establish about the eight?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int one = 1;
setsockopt(fd, SOL_SOCKET, SO_RXQ_OVFL, &one, sizeof(one));

char buf[1500], cbuf[CMSG_SPACE(sizeof(uint32_t))];
struct iovec iov = { buf, sizeof(buf) };
struct msghdr msg = {};
msg.msg_iov = &iov;
msg.msg_iovlen = 1;
msg.msg_control = cbuf;

for (;;) {
    msg.msg_controllen = sizeof(cbuf);
    recvmsg(fd, &msg, 0);

    uint32_t ovfl = 0;
    for (struct cmsghdr* c = CMSG_FIRSTHDR(&msg); c; c = CMSG_NXTHDR(&msg, c))
        if (c->cmsg_level == SOL_SOCKET && c->cmsg_type == SO_RXQ_OVFL)
            memcpy(&ovfl, CMSG_DATA(c), sizeof(ovfl));

    log(seq_of(buf), ovfl);
}

// Logged during the burst:
//   seq=1001  ovfl=0
//   seq=1005  ovfl=3     <- 1002..1004 missing
//   seq=1010  ovfl=7     <- 1006..1009 missing
//   seq=1012  ovfl=7     <- 1011 missing`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The value is cumulative since socket creation, so 7 of the 8 were dropped by this socket's receive queue; only 1011, across which it did not move, never reached the socket.",
        "The value counts drops since the previous datagram, so 10 were dropped locally in all, more than the 8 the gaps show, because further drops preceded seq 1001.",
        "The value reflects NIC ring-buffer overruns below the socket layer, so all 8 were discarded before the socket saw them and enlarging SO_RCVBUF would change nothing.",
        "The value is the system-wide UdpRcvbufErrors total that every UDP socket shares, so no individual gap in this feed can be attributed to a local drop from it.",
      ],
      correctIndex: 0,
    },
    explanation:
      "SO_RXQ_OVFL asks the kernel to attach a 32-bit ancillary message to each received datagram " +
      "holding the number of packets dropped by that socket since its creation: it is a snapshot " +
      "of the socket's sk_drops counter taken when the datagram was enqueued, not a per-message " +
      "delta, so the application has to difference consecutive readings. Here 0 to 3 across the " +
      "1002-1004 gap and 3 to 7 across the 1006-1009 gap say all seven of those datagrams did " +
      "reach the socket and were then discarded because sk_rcvbuf was full, which is a consumer " +
      "problem: the reader thread was not draining fast enough, or SO_RCVBUF (bounded by " +
      "net.core.rmem_max) is too small for the burst. The counter is unchanged across the 1011 " +
      "gap, so that datagram was never queued to this socket at all; SO_RXQ_OVFL cannot localize " +
      "it further, and separating genuine wire loss from a NIC ring overrun or netdev backlog " +
      "drop means reading ethtool -S and /proc/net/softnet_stat, which count below the socket. " +
      "Two limits are worth internalizing: the counter is per-socket, unlike the system-wide " +
      "UdpRcvbufErrors in /proc/net/snmp (the same per-socket value is also visible as the drops " +
      "column in /proc/net/udp), and it only surfaces on a datagram that is successfully " +
      "received, so if the feed goes silent right after an overflow the drops stay invisible " +
      "until the next arrival.",
    references: [
      "https://man7.org/linux/man-pages/man7/socket.7.html",
      "https://man7.org/linux/man-pages/man3/cmsg.3.html",
      "https://man7.org/linux/man-pages/man7/udp.7.html",
    ],
  },
  {
    id: "networking-unix-domain-socket-18",
    category: "networking",
    difficulty: "medium",
    title: "Unix domain sockets versus TCP loopback for local IPC",
    tags: ["unix-domain-socket", "loopback", "ipc"],
    type: "trace",
    prompt:
      "Two processes on the same machine need a fast IPC channel. One design uses a Unix domain socket (AF_UNIX); another uses TCP over 127.0.0.1 (loopback). Both avoid the physical NIC entirely. Which has lower overhead, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Identical, since loopback traffic short-circuits inside the kernel and both paths end up running the same code.",
        "AF_UNIX: loopback TCP still pays full protocol processing, while AF_UNIX copies between socket buffers with no stack traversal.",
        "TCP loopback: congestion control and segmentation offload optimize its throughput even on a virtual interface.",
        "Identical, since AF_UNIX is layered on the loopback device internally and inherits the same TCP/IP path.",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP over 127.0.0.1 still traverses the full TCP/IP stack in the kernel: segmentation, " +
      "sequence and ACK bookkeeping, congestion-control state, checksums (usually elided on " +
      "loopback), and a routing lookup, even though the loopback device never touches hardware. " +
      "That per-packet protocol work is real, measurable CPU cost. AF_UNIX bypasses the network " +
      "stack entirely: endpoints are named by filesystem path or by Linux's abstract namespace, " +
      "and the kernel copies data straight between the two processes' socket buffers, giving " +
      "lower latency and higher throughput for same-host IPC. It also does things TCP cannot, " +
      "notably passing open file descriptors via SCM_RIGHTS and authenticating the peer's " +
      "credentials via SO_PEERCRED. For colocated IPC the practical ordering is shared-memory " +
      "ring buffers first, AF_UNIX second, loopback TCP last, with loopback TCP earning its " +
      "place mainly when the endpoint might later move to another host.",
    references: ["https://man7.org/linux/man-pages/man7/unix.7.html"],
  },
  {
    id: "networking-window-scaling-19",
    category: "networking",
    difficulty: "hard",
    title: "Window scaling on a high bandwidth-delay-product path",
    tags: ["tcp", "window-scaling", "bdp", "rfc1323"],
    type: "trace",
    prompt:
      "A connection runs over a 10 Gbps path with a 100ms round-trip time (bandwidth-delay " +
      "product about 125MB). One endpoint's TCP stack has window scaling disabled, so the " +
      "option is never negotiated during the handshake. What throughput ceiling does this " +
      "connection hit, and why, regardless of how large the socket buffers are configured?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// The handshake completed without the Window Scale option
// (RFC 7323) appearing in either the SYN or the SYN-ACK.
int rcvbuf = 128 * 1024 * 1024; // 128MB
setsockopt(sock, SOL_SOCKET, SO_RCVBUF, &rcvbuf, sizeof(rcvbuf));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No ceiling at all: the receiver re-advertises its window on every segment, so the handshake cannot constrain it.",
        "None from the window: the congestion window rather than the advertised window is what bounds data in flight.",
        "The advertised window stays capped at 65,535 bytes for the connection's whole life, bounding throughput near 5 Mbps at this RTT.",
        "A soft ceiling only: the connection falls back to unacknowledged transmission once the 16-bit field would overflow.",
      ],
      correctIndex: 2,
    },
    explanation:
      "TCP's window field is fixed at 16 bits by the original header format, so a raw advertised " +
      "window can never exceed 65,535 bytes. RFC 7323 (formerly RFC 1323) works around this with " +
      "the Window Scale option, a shift count of 0 to 14 that both endpoints exchange in the SYN " +
      "and SYN-ACK, after which every advertised window value is left-shifted by that count, " +
      "allowing effective windows up to about 1GB. The critical detail is that the option is " +
      "handshake-only: there is no way to enable it mid-connection, and it takes effect only if " +
      "both sides send it, so one stack refusing it locks the connection to an unscaled window " +
      "for its entire life. Since in-flight unacknowledged data can never exceed the receiver's " +
      "advertised window, throughput is bounded by window/RTT no matter the link rate or " +
      "SO_RCVBUF setting, and 65,535 bytes per 100ms works out to about 5.2 Mbps on a 10 Gbps " +
      "path. High bandwidth-delay-product links live or die on this option being negotiated.",
    references: ["https://www.rfc-editor.org/rfc/rfc7323.html"],
  },
  {
    id: "networking-sack-20",
    category: "networking",
    difficulty: "medium",
    title: "Cumulative ACK versus SACK with two lost segments",
    tags: ["tcp", "sack", "retransmission", "congestion-control"],
    type: "trace",
    prompt:
      "A sender transmits segments with sequence numbers 1 through 10 in one window. Segments " +
      "3 and 7 are lost in transit; segments 1, 2, 4, 5, 6, 8, 9, 10 all arrive successfully. " +
      "Contrast what the receiver's ACKs convey under plain cumulative ACKing versus with the " +
      "SACK (Selective Acknowledgment) option enabled, and what that means for how much data " +
      "the sender must retransmit.",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference in what is conveyed: SACK blocks are advisory, and a sender retransmits from the first gap either way.",
        "Cumulative ACKs pin at segment 3 with no way to say 4-6 and 8-10 arrived; SACK names those blocks, so only 3 and 7 are resent.",
        "SACK lets the receiver reconstruct the stream from what did arrive, so the missing segments never need retransmitting.",
        "SACK reports corrupted rather than missing segments, supplementing the TCP checksum instead of the ACK number.",
      ],
      correctIndex: 1,
    },
    explanation:
      "A cumulative ACK communicates exactly one thing: the next in-order byte the receiver " +
      "expects. Once segment 3 is lost, every subsequent ACK is pinned there regardless of how " +
      "much later data has arrived and been buffered, so the sender knows something past 3 is " +
      "missing but not what, and a Reno-style stack either retransmits conservatively one " +
      "segment per RTT or waits out a full RTO. The SACK option (RFC 2018) attaches up to three " +
      "or four discontiguous received-range blocks to the ACK, naming the out-of-order data the " +
      "receiver already holds, so the sender can retransmit precisely segments 3 and 7. The " +
      "payoff shows up whenever multiple losses land in one window, which is the normal case " +
      "for bursty tail-drop: recovery goes from O(window) retransmissions and possibly several " +
      "RTOs down to O(losses) within a single fast-recovery episode.",
    references: ["https://www.rfc-editor.org/rfc/rfc2018.html"],
  },
  {
    id: "networking-bbr-cubic-21",
    category: "networking",
    difficulty: "hard",
    title: "CUBIC versus BBR on a link with non-congestive loss",
    tags: ["tcp", "congestion-control", "bbr", "cubic"],
    type: "trace",
    prompt:
      "A link has ample spare bandwidth but exhibits a small amount of random, non-congestive " +
      "packet loss (a flaky radio or satellite hop, say), loss that is not caused by queue " +
      "buildup anywhere on the path. Contrast how a CUBIC sender and a BBR sender respond to " +
      "this loss, and why their achieved throughput diverges.",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They respond identically, since every standardized congestion control ultimately treats packet loss as its congestion signal and backs off on it.",
        "CUBIC ignores loss entirely and reacts only to ECN marks, so only BBR's bandwidth estimate is disturbed by the drops here.",
        "BBR does worse on any lossy link, since pacing to a rate estimate leaves it without a fast-retransmit mechanism of its own.",
        "CUBIC cuts cwnd multiplicatively on every loss regardless of cause; BBR paces to an estimated bandwidth and minimum RTT, so it stays near capacity.",
      ],
      correctIndex: 3,
    },
    explanation:
      "CUBIC, like the Reno lineage before it, is loss-based: it grows cwnd along a cubic " +
      "function of time since the last loss event and treats any detected loss as evidence of " +
      "congestion, cutting cwnd by a factor of about 0.7 in response. That inference holds when " +
      "loss really does mean queue overflow and fails badly when loss comes from an unreliable " +
      "physical medium, since a connection with plenty of headroom gets throttled repeatedly; " +
      "the resulting throughput follows the well-known square-root-of-loss-rate law and collapses " +
      "at high BDP. BBR instead models the path explicitly, probing for the bottleneck bandwidth " +
      "and minimum RTT and pacing outgoing data at that estimate, using loss only as a secondary " +
      "input, so incidental non-congestive loss barely perturbs it. The tradeoff is symmetric: " +
      "the same insensitivity that saves BBR here is what drives the documented fairness " +
      "complaints when BBRv1 flows share a shallow-buffered bottleneck with loss-based flows.",
    references: [
      "https://www.rfc-editor.org/rfc/rfc8312.html",
      "https://queue.acm.org/detail.cfm?id=3022184",
    ],
  },
  {
    id: "networking-time-wait-22",
    category: "networking",
    difficulty: "hard",
    title: "TIME_WAIT and ephemeral ports under high connection churn",
    tags: ["tcp", "time_wait", "ephemeral-ports", "connection-teardown"],
    type: "trace",
    prompt:
      "A high-throughput proxy opens thousands of short-lived outbound TCP connections per " +
      "second to backend servers, and the proxy itself always calls close() first on each " +
      "connection right after reading the backend's response. Which side of each connection " +
      "enters TIME_WAIT, and why does this specifically threaten the proxy rather than the " +
      "backend with resource exhaustion?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The backend, since the listening side owns teardown state regardless of who sends the first FIN.",
        "Both sides symmetrically, so the proxy and the backend burn through their port ranges at the same rate.",
        "The proxy: the active closer holds its tuple for 2*MSL, so ephemeral ports accumulate until connect() fails with EADDRNOTAVAIL.",
        "Whichever side closes last, since TIME_WAIT protects the endpoint that has to absorb the final ACK of the exchange.",
      ],
      correctIndex: 2,
    },
    explanation:
      "TIME_WAIT belongs to whichever endpoint performs the active close, meaning the side that " +
      "sends the first FIN and then ACKs the peer's FIN. It is not a client-versus-server " +
      "property. That side holds the 4-tuple for 2*MSL (a fixed 60 seconds on Linux, " +
      "TCP_TIMEWAIT_LEN) so that a delayed duplicate segment from the old connection cannot be " +
      "accepted as data on a new connection reusing the same tuple, and so a retransmitted FIN " +
      "still has somewhere to be ACKed. Because this proxy always closes first, the accumulation " +
      "lands on its own ephemeral source ports: at thousands of connections per second against a " +
      "60-second linger, tens of thousands of tuples are outstanding at once, which comfortably " +
      "exceeds the roughly 28,000 ports in Linux's default ip_local_port_range and starves new " +
      "connect() calls with EADDRNOTAVAIL. The usual fixes are connection pooling to the " +
      "backends (best), widening ip_local_port_range, or net.ipv4.tcp_tw_reuse for outbound " +
      "connections, which trades some of the duplicate-segment protection away.",
    references: ["https://www.rfc-editor.org/rfc/rfc9293.html"],
  },
  {
    id: "networking-quickack-nodelay-23",
    category: "networking",
    difficulty: "hard",
    title: "TCP_NODELAY versus TCP_QUICKACK in a request/response exchange",
    tags: ["tcp", "nagle", "delayed-ack", "quickack", "latency"],
    type: "trace",
    prompt:
      "A request/response protocol exchanges small messages in both directions over a single " +
      "persistent TCP connection. The sender has set TCP_NODELAY. The receiver's default " +
      "delayed-ACK behavior is untouched. Explain what TCP_QUICKACK controls that TCP_NODELAY " +
      "does not, and why the sender's NODELAY setting alone may still not eliminate stalls.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int one = 1;
setsockopt(sock, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
// No TCP_QUICKACK set on the peer's receiving socket.`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They are the same mechanism under two names, so setting either one on either endpoint covers both directions.",
        "TCP_NODELAY disables Nagle on the sender; TCP_QUICKACK suppresses the receiver's delayed ACK, and on Linux it is one-shot rather than durable.",
        "TCP_QUICKACK disables Nagle exactly as TCP_NODELAY does, but only for the connection's first three segments.",
        "TCP_QUICKACK has been a no-op since Linux made delayed ACKs adaptive, so TCP_NODELAY on the sender is sufficient on any current kernel.",
      ],
      correctIndex: 1,
    },
    explanation:
      "The two options address separate mechanisms that each add latency independently. Nagle, " +
      "disabled by TCP_NODELAY, is a sender-side policy that withholds a small segment while " +
      "earlier data on the connection is unacknowledged. Delayed ACK, suppressed by " +
      "TCP_QUICKACK, is a receiver-side policy that holds a pure ACK back for tens of " +
      "milliseconds (Linux caps the delay at 200ms and commonly uses a 40ms estimate) hoping to " +
      "piggyback it on outgoing data or fold it in with a later ACK. They couple because Nagle's " +
      "release condition is the peer's ACK arriving: a NODELAY sender is unaffected, but a peer " +
      "that is itself a Nagle sender stalls behind the delayed ACK, and the request/response " +
      "round trip absorbs the delay either way. Linux's TCP_QUICKACK is documented as " +
      "non-permanent: it only switches quickack mode on or off, and subsequent protocol " +
      "processing re-enters or leaves that mode on its own, so an application wanting durably " +
      "prompt ACKs re-arms it after reads rather than setting it once at connection setup.",
    references: ["https://man7.org/linux/man-pages/man7/tcp.7.html"],
  },
  {
    id: "networking-kernel-bypass-24",
    category: "networking",
    difficulty: "medium",
    title: "Kernel-bypass packet I/O with DPDK and AF_XDP",
    tags: ["dpdk", "af_xdp", "kernel-bypass", "hpc", "latency"],
    type: "trace",
    prompt:
      "A market-data ingest system needs sub-microsecond tick-to-trade latency and switches " +
      "its NIC I/O from standard kernel sockets to a kernel-bypass framework such as DPDK or " +
      "AF_XDP. What is the core mechanism this enables, and which specific costs of the " +
      "ordinary recv() path does it eliminate?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It enlarges the kernel's socket buffers and raises interrupt-coalescing thresholds so fewer packets drop under load; the data path is unchanged.",
        "It pre-resolves and caches routes and ARP entries inside the NIC so the kernel can skip per-packet lookups on the send path.",
        "It transparently converts TCP flows to a lighter datagram transport so the hot path skips handshake and ACK processing entirely.",
        "It maps the NIC's descriptor rings into userspace for direct polling, removing the interrupt, the copy, and stack traversal, at the cost of a busy-polled core.",
      ],
      correctIndex: 3,
    },
    explanation:
      "On the standard socket path an arriving packet raises an interrupt (or a NAPI poll), gets " +
      "placed in an sk_buff, traverses IP and TCP/UDP processing plus netfilter hooks and a " +
      "routing lookup, and is finally copied into the userspace buffer supplied to recv(). Each " +
      "stage adds latency and, more importantly for trading, jitter from scheduling and " +
      "interrupt coalescing. DPDK and AF_XDP map the NIC's RX/TX descriptor rings into a " +
      "userspace process's address space so the application polls for packets and handles them " +
      "with no interrupt, no context switch, and no intermediate copy on the data path. (AF_XDP " +
      "still runs a small in-kernel XDP program to steer frames into the ring, but the payload " +
      "never traverses the network stack.) What the application takes on in exchange is what " +
      "the kernel used to provide: its own protocol parsing, and typically a core pinned out " +
      "of the scheduler and spun at 100% forever, which is why bypass shows up on tick-to-trade " +
      "paths and almost nowhere else.",
    references: ["https://docs.kernel.org/networking/af_xdp.html"],
  },
  {
    id: "networking-rdma-25",
    category: "networking",
    difficulty: "hard",
    title: "RDMA READ versus a socket recv()",
    tags: ["rdma", "roce", "infiniband", "zero-copy", "kernel-bypass"],
    type: "trace",
    prompt:
      "An HFT engine fetches a remote in-memory data structure via an RDMA READ over RoCE, " +
      "contrasted with a traditional socket-based recv() achieving the same logical transfer. " +
      "Fundamentally, what is different about how the data actually gets delivered, and what " +
      "does that require of the remote host?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing fundamental: RDMA is TCP with jumbo frames behind a different socket API and the same send/recv model.",
        "The remote application must post a matching recv() at the moment the READ is issued, making it synchronous send/recv over different physical media.",
        "Once the remote memory region is registered with its NIC, the local NIC reads it in hardware without waking the remote CPU or its network stack.",
        "No registration is needed: any remote virtual address becomes readable at any time as soon as a queue pair exists.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Conventional send/recv requires symmetric participation: the remote application calls " +
      "send(), its kernel stages the data and transmits it, and locally the kernel buffers the " +
      "arrival until a recv() copies it into user space. Both CPUs and both network stacks work " +
      "on every transfer. One-sided RDMA verbs such as READ and WRITE invert that. The remote " +
      "application registers (pins) a memory region with its RDMA NIC ahead of time and shares " +
      "the resulting address and rkey out of band; afterwards the local NIC issues hardware read " +
      "requests that the remote NIC services directly out of that region, so the remote CPU is " +
      "never interrupted and no remote code runs at transfer time. The result is genuine " +
      "end-to-end zero-copy with kernel bypass on both ends, paid for with RDMA-capable NICs, " +
      "pinned memory that cannot be paged or moved, and, on RoCE specifically, a lossless " +
      "Ethernet fabric with PFC or a congestion-control scheme like DCQCN configured correctly.",
  },
  {
    id: "networking-multicast-market-data-26",
    category: "networking",
    difficulty: "medium",
    title: "UDP multicast for exchange market-data distribution",
    tags: ["udp", "multicast", "market-data", "reliability"],
    type: "trace",
    prompt:
      "An exchange distributes its market-data feed to thousands of subscriber firms " +
      "simultaneously using UDP multicast rather than one TCP connection per subscriber. " +
      "Explain the rationale for that choice, and describe the reliability gap it leaves that " +
      "the exchange's protocol must separately address.",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "IP multicast layers router-level acknowledgment on top of UDP, so delivery is guaranteed and no recovery layer is needed.",
        "The fabric replicates one packet to every subscriber so send cost stays flat, but delivery is as unreliable as unicast UDP, needing application-level recovery.",
        "Multicast carries only heartbeats and session control, while the actual order and trade messages travel over per-subscriber TCP connections.",
        "Routers retransmit any packet a subscriber's IGMP membership report shows as missed, making the feed effectively as reliable as TCP.",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP fan-out costs scale linearly with subscriber count: N subscribers means N connections " +
      "and N copies of every message leaving the exchange, which is untenable at market-data " +
      "rates. UDP multicast pushes replication into the network itself, with switches tracking " +
      "group membership via IGMP snooping and routers via PIM, so the source's send cost is " +
      "independent of how many firms subscribe, and every subscriber sees the same packet at " +
      "very nearly the same instant, which matters for fairness as much as for cost. The " +
      "unavoidable gap is that multicast delivery is exactly as unreliable as unicast UDP: no " +
      "acknowledgment, no retransmission, no per-subscriber flow control, and different " +
      "subscribers can experience completely different loss depending on their path. Real feed " +
      "protocols such as ITCH close it by embedding a monotonic sequence number in every message " +
      "so each subscriber detects gaps locally, then pairing that with a unicast recovery " +
      "service for on-demand retransmission, a periodically republished snapshot to bound how " +
      "far behind a recovering subscriber can fall, or a redundant B-feed on a disjoint path.",
    references: ["https://www.rfc-editor.org/rfc/rfc1112.html"],
  },
  {
    id: "networking-ptp-ntp-27",
    category: "networking",
    difficulty: "medium",
    title: "PTP with hardware timestamping versus NTP",
    tags: ["ptp", "ntp", "clock-sync", "hpc", "timestamping"],
    type: "trace",
    prompt:
      "A trading venue needs to timestamp incoming orders with sub-microsecond accuracy " +
      "relative to a reference clock, and must choose between NTP and PTP (IEEE 1588) with " +
      "hardware timestamping on the NICs. What is the fundamental reason PTP with hardware " +
      "timestamping achieves an order-of-magnitude (or more) better accuracy than NTP?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "PTP carries far more fractional-second bits in its packet format and syncs far more often, while the offset-and-delay algorithm itself is identical to NTP's.",
        "NTP is the more accurate protocol technically, but trading venues avoid it for licensing rather than engineering reasons.",
        "PTP runs its sync messages over a reliable retransmitting transport, whereas NTP's travel over UDP and can be silently dropped.",
        "NTP timestamps in software and inherits OS and interrupt jitter over asymmetric paths; PTP timestamps in NIC hardware, with switches correcting their own delay.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Both protocols exchange timestamped messages and solve for offset and path delay, so the " +
      "accuracy ceiling is set entirely by how precisely and how symmetrically the timestamps " +
      "can be captured. NTP takes its timestamps in software as packets are processed by the " +
      "kernel or the daemon, inheriting scheduling latency, interrupt coalescing, and " +
      "NIC-to-CPU transfer jitter, and it usually runs over WAN paths whose asymmetry it cannot " +
      "measure (both algorithms assume the forward and reverse delays are equal, and any " +
      "asymmetry shows up directly as offset error). PTP attacks both problems: the NIC hardware " +
      "timestamps sync packets at the MAC layer the instant they cross the wire, and " +
      "intermediate switches participate as transparent clocks correcting for their own queuing " +
      "delay or as boundary clocks re-originating sync. Remove OS jitter and switch queuing " +
      "asymmetry and what is left is sub-microsecond, often tens of nanoseconds, comfortably " +
      "inside the microsecond granularity and 100-microsecond UTC divergence that a regime like " +
      "MiFID II RTS 25 imposes on trade timestamps.",
    references: [
      "https://docs.kernel.org/networking/timestamping.html",
      "https://docs.kernel.org/driver-api/ptp.html",
    ],
  },
  {
    id: "networking-cork-nodelay-28",
    category: "networking",
    difficulty: "hard",
    title: "TCP_CORK and TCP_NODELAY across a bulk and a latency-sensitive socket",
    tags: ["tcp", "tcp_cork", "nagle", "throughput", "latency"],
    type: "trace",
    prompt:
      "A server handles two very different workloads on separate sockets: (1) streaming a " +
      "large file, where a header and payload are written via several small write() calls " +
      "that should ideally coalesce into full, efficiently-packed segments; and (2) a " +
      "latency-sensitive tick stream, where every small message must hit the wire immediately. " +
      "Which socket option suits which workload, and how do TCP_CORK and TCP_NODELAY relate?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Workload 1: bulk file transfer
int one = 1, zero = 0;
setsockopt(fileSock, IPPROTO_TCP, TCP_CORK, &one, sizeof(one));
write(fileSock, header, headerLen);
write(fileSock, payload, payloadLen);
setsockopt(fileSock, IPPROTO_TCP, TCP_CORK, &zero, sizeof(zero)); // flush

// Workload 2: tick stream
setsockopt(tickSock, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
write(tickSock, &tick, sizeof(tick));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both disable Nagle's algorithm; they are the BSD and Linux spellings of one behavior, so either works on either socket.",
        "TCP_CORK holds back partial segments until it is cleared; TCP_NODELAY does the reverse, so cork the file socket and set NODELAY on the tick socket.",
        "TCP_NODELAY suits both sockets, since removing send-side buffering maximizes bulk throughput just as well as it minimizes tick latency.",
        "TCP_CORK applies only to datagram sockets; setsockopt() accepts it on a TCP socket, but the kernel silently ignores it there.",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP_NODELAY disables Nagle's algorithm, which normally withholds a small write while " +
      "earlier data is unacknowledged, so every write() reaches the wire as soon as possible and " +
      "latency wins over segment packing. TCP_CORK (Linux; TCP_NOPUSH on the BSDs is closely " +
      "analogous) does the conceptual opposite by actively suppressing transmission of any " +
      "partial segment, letting several write() calls accumulate into one fully packed segment " +
      "that flushes when the option is cleared, when a full MSS is available, or automatically " +
      "after roughly 200ms so a corked socket cannot hang forever. Corking around the " +
      "logically-related header and payload writes ships them as one well-formed segment instead " +
      "of a runt header segment followed by data, which is why sendfile()-style file servers " +
      "reach for it. The tick stream wants the opposite bargain: smaller, less efficient " +
      "segments in exchange for never waiting on a peer that may itself be a message behind. " +
      "Setting both on one socket is legal on Linux, where TCP_CORK simply takes precedence " +
      "while it is set.",
    references: ["https://man7.org/linux/man-pages/man7/tcp.7.html"],
  },
  {
    id: "networking-socket-buffer-tuning-29",
    category: "networking",
    difficulty: "hard",
    title: "Receive buffer sizing on a high bandwidth-delay-product link",
    tags: ["tcp", "so_rcvbuf", "so_sndbuf", "bdp", "throughput"],
    type: "trace",
    prompt:
      "A bulk transfer over a 10 Gbps link with a 20ms RTT (bandwidth-delay product about " +
      "25MB) plateaus at a small fraction of the link's capacity, despite near-zero packet " +
      "loss and an already-large congestion window. The receiving socket's SO_RCVBUF was left " +
      "at the OS default of a few hundred KB. What mechanism, independent of congestion " +
      "control, explains the plateau?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Receiver never explicitly sizes its buffer:
int sock = socket(AF_INET, SOCK_STREAM, 0);
// SO_RCVBUF left at OS default (e.g. a few hundred KB)
// against a ~25MB bandwidth-delay product`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The advertised window cannot exceed what the receive buffer actually holds, and throughput is bounded by window/RTT no matter how large cwnd grows.",
        "Buffer sizing matters only for datagram sockets, which have no window mechanism; TCP throughput is governed purely by the sender's congestion window.",
        "Once slow start finishes the congestion window alone sets the rate, so buffer size stops mattering after the first RTT.",
        "Lowering the connection's MSS is the fix, since more segments then fit inside the existing receive buffer.",
      ],
      correctIndex: 0,
    },
    explanation:
      "A sender's in-flight unacknowledged data is bounded by the minimum of its congestion " +
      "window and the receiver's advertised window, and a receiver cannot advertise more window " +
      "than memory it has actually committed to buffering incoming and out-of-order data, which " +
      "is SO_RCVBUF (itself capped by the third value of net.ipv4.tcp_rmem, and shrunk further " +
      "because Linux reserves a fraction of every receive buffer for overhead, so the usable " +
      "window is smaller than the number you set). Since achievable throughput is " +
      "window/RTT, a few hundred KB against a 20ms RTT caps the transfer in the low hundreds of " +
      "Mbps on a 10 Gbps path even with zero loss and an unbounded cwnd, producing the familiar " +
      "'fast clean link, mysteriously slow transfer' report. The send side needs matching " +
      "sizing, since SO_SNDBUF has to hold every byte sent but not yet acknowledged; " +
      "under-provisioning either end reproduces the identical plateau. Setting SO_RCVBUF " +
      "explicitly also disables Linux's receive-buffer autotuning for that socket, so a hand-set " +
      "value that is too small is worse than leaving autotuning alone with a raised tcp_rmem " +
      "ceiling.",
    references: ["https://man7.org/linux/man-pages/man7/socket.7.html"],
  },
  {
    id: "networking-head-of-line-blocking-30",
    category: "networking",
    difficulty: "medium",
    title: "Multiplexed messages on one TCP connection with a lost segment",
    tags: ["tcp", "head-of-line-blocking", "multiplexing", "quic"],
    type: "trace",
    prompt:
      "A client streams five independent, multiplexed messages over a single TCP connection. " +
      "The segment carrying message 2 is lost and must be retransmitted, while the segments " +
      "carrying messages 3, 4, and 5 have already arrived intact in the kernel's receive " +
      "buffer. Can the application read messages 3, 4, and 5 before message 2 is recovered?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: the kernel hands each arrived segment to the application as it lands, gaps in the stream notwithstanding.",
        "Yes, but out of order and tagged with sequence offsets so the application can splice message 2 in once it arrives.",
        "No: the kernel withholds every byte past the gap until the retransmission of message 2 fills it.",
        "No, but only because these messages are multiplexed; a single unmultiplexed stream would read past the gap.",
      ],
      correctIndex: 2,
    },
    explanation:
      "TCP promises the application an ordered byte stream, and the kernel implements that by " +
      "parking out-of-order arrivals in an internal reassembly queue rather than releasing them " +
      "to recv(). The bytes for messages 3, 4, and 5 are physically present in the receiving " +
      "host's memory and were even SACKed back to the sender, but none of them are readable " +
      "until the retransmission of message 2 lands and closes the gap, so the whole connection " +
      "and everything multiplexed on top of it stalls for at least one extra round trip. That " +
      "is head-of-line blocking, an intrinsic consequence of the single-ordered-stream " +
      "abstraction rather than a defect: HTTP/2 multiplexes streams above one TCP connection and " +
      "therefore still inherits it, which is what pushed QUIC to run independent streams over " +
      "UDP with per-stream ordering. QUIC does not make loss free, though. A packet carrying one " +
      "stream's data still costs a round trip to recover; it just stops charging that round trip " +
      "to unrelated streams.",
    references: ["https://www.rfc-editor.org/rfc/rfc9000.html"],
  },
  {
    id: "networking-dns-ttl-31",
    category: "networking",
    difficulty: "easy",
    title: "A DNS record change and a long-running client",
    tags: ["dns", "ttl", "caching", "connection-pooling"],
    type: "trace",
    prompt:
      "A service's A record has a 300-second TTL. Ops repoints the name at a new host, waits " +
      "an hour, and decommissions the old one. A long-running client process, which resolved " +
      "the name once at startup and keeps a pool of persistent connections, is still sending " +
      "requests to the old IP and failing hours later. What explains it?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "DNS is consulted only on a new lookup, and this process never makes one: neither its stored address nor its open connections expire with the TTL.",
        "The authoritative server keeps returning the old address to any resolver that cached it until every cached copy has aged out everywhere.",
        "The host's local caching resolver ignores the 300-second TTL and keeps handing the process the startup answer until that cache is flushed.",
        "Recursive resolvers must hold every record for at least 24 hours regardless of TTL, so a 300-second TTL is only an advisory hint.",
      ],
      correctIndex: 0,
    },
    explanation:
      "A TTL is an upper bound on how long a cache may keep serving an answer. It only matters " +
      "to code that asks again. DNS has no push or invalidation channel, so the record change " +
      "reaches a client only when that client does a fresh lookup and the cached answer along " +
      "the way has expired. This client did one lookup at startup and stored the sockaddr. A " +
      "struct sockaddr carries no TTL, so from then on the application owns the staleness, and " +
      "no cache in between, local or recursive, well-behaved or not, ever gets asked. Its " +
      "pooled connections are worse: an established TCP connection is identified by its " +
      "4-tuple and never touches DNS again, so it keeps talking to the old IP until the host " +
      "disappears and the pool starts failing. Language runtimes add their own layer on top. " +
      "The JVM's networkaddress.cache.ttl historically cached forever under a security manager, " +
      "and many HTTP clients reuse pooled connections indefinitely. The fix is on the client " +
      "and operational side: re-resolve periodically while honoring the TTL, put a maximum " +
      "lifetime on pooled connections, and keep the old host serving (or draining) for longer " +
      "than the TTL plus the longest connection lifetime any client might hold.",
    references: [
      "https://www.rfc-editor.org/rfc/rfc1035.html",
      "https://www.rfc-editor.org/rfc/rfc2181.html#section-8",
    ],
  },
  {
    id: "networking-sigpipe-epipe-32",
    category: "networking",
    difficulty: "medium",
    title: "write() to a peer that has already closed",
    tags: ["tcp", "sigpipe", "epipe", "rst", "connection-teardown"],
    type: "trace",
    prompt:
      "The peer has called close() on its socket, and its FIN has already arrived here, so this " +
      "side is in CLOSE_WAIT. On Linux, with default signal dispositions, what happens at (1) " +
      "and (2)?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Peer's FIN already received; we have not called close().
ssize_t a = write(fd, "hello", 5);   // (1)
usleep(100000);                      // peer's response to (1) arrives meanwhile
ssize_t b = write(fd, "world", 5);   // (2)`,
      highlightLines: [2, 4],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "(1) already fails: write() returns -1 with EPIPE and SIGPIPE kills the process before (2) runs.",
        "Both return 5, and the peer's kernel silently discards bytes that no application will read.",
        "Both return 5; the failure surfaces only on the next read(), which returns -1 with ECONNRESET.",
        "(1) returns 5 and draws a RST from the peer; (2) raises SIGPIPE, which kills the process.",
      ],
      correctIndex: 3,
    },
    explanation:
      "A FIN means only \"I will send no more data\". TCP supports half-close, so the peer " +
      "might have called shutdown(SHUT_WR) and still be reading. This side cannot tell that " +
      "apart from a full close(), so CLOSE_WAIT is a perfectly legal state to send from. Write " +
      "(1) therefore succeeds the way any write does: the bytes are copied into the send buffer " +
      "and transmitted. The peer, though, did a full close(), so no application will ever read " +
      "them. Its kernel answers data arriving for a closed socket with RST. On Linux, a RST " +
      "received in CLOSE_WAIT records EPIPE as the socket error, and the next write fails with " +
      "EPIPE and, more importantly, raises SIGPIPE. The default action for SIGPIPE is to " +
      "terminate the process, with no core dump and nothing on stderr, which is the classic " +
      "\"server dies silently when a client disconnects mid-response\" bug. Robust servers " +
      "either set SIGPIPE to SIG_IGN at startup or pass MSG_NOSIGNAL to every send() (BSD and " +
      "macOS also offer the per-socket SO_NOSIGPIPE), and then handle EPIPE as an ordinary " +
      "error return. The timing matters too: if (2) runs before the RST arrives it also " +
      "succeeds, so the failure lands on whichever write happens to come after the reset, not " +
      "necessarily the one that caused it.",
    references: [
      "https://man7.org/linux/man-pages/man2/send.2.html",
      "https://man7.org/linux/man-pages/man7/signal.7.html",
      "https://www.rfc-editor.org/rfc/rfc9293.html",
    ],
  },
  {
    id: "networking-udp-connect-icmp-33",
    category: "networking",
    difficulty: "medium",
    title: "connect() on a UDP socket with nothing listening on the port",
    tags: ["udp", "connect", "icmp", "econnrefused", "errno"],
    type: "trace",
    prompt:
      "The client runs on Linux. The remote host is up and reachable, but no process is bound to " +
      "the destination UDP port, and no firewall filters ICMP. What does this client observe?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int fd = socket(AF_INET, SOCK_DGRAM, 0);
connect(fd, (struct sockaddr*)&srv, sizeof(srv));
send(fd, "ping", 4, 0);                       // (1)

char buf[64];
ssize_t n = recv(fd, buf, sizeof(buf), 0);    // (2)`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "connect() returns -1 with ECONNREFUSED, so neither send() nor recv() ever gets to use the socket.",
        "send() returns 4 and recv() blocks indefinitely, with no error ever reported on the socket.",
        "send() returns 4; the remote host's ICMP Port Unreachable then makes recv() fail with ECONNREFUSED.",
        "send() blocks until the remote host's ICMP reply arrives and then returns -1 with ECONNREFUSED.",
      ],
      correctIndex: 2,
    },
    explanation:
      "connect() on a UDP socket sends nothing. It is purely local bookkeeping: it fixes the " +
      "default destination, makes the kernel filter out datagrams from any other source, and " +
      "caches the route. send() returns as soon as the datagram is queued to the device, long " +
      "before anything could come back. When the datagram reaches a host with no socket on " +
      "that port, the remote UDP layer replies with ICMP Destination Unreachable, code 3 (Port " +
      "Unreachable), as RFC 1122 asks it to. Locally, the kernel matches that ICMP to the " +
      "socket that sent the datagram and records ECONNREFUSED as a pending asynchronous error. " +
      "The next call on the socket reports it, which here is recv(), though it could just as " +
      "easily be a later send(). Connecting is what makes this work. On Linux, unless " +
      "IP_RECVERR is enabled, ICMP errors are only surfaced on connected UDP sockets, because " +
      "an unconnected socket talking to many peers cannot tell the application which " +
      "destination failed (with IP_RECVERR, the details come back via MSG_ERRQUEUE instead). " +
      "Two practical consequences follow. The error is sticky until reported, so it can show " +
      "up on a call that has nothing to do with the datagram that triggered it. And ICMP is " +
      "rate-limited and often filtered, so the absence of ECONNREFUSED proves nothing about " +
      "whether a listener exists. It is a fast-fail hint, not a liveness check.",
    references: [
      "https://man7.org/linux/man-pages/man7/udp.7.html",
      "https://man7.org/linux/man-pages/man7/ip.7.html",
      "https://www.rfc-editor.org/rfc/rfc1122.html#section-4.1.3.1",
    ],
  },
  {
    id: "networking-tls13-zero-rtt-34",
    category: "networking",
    difficulty: "medium",
    title: "TLS 1.3 0-RTT early data on a resumed session",
    tags: ["tls", "tls13", "0-rtt", "session-resumption", "security"],
    type: "trace",
    prompt:
      "An order-entry gateway enables TLS 1.3 0-RTT, so a reconnecting client can send its " +
      "first request (a new order) in the same flight as its ClientHello, protected by a " +
      "pre-shared key from an earlier session's ticket. Security review flags the change. What " +
      "property does that early data lack that ordinary post-handshake data has?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Replay protection: an attacker who records the ClientHello and early data can resend them, and the server may execute the same order twice.",
        "Confidentiality: no keys exist before the handshake completes, so early data travels in plaintext and any on-path observer can read the order.",
        "Server authentication: until a certificate arrives the client cannot know who it is talking to, so an impostor could receive the order.",
        "Integrity: early data is encrypted but not authenticated, so an on-path attacker can flip bits in the order without the server detecting it.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Early data is encrypted and authenticated with AEAD under client_early_traffic_secret, " +
      "which is derived from the resumption PSK and the ClientHello, so it is neither readable " +
      "nor modifiable on the path. Server authentication carries over from the " +
      "earlier session, since an impostor without the PSK cannot decrypt anything. What the " +
      "early-data key does not include is any fresh contribution from the server: no server " +
      "random and no server (EC)DHE share. Data sent after the handshake is protected by keys " +
      "that mix in both sides' fresh randomness, so a recorded flight cannot be spliced into a " +
      "new connection. A recorded ClientHello plus early data, by contrast, decrypts and " +
      "verifies correctly every time it is replayed. RFC 8446 says outright that 0-RTT data " +
      "has no non-replay guarantee across connections. Single-use tickets and ClientHello " +
      "recording narrow the window, but they are hard to make airtight across a distributed " +
      "fleet of terminators. Early data also lacks forward secrecy with respect to the PSK: " +
      "if the ticket-encryption key leaks, recorded early data can be decrypted. For an order " +
      "gateway, a replay is a duplicate order, so 0-RTT should be limited to idempotent " +
      "requests or paired with application-level deduplication such as client order IDs. On " +
      "HTTP, RFC 8470 adds the Early-Data header and the 425 Too Early status so a backend can " +
      "refuse it. Without 0-RTT, resumption still costs one round trip on top of the TCP " +
      "handshake. That round trip is the latency 0-RTT buys back, and replay is its price.",
    references: [
      "https://www.rfc-editor.org/rfc/rfc8446.html#section-8",
      "https://www.rfc-editor.org/rfc/rfc8446.html#appendix-E.5",
      "https://www.rfc-editor.org/rfc/rfc8470.html",
    ],
  },
  {
    id: "networking-close-unread-rst-35",
    category: "networking",
    difficulty: "hard",
    title: "Closing right after an early error response",
    tags: ["tcp", "rst", "close", "so_linger", "connection-teardown"],
    type: "trace",
    prompt:
      "A client sends a 4KB request and then blocks in recv() waiting for the response. The " +
      "Linux server below reads only the request line, decides the request is bad, writes a complete " +
      "400 response, and closes. The client intermittently gets ECONNRESET from recv() and " +
      "never sees the 400. What causes that?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Server, per connection:
char line[256];
read_request_line(cfd, line, sizeof(line));  // ~3.8KB of the request still unread
write(cfd, resp400, resp400_len);            // full response, returns resp400_len
close(cfd);`,
      highlightLines: [5],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "close() discards the server's send buffer immediately in every case, so response bytes written just before closing are never transmitted at all.",
        "With unread data still queued, close() aborts with RST instead of FIN, and the RST can destroy the response in flight or in the client's buffer.",
        "The client's kernel treats a FIN that arrives before it has finished sending as a protocol violation, and resets the connection from its side.",
        "Once the server enters TIME_WAIT it answers the client's in-flight ACKs with RST, tearing the connection down before the response is read.",
      ],
      correctIndex: 1,
    },
    explanation:
      "A normal close() is graceful. Queued send data is still transmitted, then followed by a " +
      "FIN. Discarding the send buffer outright is the abortive SO_LINGER-zero case, not this one. " +
      "What changes the outcome here is the 3.8KB of request the server never read. RFC 1122 " +
      "section 4.2.2.13 says a host that closes while received data is still pending SHOULD " +
      "send a RST to signal that data was lost, and Linux does exactly that. tcp_close() " +
      "counts the unread bytes, and if there are any it moves the socket straight to CLOSE, " +
      "sends a RST, and destroys the socket, incrementing TCPAbortOnClose. Destroying the " +
      "socket purges the write queue, so any part of the 400 not yet transmitted, or " +
      "transmitted and lost, will never be sent or retransmitted. Response bytes that did reach " +
      "the client are not safe either. RFC 9293 directs a receiver of RST to flush its segment " +
      "queues, and stacks that do (Windows is the common case) throw away the received but " +
      "unread response and report ECONNRESET. The race between the client's recv() and the " +
      "RST's arrival is what makes the failure intermittent. SO_LINGER with a nonzero timeout " +
      "does not help, because Linux checks for unread data before it ever consults the linger " +
      "setting. The fix is a lingering close, as Apache and nginx implement it: shutdown(SHUT_WR) " +
      "to send the FIN after the response, keep reading and discarding until the client's EOF " +
      "or a short timeout, then close() with an empty receive queue.",
    references: [
      "https://www.rfc-editor.org/rfc/rfc1122.html#section-4.2.2.13",
      "https://www.rfc-editor.org/rfc/rfc9293.html",
      "https://nginx.org/en/docs/http/ngx_http_core_module.html#lingering_close",
    ],
  },
  {
    id: "networking-so-reuseport-36",
    category: "networking",
    difficulty: "hard",
    title: "SO_REUSEPORT listeners with one stalled worker",
    tags: ["so_reuseport", "accept", "load-balancing", "tail-latency"],
    type: "trace",
    prompt:
      "On a Linux host, eight worker processes each open their own listening socket on port 9000 with " +
      "SO_REUSEPORT and run their own accept() loop. One worker blocks for two seconds on a " +
      "synchronous disk flush while the other seven sit idle. No BPF steering program is " +
      "attached. What happens to new connections arriving during those two seconds?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// In each of 8 worker processes:
int lfd = socket(AF_INET, SOCK_STREAM, 0);
int one = 1;
setsockopt(lfd, SOL_SOCKET, SO_REUSEPORT, &one, sizeof(one));
bind(lfd, (struct sockaddr*)&addr, sizeof(addr));   // port 9000
listen(lfd, 1024);
for (;;) handle(accept(lfd, NULL, NULL));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The kernel sees that the stalled worker's accept queue is not draining and steers new SYNs to the other seven listeners until it recovers.",
        "All eight listeners share a single accept queue behind the scenes, so the idle workers simply pick up the connections the stalled one would have.",
        "Listeners are chosen strictly round-robin, so exactly every eighth connection waits for the stalled worker and the rest proceed without delay.",
        "Each SYN's 4-tuple is hashed to one listener regardless of load, so about one in eight connections waits two seconds, or is dropped if that queue fills.",
      ],
      correctIndex: 3,
    },
    explanation:
      "On Linux, SO_REUSEPORT for TCP gives every socket in the group its own accept queue. " +
      "The kernel picks the listener for an incoming SYN in reuseport_select_sock() by hashing " +
      "the connection's 4-tuple and taking it modulo the group size. Nothing feeds load or " +
      "queue depth into that decision, so the stalled worker keeps receiving its hashed share " +
      "of roughly one in eight connections. Those connections finish the handshake in the " +
      "kernel and then wait in its accept queue for the full two seconds while seven workers " +
      "idle. If the queue overflows, Linux drops the handshake-completing ACK or the SYN. The " +
      "handshake is then retried on an exponential backoff (SYN retries land about 1, 3, and 7 " +
      "seconds after the first attempt), which shows up " +
      "as multi-second tail latency rather than an error. A single shared listening socket " +
      "behaves differently: whichever worker calls accept() next takes the connection, so an " +
      "idle worker absorbs the load (EPOLLEXCLUSIVE limits the thundering herd). The tradeoff " +
      "is lock contention and cache locality on the shared queue, against REUSEPORT's lack of " +
      "work stealing. Two related gotchas. Closing one listener in the group, say on a worker " +
      "restart, resets the connections sitting in its accept queue unless " +
      "net.ipv4.tcp_migrate_req (Linux 5.14+) is enabled. And adding or removing a socket " +
      "changes the modulus, which reshuffles which listener every new 4-tuple lands on. Load-aware steering " +
      "needs an SO_ATTACH_REUSEPORT_EBPF program that picks the socket itself.",
    references: [
      "https://man7.org/linux/man-pages/man7/socket.7.html",
      "https://lwn.net/Articles/542629/",
      "https://docs.kernel.org/networking/ip-sysctl.html",
    ],
  },
  {
    id: "networking-slow-start-idle-37",
    category: "networking",
    difficulty: "hard",
    title: "Periodic 2MB pushes over one persistent TCP connection",
    tags: ["tcp", "congestion-control", "slow-start", "connection-pooling"],
    type: "trace",
    prompt:
      "A Linux server pushes a 2MB risk snapshot to a client over one persistent TCP " +
      "connection on a 40ms-RTT path. In a benchmark that sends snapshots back-to-back, every " +
      "snapshot after the first completes in roughly one RTT. In production the snapshots go " +
      "out every 5 seconds with the connection idle in between, and every one of them takes " +
      "about seven RTTs, as if the connection were brand new. There is no loss, no " +
      "reconnection, and receive windows are ample. Kernel defaults are untouched. What " +
      "explains the difference?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "After the connection idles longer than its RTO, Linux decays cwnd back to the initial window as RFC 5681 directs, so each snapshot redoes slow start.",
        "The client's advertised window collapses to zero during the idle gap and then reopens by only one MSS per RTT once data starts flowing again.",
        "Keepalive probes sent during each gap go unanswered and are counted as losses, halving cwnd each time, so every snapshot starts from a degraded window.",
        "The kernel silently tears down an idle connection and reconnects on the next write(), so each snapshot pays a fresh handshake plus a full slow start.",
      ],
      correctIndex: 0,
    },
    explanation:
      "A congestion window is a measurement of what the path could absorb the last time the " +
      "sender probed it, and that measurement goes stale when the sender stops sending. RFC " +
      "5681 section 4.1 says that a sender that has been idle for longer than the " +
      "retransmission timeout SHOULD restart from a window no larger than the initial window " +
      "before sending again. Linux implements this behind net.ipv4.tcp_slow_start_after_idle, " +
      "which defaults to 1. In tcp_cwnd_restart(), cwnd is halved once per RTO that has " +
      "elapsed, in the style of RFC 2861 congestion window validation (since superseded by " +
      "RFC 7661), and floored at the initial window. With a 40ms RTT, Linux's 200ms minimum " +
      "on the variance term puts the RTO around 240ms, so a 5-second gap allows about twenty " +
      "halvings, far more than needed to put cwnd back at 10 segments. Climbing from roughly " +
      "14KB to 2MB by doubling (10, 20, 40, ... segments per round trip) takes about seven " +
      "round trips, which matches the production " +
      "numbers. In the back-to-back benchmark no gap ever exceeded the RTO, so the warmed " +
      "window survived. Keepalive plays no part: by default it sends nothing until two hours " +
      "of idle time, and probes never feed congestion control. The receive window does not shrink " +
      "on an idle socket. Linux never reconnects on its own. The consequence is that connection " +
      "pooling reliably amortizes the handshake and TLS setup, but it only amortizes congestion " +
      "state for connections that stay busy. Bursty senders on high-BDP paths typically set " +
      "tcp_slow_start_after_idle=0, which applies to the whole network namespace, and accept " +
      "the risk of bursting a full stale window into a path whose conditions may have changed.",
    references: [
      "https://www.rfc-editor.org/rfc/rfc5681.html#section-4.1",
      "https://www.rfc-editor.org/rfc/rfc2861.html",
      "https://www.rfc-editor.org/rfc/rfc7661.html",
      "https://docs.kernel.org/networking/ip-sysctl.html",
    ],
  },
  {
    id: "networking-msg-zerocopy-38",
    category: "networking",
    difficulty: "hard",
    title: "Reusing a send buffer with MSG_ZEROCOPY",
    tags: ["zero-copy", "msg_zerocopy", "tcp", "errqueue", "hpc"],
    type: "trace",
    prompt:
      "A publisher switches its 256KB snapshot sends to MSG_ZEROCOPY to save CPU. Every send() " +
      "returns the full length. Afterward, the receiver occasionally decodes snapshots that mix " +
      "bytes from two consecutive iterations, even though the stream is never desynchronized. " +
      "What is going on?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int one = 1;
setsockopt(fd, SOL_SOCKET, SO_ZEROCOPY, &one, sizeof(one));

static char buf[256 * 1024];          // one buffer, reused every iteration
for (;;) {
    fill_snapshot(buf, sizeof(buf));
    ssize_t n = send(fd, buf, sizeof(buf), MSG_ZEROCOPY);
    // n == sizeof(buf) every time; loop refills buf immediately
}`,
      highlightLines: [6, 7],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "MSG_ZEROCOPY is ignored unless the NIC supports scatter-gather, so the kernel silently copied the data and the corruption must be on the receive side.",
        "send() actually returned short counts here and there, and since the loop never checks n, the next snapshot's bytes were appended to a truncated one.",
        "A returned send() only means the pages are pinned and queued; the kernel reads buf until the data is acknowledged, signaled later on MSG_ERRQUEUE.",
        "Zero-copy maps buf's pages straight into the receiver, so the receiver sees the sender's later writes until it copies the snapshot out of the mapping.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Ordinary send() copies user data into kernel skbs, so the buffer can be reused as soon " +
      "as the call returns. MSG_ZEROCOPY drops that copy. The kernel pins the user pages and " +
      "attaches them to skbs as fragments, and the NIC reads them by DMA whenever the segment " +
      "actually goes out. TCP may also have to retransmit from those same pages at any point " +
      "until the bytes are acknowledged. The buffer therefore stays live long after send() " +
      "returns, and refilling it immediately means some segments, especially retransmissions, " +
      "carry the next snapshot's bytes at the original sequence numbers. That produces exactly " +
      "the intact-framing, mixed-content corruption described. The kernel's signal that pages " +
      "are free is a completion notification read with recvmsg(fd, ..., MSG_ERRQUEUE): a " +
      "sock_extended_err with ee_origin SO_EE_ORIGIN_ZEROCOPY whose ee_info..ee_data range " +
      "identifies which numbered send() calls have completed. Correct designs keep a ring of " +
      "buffers and recycle each one only when its completion arrives. If the code is " +
      "SO_EE_CODE_ZEROCOPY_COPIED, the kernel fell back to copying (for example on loopback, " +
      "or when the device lacks scatter-gather or checksum offload), which tells you zero-copy " +
      "is not buying anything on that path. A fallback copy would also have made reuse safe, " +
      "so it cannot be the cause of this corruption. Pinning pages and " +
      "processing completions has its own cost, so the kernel documentation notes the feature " +
      "generally pays off only for writes above roughly 10KB.",
    references: [
      "https://docs.kernel.org/networking/msg_zerocopy.html",
      "https://man7.org/linux/man-pages/man2/recvmsg.2.html",
    ],
  },
];
