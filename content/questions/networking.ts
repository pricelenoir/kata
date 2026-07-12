import type { TraceQuestion } from "@/types/question";

export const networkingQuestions: TraceQuestion[] = [
  {
    id: "networking-tcp-boundaries-01",
    category: "networking",
    difficulty: "medium",
    title: "TCP has no message boundaries",
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
        "n is always 2, buf is always \"AB\" — recv() returns one send() call's worth of data",
        'n is always 4, buf is always "ABCD" in one call',
        'n could be anywhere from 1 to 4; buf might contain "AB", "ABCD", or a partial split like "A" — TCP is a byte stream with no message boundaries',
        "recv() blocks forever because two separate send() calls occurred",
      ],
      correctIndex: 2,
    },
    explanation:
      "TCP delivers an ordered byte stream, not discrete messages — the OS is free to coalesce " +
      "or fragment writes however it likes at the segment/buffer level. A single `recv()` may " +
      "return any prefix of the bytes currently available, regardless of how many `send()` " +
      "calls produced them. Application protocols must define their own message framing " +
      "(length prefixes, delimiters) if boundaries matter — TCP will not preserve them.",
  },
  {
    id: "networking-epoll-edge-triggered-02",
    category: "networking",
    difficulty: "hard",
    title: "Edge-triggered epoll and partial reads",
    tags: ["epoll", "event-loop", "latency"],
    type: "trace",
    prompt:
      "A socket fd is registered with epoll in edge-triggered mode (EPOLLET). 4096 bytes " +
      "arrive from the peer in one burst. The event handler is invoked once and does exactly " +
      "one read() of 1024 bytes, then returns. What happens to the remaining 3072 bytes?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "epoll_wait immediately reports readiness again next call, since data remains — level-triggered semantics apply regardless of the flag",
        "The remaining data is silently dropped by the kernel",
        "In edge-triggered mode, epoll only fires once per empty-to-non-empty transition; having read only 1024/4096 bytes, no further notification arrives until more data arrives, potentially stalling the handler",
        "Compile error: EPOLLET requires non-blocking sockets to be declared at compile time",
      ],
      correctIndex: 2,
    },
    explanation:
      "Edge-triggered epoll notifies on *state transitions* (e.g. \"buffer went from empty to " +
      'non-empty"), not on "there is still data to read." Because the handler only drained ' +
      "1024 of the 4096 available bytes, the buffer never returned to empty, and no new edge " +
      "occurred — so epoll_wait will not report this fd again until more bytes arrive. Correct " +
      "edge-triggered handlers must loop `read()`/`recv()` until it returns EAGAIN/EWOULDBLOCK " +
      "on every notification, or they'll stall on partially-drained buffers exactly like this.",
  },
  {
    id: "networking-tcp-udp-guarantees-03",
    category: "networking",
    difficulty: "easy",
    title: "What UDP does not promise you",
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
        "The server is guaranteed to receive exactly the datagrams 1, 2, 3 in that order, since UDP preserves send order like TCP",
        "The server may see all three arrive in order, but it might also see them arrive out of order, receive fewer than three if one is dropped in transit, or (rarely) see a duplicate — UDP provides no delivery, ordering, or duplication guarantees",
        "The OS automatically retransmits any datagram that isn't acknowledged within one RTT",
        "recvfrom() blocks forever unless all three datagrams arrive within the same IP packet",
      ],
      correctIndex: 1,
    },
    explanation:
      "UDP is a connectionless, best-effort datagram protocol: each sendto() produces an " +
      "independent IP packet that is routed, queued, and potentially dropped independently of " +
      "the others. The kernel does not buffer, resequence, deduplicate, or retransmit UDP " +
      "datagrams on the application's behalf, so a receiver's sequence of recvfrom() calls " +
      "reflects arrival order (or loss), not send order. Any application that needs ordering, " +
      "completeness, or exactly-once delivery over UDP (market-data feeds, QUIC, RTP) must " +
      "implement sequence numbers, gap detection, and retransmission itself at the application layer.",
  },
  {
    id: "networking-three-way-handshake-04",
    category: "networking",
    difficulty: "medium",
    title: "Where a connection lives mid-handshake",
    tags: ["tcp", "handshake", "connection-state"],
    type: "trace",
    prompt:
      "A server has called listen() and is blocked in accept(). A client calls connect(). The client's SYN reaches the server and the server's SYN-ACK reaches the client, prompting the client to send the final ACK — but that ACK is still in flight over the network. At this instant, what TCP state is the connection in on the server side, and where does it live?",
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
        "ESTABLISHED — the server already returned from accept() as soon as it sent the SYN-ACK",
        "SYN_SENT — the server is still waiting to receive the client's original SYN",
        "SYN_RCVD, sitting in the kernel's incomplete-connection (SYN) queue — it hasn't been promoted to the accept queue or handed to the accept() call yet, since the final ACK hasn't arrived",
        "LISTEN — the connection isn't tracked by the kernel until the full handshake is done",
      ],
      correctIndex: 2,
    },
    explanation:
      "The three-way handshake is SYN, SYN-ACK, ACK. After the server receives the client's SYN " +
      "and replies with SYN-ACK, the kernel tracks that half-open connection in SYN_RCVD state, " +
      "held in the incomplete-connection queue (distinct from the accept queue of fully " +
      "established connections that accept() actually pulls from). Only once the final ACK " +
      "arrives does the connection transition to ESTABLISHED and move into the accept queue, at " +
      "which point a blocked accept() call can return it to user space. SYN_SENT is the " +
      "client-side state after it has sent its SYN but before it has received the server's SYN-ACK.",
  },
  {
    id: "networking-nagle-nodelay-05",
    category: "networking",
    difficulty: "medium",
    title: "Nagle's algorithm stalling small writes",
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
        "Each send() is transmitted as its own packet immediately, since TCP always flushes on every send() call",
        "Nagle's algorithm buffers small writes whenever there is already unacknowledged data in flight, coalescing them until an ACK arrives or enough data accumulates — potentially adding up to one RTT of latency per write, which is exactly why latency-sensitive trading systems set TCP_NODELAY",
        "The kernel silently drops writes smaller than the path MTU",
        "TCP requires each send() payload to be at least 536 bytes or it returns EINVAL",
      ],
      correctIndex: 1,
    },
    explanation:
      "Nagle's algorithm withholds transmission of a small segment whenever there is already " +
      "unacknowledged data outstanding on the connection, batching subsequent small writes " +
      "until either an ACK arrives or enough data accumulates to send a full-sized segment. " +
      "This is efficient for bulk/interactive transfers but interacts badly with the receiver's " +
      "delayed-ACK timer (commonly tens of milliseconds), producing the well-known Nagle/delayed-ACK " +
      "stall pattern. For HPC and trading systems, where every message must hit the wire " +
      "immediately regardless of segment size, TCP_NODELAY disables Nagle's buffering so each " +
      "send() is transmitted as soon as possible.",
  },
  {
    id: "networking-blocking-recv-06",
    category: "networking",
    difficulty: "easy",
    title: "Non-blocking recv() with no data available",
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
        "recv() blocks until data arrives, exactly as it would on a blocking socket",
        "recv() returns 0 immediately, indicating the peer has closed the connection",
        "recv() returns -1 immediately with errno set to EWOULDBLOCK/EAGAIN (the same value on Linux), meaning no data is currently available — not that an error occurred",
        "recv() raises SIGPIPE and terminates the process",
      ],
      correctIndex: 2,
    },
    explanation:
      "On a non-blocking socket, if the receive buffer has no data ready, recv() returns " +
      "immediately with -1 and errno set to EWOULDBLOCK (or EAGAIN — on Linux these expand to " +
      "the same numeric value). This is a normal, expected condition, not a failure, and must be " +
      "distinguished from a return of 0 (which specifically signals an orderly peer shutdown) and " +
      "from a genuine error like ECONNRESET. Callers typically wait for readiness via " +
      "select()/poll()/epoll() before retrying. SIGPIPE is associated with writing to a socket " +
      "whose peer has reset the connection, not with reading from an empty buffer.",
  },
  {
    id: "networking-select-poll-epoll-07",
    category: "networking",
    difficulty: "medium",
    title: "select() vs epoll() at scale",
    tags: ["epoll", "select", "poll", "scalability"],
    type: "trace",
    prompt:
      "A server manages 10,000 concurrent TCP connections. At any given instant, only about 20 of those sockets typically have data ready. Compare the per-call cost of select() against epoll_wait() for this workload, and explain why it matters.",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both cost the same, since both ultimately just ask the kernel's TCP stack which sockets are readable",
        "select()/poll() require passing (and, for select, the kernel/userspace rebuilding) the entire fd set every call, and the kernel must scan all 10,000 registered fds to find the ~20 ready ones — O(n) per call, and select() is additionally capped at FD_SETSIZE (typically 1024) — while epoll_wait() returns only the ready fds directly from a kernel-maintained ready list, costing roughly O(ready fds) independent of how many are registered",
        "select() is actually faster than epoll() for any workload because epoll_ctl() registration calls add overhead select() doesn't have",
        "epoll_wait() also scans every registered fd internally; it differs from select() only in its calling convention",
      ],
      correctIndex: 1,
    },
    explanation:
      "select() and poll() require the caller to pass the full interest set on every call, and " +
      "the kernel must walk all n registered descriptors each time to determine which are ready " +
      "— an O(n) cost per call regardless of how few are actually active; select() is further " +
      "hard-limited to FD_SETSIZE descriptors (1024 by default on Linux). epoll instead " +
      "maintains a persistent kernel-side interest list (populated via epoll_ctl) and pushes " +
      "ready descriptors onto a separate ready list as events occur via callbacks, so " +
      "epoll_wait() returns in time proportional to the number of ready fds, not the number " +
      "registered. This is precisely why epoll scales to the C10K/C100K problem of many mostly-idle " +
      "long-lived connections, where select()/poll() would burn CPU rescanning thousands of idle fds every cycle.",
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
        "Without SO_REUSEADDR, bind() fails with EADDRINUSE because sockets from the prior process are lingering in TIME_WAIT, which by default blocks rebinding that address; SO_REUSEADDR lets bind() succeed past TIME_WAIT'd sockets, but it does not let a second process simultaneously bind() and listen() on the exact same live IP:port — that second bind() still fails",
        "SO_REUSEADDR has nothing to do with TIME_WAIT; it exists purely so multiple processes can load-balance across the same listening port",
        "Without SO_REUSEADDR, bind() always succeeds instantly on modern kernels — the option is legacy and has no real effect anymore",
        "SO_REUSEADDR allows an unlimited number of processes to bind() the identical address and port, and the kernel round-robins new connections between them",
      ],
      correctIndex: 0,
    },
    explanation:
      "When a TCP endpoint closes, its 4-tuple typically lingers in TIME_WAIT for 2*MSL " +
      "(commonly ~60s on Linux) to absorb delayed duplicate segments, and by default the kernel " +
      "refuses to bind() a new socket to an address matching one still in that state, returning " +
      "EADDRINUSE. SO_REUSEADDR relaxes that restriction, letting bind() succeed against an " +
      "address that's only occupied by TIME_WAIT (or certain other non-listening) sockets — " +
      "exactly why long-running servers set it before bind() to survive quick restarts. It's " +
      "frequently confused with SO_REUSEPORT (Linux 3.9+), which is the option that actually " +
      "permits multiple independent sockets to bind the identical address and port " +
      "simultaneously for load balancing; SO_REUSEADDR alone does not grant that.",
  },
  {
    id: "networking-accept-backlog-09",
    category: "networking",
    difficulty: "hard",
    title: "A full accept queue",
    tags: ["tcp", "backlog", "accept", "listen"],
    type: "trace",
    prompt:
      "A server calls listen(sock, 5), giving a backlog of 5, but the application is slow to call accept() and the completed-connection queue fills up with 5 fully handshaked connections. A new client then sends a SYN to start a sixth connection. What happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The new SYN is accepted into the queue anyway — the backlog argument is only a hint and the kernel always admits new connections",
        "The kernel typically drops the incoming SYN (or, depending on configuration, resets it) once the accept queue is full, so the client's connect() experiences the SYN retransmission delay and may eventually time out or fail with ECONNREFUSED — the backlog is a real, enforced limit, not a suggestion",
        "connect() on the client always succeeds immediately regardless of server backlog, since TCP guarantees the handshake completes as long as the host is reachable",
        "The server's kernel automatically raises the backlog to accommodate the new connection",
      ],
      correctIndex: 1,
    },
    explanation:
      "listen()'s backlog parameter bounds the queue of fully established (post-handshake) " +
      "connections awaiting accept() — on Linux the effective limit is also clamped by " +
      "net.core.somaxconn. Once that queue is full, the kernel does not complete the handshake " +
      "for new incoming SYNs by default; it drops the SYN, relying on the client's own SYN " +
      "retransmission timer to retry later (some kernels/configurations instead reset it via " +
      "tcp_abort_on_overflow). The practical symptom is added latency or outright connection " +
      "failure for new clients, even though the server process and OS are otherwise healthy — a " +
      "classic slow-accept-loop bug where an application not draining accept() promptly enough " +
      "throttles all new incoming connections.",
  },
  {
    id: "networking-tcp-keepalive-10",
    category: "networking",
    difficulty: "easy",
    title: "How slow OS TCP keepalive really is",
    tags: ["tcp", "keepalive", "heartbeat"],
    type: "trace",
    prompt:
      "A trading application relies solely on the OS's default TCP keepalive settings to detect a dead peer — e.g., a counterparty machine that loses power, so no FIN or RST is ever sent. On a stock Linux install, roughly how long before the OS declares the connection dead?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Under a second — TCP keepalive is designed for real-time failure detection",
        "Around 2 hours by default before the first probe is even sent (net.ipv4.tcp_keepalive_time = 7200s), plus further probe intervals and retries after that — far too slow for latency-sensitive failure detection, which is why applications typically implement their own heartbeat/timeout at the application layer",
        "TCP keepalive is disabled by default and cannot be enabled without recompiling the kernel",
        "Exactly 30 seconds, as mandated by RFC 793",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP keepalive is opt-in per socket via SO_KEEPALIVE, and its Linux defaults are tuned for " +
      "general-purpose use, not low-latency failure detection: tcp_keepalive_time defaults to " +
      "7200 seconds (2 hours) of idleness before the first probe is sent, followed by " +
      "tcp_keepalive_intvl (default 75s) between subsequent probes and tcp_keepalive_probes " +
      "(default 9) retries before the connection is torn down — well over an hour worst case, " +
      "and over two hours best case before even starting. That is far too coarse for HPC/trading " +
      "systems needing sub-second dead-peer detection, so such systems almost universally " +
      "implement their own application-level heartbeat with an aggressive timeout instead of " +
      "relying on OS-level TCP keepalive.",
  },
  {
    id: "networking-dns-resolution-11",
    category: "networking",
    difficulty: "easy",
    title: "getaddrinfo() on a hot path",
    tags: ["dns", "getaddrinfo", "latency"],
    type: "trace",
    prompt:
      "A client calls getaddrinfo('trading-gateway.example.com', ...) to resolve a hostname that has both an A record and an AAAA record, from a thread on the hot path of a low-latency system, immediately before connecting. What is worth knowing about this call?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "getaddrinfo() is guaranteed to complete in under a millisecond, since DNS lookups are cached in the kernel's routing table, and it always prefers the AAAA (IPv6) record",
        "getaddrinfo() is a synchronous, blocking call with no bounded worst-case latency — it may involve a network round trip to a resolver, multiple queries, or retries — and it can return a mix of A (IPv4) and AAAA (IPv6) addresses; calling it inline on a hot path can stall the thread far longer than the connection itself takes, so latency-sensitive systems resolve and cache addresses ahead of time",
        "If the hostname has no AAAA record, getaddrinfo() always throws a C++ exception rather than returning an error code",
        "DNS resolution never fails silently or slowly; a nonexistent hostname always returns instantly",
      ],
      correctIndex: 1,
    },
    explanation:
      "getaddrinfo() is a blocking, synchronous library call that may consult /etc/hosts, NSS " +
      "modules, and ultimately issue one or more network round trips to a DNS resolver, with " +
      "retries across nameservers on failure — its worst-case latency is unbounded if the " +
      "resolver is slow or unreachable. It can legitimately return multiple addresses spanning " +
      "both IPv4 (A) and IPv6 (AAAA) families per the address-selection rules in RFC 6724, and " +
      "signals failure via a nonzero return code such as EAI_NONAME rather than an exception " +
      "(this is plain C). For latency-critical paths, resolution should happen out-of-band ahead " +
      "of time (or asynchronously) rather than inline immediately before a hot connect() call.",
  },
  {
    id: "networking-bandwidth-latency-12",
    category: "networking",
    difficulty: "easy",
    title: "Bandwidth versus latency for a small message",
    tags: ["bandwidth", "latency", "propagation-delay"],
    type: "trace",
    prompt:
      "System A: 100 Gbps link, 40ms one-way propagation delay (cross-continental fiber). System B: 1 Gbps link, 5 microsecond one-way propagation delay (same-rack, direct fiber). A trading system needs to send a single 200-byte order message and get an ACK back as fast as possible. Which link wins, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "System A wins, because 100 Gbps is far higher bandwidth than 1 Gbps",
        "System B wins for this workload: a 200-byte round trip is dominated by propagation delay, not transfer time — even at 1 Gbps, serializing 200 bytes takes roughly 1.6 microseconds — so B's round trip (roughly 10 microseconds) massively beats A's (roughly 80 milliseconds), despite A having 100x the bandwidth",
        "Both links perform identically, since bandwidth and latency don't meaningfully affect small messages",
        "System A wins, because higher bandwidth always implies lower latency",
      ],
      correctIndex: 1,
    },
    explanation:
      "Bandwidth (throughput capacity) and latency (propagation plus serialization/processing " +
      "delay) are orthogonal properties of a link. For a small message, total time is dominated " +
      "by propagation delay plus a negligible serialization component (payload size divided by " +
      "bandwidth) — bandwidth only becomes the limiting factor once enough data is in flight to " +
      "fill the pipe. A 200-byte message serializes in roughly 1.6 microseconds even at 1 Gbps, " +
      "so System B's few-microsecond round trip crushes System A's ~80ms round trip despite " +
      "A having 100x the raw bandwidth. This is exactly why HPC/trading infrastructure prioritizes " +
      "short physical paths, co-location, and kernel-bypass networking over raw link bandwidth.",
  },
  {
    id: "networking-tcp-slow-start-13",
    category: "networking",
    difficulty: "medium",
    title: "Cold connection versus warmed-up connection",
    tags: ["tcp", "congestion-control", "slow-start"],
    type: "trace",
    prompt:
      "A client opens a brand-new TCP connection and immediately sends a large 10MB payload. A second client reuses an existing TCP connection that has been actively transferring data for several seconds already, and sends the same 10MB payload. Which transfer finishes faster, all else (bandwidth, RTT) being equal, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They finish in identical time, since TCP throughput is determined solely by the advertised receive window",
        "The warmed-up connection is typically faster: a fresh connection starts with a small congestion window (cwnd) and ramps up via slow start, roughly doubling cwnd each RTT until reaching the slow-start threshold, so early transmission is throttled well below the link's true capacity, while the already-active connection's cwnd is already large",
        "The new connection is always faster, since it hasn't accumulated any retransmission backlog",
        "Slow start only applies to UDP flows, so this has no bearing on either TCP transfer",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP congestion control algorithms (Reno-family, CUBIC, etc.) begin each new connection " +
      "with a small initial congestion window — historically around 4KB, and per RFC 6928 more " +
      "recently around 10 segments (~14KB) — then grow it exponentially during slow start each " +
      "RTT until hitting the slow-start threshold or experiencing loss, after which growth " +
      "becomes more conservative (congestion avoidance). A brand-new connection therefore needs " +
      "several RTTs before it can utilize the link's full available bandwidth, whereas a " +
      "connection that has already been transferring data has a large cwnd and can push data " +
      "near the link's capacity immediately. This is the underlying reason connection pooling, " +
      "keep-alive, and 0-RTT resumption matter for throughput on short-lived transfers.",
  },
  {
    id: "networking-ip-fragmentation-mtu-14",
    category: "networking",
    difficulty: "hard",
    title: "A datagram bigger than the path MTU",
    tags: ["ip", "fragmentation", "mtu", "udp"],
    type: "trace",
    prompt:
      "A UDP application sends a single 3000-byte datagram over a standard Ethernet path with a 1500-byte MTU, with the IP 'Don't Fragment' (DF) bit not set (the default for a plain sendto()). What happens at the IP layer, and what changes if DF were set instead?",
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
        "sendto() fails immediately with EMSGSIZE regardless of the DF bit, since UDP never allows a payload larger than the MTU",
        "Without DF set, the IP layer fragments the 3000-byte datagram into multiple IP fragments (roughly 1500-byte pieces) that are reassembled at the destination — but if any single fragment is lost, the entire datagram is discarded since UDP has no fragment-level retransmission; with DF set, a device that cannot forward the packet within the outgoing link's MTU instead drops it and should return an ICMP Fragmentation Needed message, which underlies Path MTU Discovery",
        "The datagram is silently truncated to 1500 bytes and sent as a single packet",
        "The IP layer automatically compresses the payload to fit under the MTU",
      ],
      correctIndex: 1,
    },
    explanation:
      "With DF unset, a 3000-byte UDP payload exceeding the path MTU is split by the sending " +
      "stack (or an intermediate router) into multiple IP fragments carrying offset information " +
      "for reassembly at the destination; because UDP has no notion of partial delivery, losing " +
      "even a single fragment makes the entire datagram undeliverable, and it is silently " +
      "discarded with no retransmission unless the application implements one. With DF set, any " +
      "device along the path unable to forward the packet without fragmenting it drops it and " +
      "should send back an ICMP Type 3 Code 4 (Fragmentation Needed) message, which is the basis " +
      "of Path MTU Discovery — if that ICMP is blackholed by a misconfigured firewall, the sender " +
      "can stall indefinitely (the classic PMTUD black-hole failure mode). Latency-sensitive " +
      "systems generally avoid fragmentation entirely, since a single lost fragment wastes the " +
      "whole message and reassembly adds per-packet CPU and reordering risk.",
  },
  {
    id: "networking-byte-order-15",
    category: "networking",
    difficulty: "easy",
    title: "Forgetting htons() on a port number",
    tags: ["endianness", "byte-order", "htons"],
    type: "trace",
    prompt:
      "A client fills in a sockaddr_in's port field with a raw host-order integer instead of converting it, on a little-endian x86_64 machine, then calls connect(). What actually happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct sockaddr_in addr;
addr.sin_family = AF_INET;
addr.sin_port = 8080;              // BUG: should be htons(8080)
addr.sin_addr.s_addr = inet_addr("127.0.0.1");

connect(sock, (struct sockaddr*)&addr, sizeof(addr));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "connect() fails immediately with EINVAL because the kernel validates the port's byte order",
        "It connects successfully to port 8080, since x86_64 and network transmission both use little-endian order",
        "The port field is interpreted by the network stack as network byte order (big-endian); 8080 (0x1F90) stored little-endian in memory as bytes 90 1F is read by the stack as 0x901F = 36879, so the connection silently targets the wrong port with no error raised anywhere",
        "The compiler rejects the code at compile time because sin_port requires an explicit conversion function to be called",
      ],
      correctIndex: 2,
    },
    explanation:
      "Multi-byte fields in network protocol headers, including sockaddr_in's sin_port and " +
      "sin_addr, are always interpreted in network byte order, which is big-endian, independent " +
      "of the host's native architecture. On a little-endian host like x86_64, the literal 8080 " +
      "(0x1F90) is stored in memory low-byte-first; if it is never passed through htons(), the " +
      "network stack reads those same raw bytes as a big-endian value and computes 0x901F = " +
      "36879 instead. There is no compile-time or runtime check for this — it is a silent logic " +
      "bug that connects to (or listens on) the wrong port entirely, which is exactly why " +
      "htons()/htonl() on send and ntohs()/ntohl() on receipt exist and must be applied to every " +
      "multi-byte field crossing the host/wire boundary.",
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
        "sendfile() eliminates all copying entirely, including the network card's own DMA transfer, making the send instantaneous",
        "The naive path copies data from the kernel page cache into a userspace buffer via read(), then back from userspace into the kernel's socket buffer via send() — two redundant copies across the user/kernel boundary; sendfile() (or splice()) lets the kernel move data directly from the file's page cache to the socket buffer without ever staging it in userspace, and on NICs supporting scatter-gather DMA the CPU copy can be avoided almost entirely",
        "sendfile() eliminates the TCP three-way handshake, letting data flow before the connection is established",
        "sendfile() behaves identically to read()+send() and differs only in its function signature",
      ],
      correctIndex: 1,
    },
    explanation:
      "A conventional read()+send() loop requires copying file data from the kernel's page cache " +
      "into a userspace buffer via read(), then copying it back from that userspace buffer into " +
      "the kernel's socket send buffer via send() — two data copies plus two user/kernel " +
      "transitions. sendfile() (and splice()/vmsplice() more generally on Linux) lets the kernel " +
      "transfer data directly from the source file descriptor's page cache to the destination " +
      "socket's buffer without ever staging it in user space, and on NICs that support " +
      "scatter-gather DMA, the data can be DMA'd straight from the page cache onto the wire with " +
      "essentially no CPU-driven copy at all. This doesn't change anything about wire-level " +
      "behavior; it purely reduces CPU utilization and memory-bandwidth consumption per byte " +
      "transferred, which matters a great deal for high-throughput static-content/file servers.",
  },
  {
    id: "networking-udp-packet-loss-17",
    category: "networking",
    difficulty: "hard",
    title: "Out-of-order and dropped UDP packets",
    tags: ["udp", "packet-loss", "reordering", "market-data"],
    type: "trace",
    prompt:
      "A market-data UDP feed transmits sequentially numbered packets 1, 2, 3, 4, 5. Due to network conditions, packet 3 is dropped in transit, and packets 4 and 5 arrive out of transmission order (5 before 4). What does the receiving application's sequence of recvfrom() calls actually return?",
    snippet: {
      language: "cpp",
      filename: "client_server.cpp",
      code: `// Sender transmits, in order: seq=1,2,3,4,5
// (packet 3 is lost in transit; 5 happens to arrive before 4)

char buf[1500];
for (;;) {
    ssize_t n = recvfrom(sock, buf, sizeof(buf), 0, NULL, NULL);
    // application inspects the sequence number embedded in the payload
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "recvfrom() calls return packets 1, 2, 3, 4, 5 in order — the kernel buffers and resequences UDP datagrams before delivering them, and retransmits lost ones automatically",
        "recvfrom() calls return exactly 1, 2, 4, 5 in that order, then block forever waiting for packet 3, which will never arrive",
        "recvfrom() calls return 1, 2, 5, 4 — whatever datagrams actually arrive, delivered in arrival order, with no reordering, retransmission, or loss detection performed by the OS; the application must inspect its own embedded sequence numbers to detect both the gap (packet 3) and the reorder (5 before 4)",
        "The socket returns an error on the call that would have received packet 3, explicitly alerting the application to the loss",
      ],
      correctIndex: 2,
    },
    explanation:
      "UDP performs no sequencing, retransmission, or reordering at any layer — each recvfrom() " +
      "simply returns the next datagram sitting in the socket's receive queue, in the order the " +
      "network stack delivered it, which is arrival order rather than necessarily transmission " +
      "order. Since packet 3 was dropped, it never arrives, and no recvfrom() call surfaces its " +
      "absence in any way; since packet 5 arrived ahead of packet 4, the application observes " +
      "them swapped relative to send order. Any application requiring in-order, complete " +
      "delivery over UDP — as most market-data and multicast feeds do — must embed sequence " +
      "numbers in the payload itself and implement gap detection plus a recovery strategy " +
      "(request retransmission over a separate channel, tolerate the loss, or fail over to a " +
      "backup feed) entirely at the application layer.",
  },
  {
    id: "networking-unix-domain-socket-18",
    category: "networking",
    difficulty: "hard",
    title: "Unix domain sockets versus TCP loopback",
    tags: ["unix-domain-socket", "loopback", "ipc"],
    type: "trace",
    prompt:
      "Two processes on the same machine need a fast IPC channel. One design uses a Unix domain socket (AF_UNIX); another uses TCP over 127.0.0.1 (loopback). Both avoid the physical NIC entirely. Which has lower overhead, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They have identical overhead, since loopback traffic never leaves the kernel, making both paths functionally the same",
        "TCP over loopback is faster, because TCP's congestion control optimizes throughput even on a virtual interface",
        "Unix domain sockets are typically faster: loopback TCP still pays for full TCP/IP protocol processing (segmentation, sequence/ACK bookkeeping, congestion-control state, checksums, routing lookups) even though no physical wire is involved, while AF_UNIX sockets are a pure in-kernel IPC mechanism that copies data directly between processes' socket buffers with no protocol-stack overhead, and are addressed by filesystem path rather than IP:port",
        "Unix domain sockets are implemented on top of the loopback interface internally, so there is no meaningful difference between the two",
      ],
      correctIndex: 2,
    },
    explanation:
      "TCP over 127.0.0.1 still traverses the complete TCP/IP protocol stack in the kernel — " +
      "segmentation, sequence-number and ACK bookkeeping, congestion-control state machines, " +
      "checksum computation, and routing/ARP-equivalent lookups — even though the loopback " +
      "device never touches physical hardware, and that per-packet protocol-processing overhead " +
      "is real, measurable CPU cost. AF_UNIX (Unix domain) sockets bypass the network protocol " +
      "stack entirely: endpoints are addressed by filesystem pathname (or Linux's abstract " +
      "namespace) rather than IP:port, and the kernel simply copies data between the two " +
      "processes' socket buffers, yielding lower latency and higher throughput for same-host IPC " +
      "— plus the ability to pass open file descriptors between processes via SCM_RIGHTS " +
      "ancillary messages, which TCP cannot do at all. For colocated same-machine HPC/trading " +
      "IPC, Unix domain sockets (or shared-memory ring buffers) are generally preferred over " +
      "loopback TCP for exactly this reason.",
  },
  {
    id: "networking-window-scaling-19",
    category: "networking",
    difficulty: "hard",
    title: "Window scaling and the 64KB throughput ceiling",
    tags: ["tcp", "window-scaling", "bdp", "rfc1323"],
    type: "trace",
    prompt:
      "A connection runs over a 10 Gbps path with a 100ms round-trip time (bandwidth-delay " +
      "product ≈ 125MB). One endpoint's TCP stack has window scaling disabled, so the option " +
      "is never negotiated during the handshake. What throughput ceiling does this connection " +
      "hit, and why, regardless of how large the socket buffers are configured?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Header-level view: TCP's window field is a fixed 16-bit value.
// Without a negotiated Window Scale option (RFC 1323), the receiver
// can never advertise more than 65535 bytes of window, no matter
// how large SO_RCVBUF is set:
int rcvbuf = 128 * 1024 * 1024; // 128MB — irrelevant if scaling is off
setsockopt(sock, SOL_SOCKET, SO_RCVBUF, &rcvbuf, sizeof(rcvbuf));`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "There is no ceiling — TCP renegotiates its window size per-segment throughout the connection's life, independent of anything decided at handshake time",
        "The 16-bit window field in the TCP header caps the advertised window at 65,535 bytes; the scale factor that would extend it (up to a 2^14 multiplier, for an effective ~1GB window) is a TCP option exchanged only in the SYN/SYN-ACK, so if either side doesn't offer or honor it, the connection is stuck with a raw ≤64KB window for its entire lifetime — capping throughput at roughly window/RTT ≈ 65535 bytes / 100ms ≈ 5.2 Mbps, orders of magnitude below the link's 10 Gbps capacity",
        "Throughput is unaffected since CUBIC's congestion window, not the advertised receive window, is what ultimately limits how much data can be in flight",
        "The connection simply falls back to UDP-style unacknowledged transmission once the window field overflows",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP's window field in the segment header is fixed at 16 bits by the original protocol " +
      "design, so the raw advertised window can never exceed 65,535 bytes. RFC 1323's Window " +
      "Scale option works around this by having both endpoints exchange a shift count " +
      "(0-14) during the SYN/SYN-ACK exchange — and only then, since it's a handshake-time-only " +
      "option with no mechanism to renegotiate later — after which every advertised window value " +
      "is left-shifted by that count, allowing effective windows up to roughly 1GB. If either " +
      "side's stack doesn't send or honor the option, the connection is locked to the unscaled " +
      "≤64KB window for its entire lifetime. Since the amount of unacknowledged data in flight " +
      "can never exceed the receiver's advertised window, throughput is bounded by window/RTT " +
      "regardless of link bandwidth or socket buffer size — on a 100ms-RTT path that's roughly " +
      "5 Mbps, a catastrophic bottleneck on a 10 Gbps link, which is exactly why window scaling " +
      "is essential on any high bandwidth-delay-product path.",
  },
  {
    id: "networking-sack-20",
    category: "networking",
    difficulty: "medium",
    title: "Why cumulative ACK alone stalls multi-loss recovery",
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
        "There's no difference — cumulative ACK and SACK convey identical information, SACK just arrives faster",
        "With cumulative ACK only, every ACK after segment 3 is lost keeps naming just the next expected byte (ACK=3), giving the sender no signal that 4-6 and 8-10 already arrived; the sender can only infer something past 3 is missing and, absent other information, may retransmit everything from 3 onward. With SACK enabled, the receiver's ACK additionally reports the discontiguous ranges it has successfully buffered (e.g. blocks covering 4-6 and 8-10), letting the sender retransmit only the two genuinely missing segments, 3 and 7",
        "SACK causes the receiver to silently reorder and reassemble the stream so no retransmission is ever necessary, even for the missing segments",
        "SACK is a replacement for TCP checksums, used to detect corrupted segments rather than lost ones",
      ],
      correctIndex: 1,
    },
    explanation:
      "Plain cumulative ACKing only ever communicates the next in-order byte the receiver " +
      "expects, so once segment 3 is lost, every subsequent ACK is pinned at ACK=3 regardless of " +
      "how much later data (4-6, 8-10) has actually arrived and been buffered — the sender has no " +
      "visibility into which later segments are already present, historically leading Reno-style " +
      "stacks to retransmit conservatively or wait out a full RTO. The SACK option (RFC 2018) " +
      "adds up to several discontiguous received-range blocks to the ACK, explicitly telling the " +
      "sender which out-of-order data the receiver already holds; the sender can then retransmit " +
      "precisely the missing segments (3 and 7 here) instead of everything past the first gap. " +
      "This matters enormously whenever multiple losses occur within a single window — a common " +
      "case on lossy or bursty-loss links — since it turns an O(window) retransmission into an " +
      "O(losses) one and avoids needlessly re-sending data the receiver already has.",
  },
  {
    id: "networking-bbr-cubic-21",
    category: "networking",
    difficulty: "hard",
    title: "BBR versus CUBIC on a lossy but uncongested link",
    tags: ["tcp", "congestion-control", "bbr", "cubic"],
    type: "trace",
    prompt:
      "A link has ample spare bandwidth but exhibits a small amount of random, non-congestive " +
      "packet loss (e.g. a flaky radio/satellite hop) — loss that is not caused by queue " +
      "buildup anywhere on the path. Contrast how a CUBIC sender and a BBR sender respond to " +
      "this loss, and why their achieved throughput diverges.",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both react identically, since all standard TCP congestion control algorithms treat any packet loss as the primary congestion signal",
        "CUBIC treats every packet loss as an implicit congestion signal and multiplicatively cuts its congestion window (roughly by a factor of ~0.7) on each loss event regardless of cause, so repeated random non-congestive loss keeps shrinking cwnd and collapses throughput well below the link's real capacity; BBR does not use loss as its primary signal — it continuously models the bottleneck bandwidth and minimum RTT and paces transmission at that estimated rate, so it can sustain throughput close to the link's true capacity through incidental loss that isn't caused by queueing, at the cost of being less immediately responsive to genuine congestion when sharing a bottleneck with loss-based flows",
        "BBR always achieves lower throughput than CUBIC on any link with nonzero loss, since it lacks a retransmission mechanism entirely",
        "CUBIC ignores packet loss entirely and only reacts to explicit congestion notification (ECN) marks",
      ],
      correctIndex: 1,
    },
    explanation:
      "CUBIC (like the Reno lineage before it) is a loss-based algorithm: it grows its " +
      "congestion window along a cubic function of time since the last loss event and treats " +
      "any detected loss as evidence of congestion, cutting cwnd multiplicatively in response — " +
      "an assumption that holds on links where loss really does mean queue overflow, but fails " +
      "when loss is caused by an unreliable physical medium unrelated to congestion, repeatedly " +
      "throttling a connection that has plenty of headroom. BBR instead builds an explicit model " +
      "of the path by periodically probing for the bottleneck bandwidth (BtlBw) and minimum RTT, " +
      "then paces outgoing data at that estimated rate rather than reacting to loss as its primary " +
      "control signal, letting it largely ignore incidental non-congestive loss and sustain " +
      "throughput near the link's actual capacity. This divergence is precisely why BBR was " +
      "developed for exactly this class of lossy-but-uncongested links (and is also the source of " +
      "well-documented fairness concerns when BBR flows compete with loss-based CUBIC flows for " +
      "the same congested bottleneck).",
  },
  {
    id: "networking-time-wait-22",
    category: "networking",
    difficulty: "hard",
    title: "Why the closing side alone pays for TIME_WAIT",
    tags: ["tcp", "time_wait", "ephemeral-ports", "connection-teardown"],
    type: "trace",
    prompt:
      "A high-throughput proxy opens thousands of short-lived outbound TCP connections per " +
      "second to backend servers, and the proxy itself always calls close() first on each " +
      "connection right after reading the backend's response. Which side of each connection " +
      "enters TIME_WAIT, and why does this specifically threaten the proxy — not the backend " +
      "— with resource exhaustion?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "TIME_WAIT is entered by both sides simultaneously and symmetrically, so the proxy and backend are equally at risk",
        "Whichever side performs the active close (sends the first FIN) transitions through FIN_WAIT into TIME_WAIT and holds its local (IP, port) tuple there for 2*MSL to guard against stray duplicate segments from the old connection being misdelivered into a new one reusing that tuple, while the passive closer moves straight to CLOSED. Since the proxy always closes first, it — not the backend — accumulates thousands of sockets per second parked in TIME_WAIT bound to its own ephemeral source ports, and because a 2*MSL hold (commonly ~60s) vastly outlasts the connection's actual lifetime, the pool of available ephemeral ports can be exhausted faster than entries expire, causing subsequent connect() calls to fail with EADDRNOTAVAIL",
        "TIME_WAIT is assigned to whichever side has the numerically lower IP address, independent of which side closes first",
        "The backend always enters TIME_WAIT because it is the listening/server-side socket, regardless of who calls close() first",
      ],
      correctIndex: 1,
    },
    explanation:
      "TIME_WAIT is a property of whichever endpoint performs the active close — the side that " +
      "sends the first FIN and subsequently ACKs the peer's FIN — not a property of client-vs-" +
      "server role; that side lingers in TIME_WAIT for 2*MSL (Maximum Segment Lifetime, " +
      "commonly yielding ~60s on Linux) specifically so any duplicate or delayed segment still " +
      "traversing the network from the old connection can't be mistaken for data on a new " +
      "connection that later reuses the identical 4-tuple. Because the proxy in this scenario " +
      "closes first on every connection, it is the proxy's ephemeral source ports that pile up in " +
      "TIME_WAIT — at thousands of connections per second against a ~60s linger time, tens of " +
      "thousands of tuples can be outstanding simultaneously, which can exceed the ~28,000-port " +
      "default ephemeral range and starve new outbound connect() calls. Common mitigations " +
      "include widening net.ipv4.ip_local_port_range, enabling connection reuse/pooling to the " +
      "backends, or (with care, since it changes correctness guarantees) tcp_tw_reuse for " +
      "outbound connections.",
  },
  {
    id: "networking-quickack-nodelay-23",
    category: "networking",
    difficulty: "hard",
    title: "TCP_QUICKACK versus TCP_NODELAY — opposite ends of the same stall",
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
        "TCP_QUICKACK and TCP_NODELAY are simply two names for the same sockopt on different platforms, so setting one is redundant with the other",
        "TCP_NODELAY is a sender-side setting: it disables Nagle's algorithm so small writes are transmitted immediately instead of being held back while unacknowledged data is outstanding. TCP_QUICKACK is a receiver-side setting: it disables (on Linux, only until the next read, since the flag is a one-shot toggle rather than a persistent mode) the delayed-ACK timer that would otherwise hold an ACK back for tens of milliseconds hoping to piggyback it on outgoing data. Because Nagle on one side is gated on whether unacked data is outstanding, a peer's delayed ACK can indirectly stall a NODELAY sender's next small write even though NODELAY itself is working exactly as intended — so eliminating the stall in both directions requires addressing both the sender's Nagle behavior and the receiver's delayed-ACK behavior",
        "TCP_QUICKACK disables Nagle's algorithm just like TCP_NODELAY, but only for the first three segments of a connection",
        "TCP_QUICKACK is deprecated and has no effect on any current Linux kernel; TCP_NODELAY alone is always sufficient",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP_NODELAY and TCP_QUICKACK address two distinct mechanisms that can each independently " +
      "introduce latency. Nagle's algorithm (disabled by TCP_NODELAY) is a sender-side policy " +
      "that withholds a small segment while earlier data on the same connection remains " +
      "unacknowledged; delayed ACK (disabled, transiently, by TCP_QUICKACK on Linux) is a " +
      "receiver-side policy that withholds an ACK for up to ~40ms hoping to coalesce it with " +
      "outgoing data or with other ACKs, rather than send a standalone ACK packet immediately. " +
      "The two interact because Nagle's 'wait for unacked data to clear' condition depends on " +
      "the peer's ACK arriving promptly — if the peer delays that ACK, a NODELAY sender with " +
      "more small data queued up can still stall waiting for it, even though Nagle itself is " +
      "disabled. On Linux, TCP_QUICKACK is additionally a one-shot flag that reverts to the " +
      "delayed-ACK default after the next read, so an application wanting durably fast ACKs must " +
      "re-arm it after every recv() rather than setting it once at connection setup.",
  },
  {
    id: "networking-kernel-bypass-24",
    category: "networking",
    difficulty: "medium",
    title: "Kernel-bypass networking for tick-to-trade latency",
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
        "Kernel bypass simply enlarges the kernel's internal socket buffers so fewer packets are dropped under load; the data path through the kernel is otherwise unchanged",
        "DPDK/AF_XDP map the NIC's RX/TX descriptor ring buffers directly into the userspace process's address space and let that process poll them directly, bypassing the kernel network stack entirely — eliminating interrupt-driven context switches, the kernel-to-userspace socket buffer copy, and the full protocol-stack traversal (routing, netfilter, etc.) that a normal recv() pays on every packet; the tradeoff is the application must implement its own packet/protocol handling and typically dedicates a CPU core to continuously poll the ring rather than sleep waiting for an interrupt",
        "AF_XDP transparently converts all TCP traffic to UDP to avoid handshake overhead, without any application-visible change",
        "Kernel bypass works by having the kernel pre-parse and cache DNS lookups for the trading destinations, removing resolution latency",
      ],
      correctIndex: 1,
    },
    explanation:
      "In the standard socket path, an arriving packet triggers a hardware interrupt (or NAPI " +
      "poll), gets copied from the NIC driver's buffer into a kernel socket buffer (sk_buff), " +
      "traverses the full protocol stack (IP/TCP/UDP processing, netfilter hooks, routing), and " +
      "is then copied again into the userspace buffer supplied to recv() — each step adding " +
      "latency and, more importantly, jitter from scheduling and interrupt coalescing. DPDK and " +
      "AF_XDP instead map the NIC's descriptor rings directly into a userspace process's memory " +
      "so the application can poll for new packets and process them without any kernel " +
      "involvement, interrupt, context switch, or intermediate copy on the data path. This buys " +
      "deterministic, sub-microsecond packet handling at the cost of the application taking on " +
      "responsibilities the kernel used to provide (its own lightweight protocol parsing, and " +
      "usually a dedicated, busy-polling CPU core pinned away from the OS scheduler) — exactly " +
      "the tradeoff HFT market-data and order-entry paths are willing to make.",
  },
  {
    id: "networking-rdma-25",
    category: "networking",
    difficulty: "hard",
    title: "RDMA one-sided READ versus traditional send/recv",
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
        "There's no fundamental difference — RDMA is just TCP with jumbo frames and a different socket API for the same send/recv model",
        "Traditional recv() requires active participation from the remote host's CPU and OS on every transfer: the remote application must call send() (or the kernel stages the data through its socket buffers) and the local host's kernel copies it into a userspace buffer. RDMA READ is one-sided: after a queue pair and a region of the remote host's memory have been registered (pinned) with its RDMA-capable NIC ahead of time, the local NIC can directly read pages of that registered remote memory over the network via the remote NIC's hardware, without interrupting the remote CPU, invoking its OS network stack, or requiring any remote application code to run at transfer time — true end-to-end kernel-bypass, zero-copy delivery, at the cost of needing specialized RDMA hardware and upfront memory registration",
        "RDMA READ requires the remote application to call recv() at the precise moment the READ is issued, making it functionally identical to synchronous send/recv but over InfiniBand physical media",
        "RDMA eliminates the need for any memory registration; any arbitrary remote address can be read at any time without prior setup",
      ],
      correctIndex: 1,
    },
    explanation:
      "Conventional send/recv requires symmetric participation: the sending application calls " +
      "send(), its kernel copies data into a socket buffer and transmits it, and on the far end " +
      "the receiving kernel copies incoming data into its socket buffer where a recv() call by " +
      "the remote application copies it again into userspace — both CPUs and OS network stacks " +
      "are actively involved on every transfer. RDMA inverts this for one-sided verbs like READ " +
      "(and WRITE): once the remote application has registered (pinned) a memory region with its " +
      "RDMA NIC and shared the resulting memory handle/key out of band, the local NIC can issue " +
      "hardware-level read requests directly against that registered remote memory, with the " +
      "remote NIC servicing the request in hardware — the remote CPU is never interrupted and no " +
      "remote application code executes at transfer time. This yields true zero-copy, kernel-" +
      "bypass data movement end-to-end, which is why RDMA (over InfiniBand or RoCE) shows up in " +
      "HFT and HPC contexts wherever the absolute lowest, most deterministic latency for large or " +
      "frequent transfers is required, at the cost of requiring RDMA-capable NICs and careful " +
      "upfront memory-region management.",
  },
  {
    id: "networking-multicast-market-data-26",
    category: "networking",
    difficulty: "medium",
    title: "Why exchange feeds use UDP multicast, not TCP",
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
        "IP multicast, like TCP, guarantees ordered and complete delivery to every subscriber via router-level acknowledgment, so no additional reliability layer is needed",
        "UDP multicast lets a single transmitted packet be replicated by the network fabric itself (switches/routers tracking group membership via IGMP/PIM) out to arbitrarily many subscribers, so the exchange's origination bandwidth and CPU cost stay constant regardless of subscriber count — unlike TCP, which is strictly point-to-point and would require a separate connection, and a separate copy of every message, per subscriber. The cost is that IP multicast inherits UDP's complete lack of delivery guarantees: no ACKs, no retransmission, no per-subscriber flow control, so any subscriber can silently miss packets, meaning the exchange must layer its own sequence-numbered gap detection plus a separate recovery mechanism (a unicast retransmission-request channel or periodic snapshot feed) on top",
        "UDP multicast is used only for control messages like session heartbeats; the actual order and trade data always flows over per-subscriber TCP connections",
        "Multicast routers automatically retransmit any packet a subscriber's IGMP membership report indicates was missed, making the feed as reliable as TCP without any application-level work",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP's fan-out cost scales linearly with subscriber count — N subscribers means N " +
      "connections and N copies of every outbound message originating from the exchange, which " +
      "becomes prohibitive at market-data scale. UDP multicast instead lets the network " +
      "infrastructure itself replicate a single transmitted packet to every interested receiver, " +
      "with switches and routers tracking group membership (via IGMP for hosts, PIM between " +
      "routers) so the source's send cost is independent of subscriber count. The unavoidable " +
      "tradeoff is that multicast delivery is exactly as unreliable as UDP unicast — no " +
      "acknowledgment, retransmission, or ordering guarantee exists at the IP or UDP layer, and " +
      "different subscribers can experience completely different loss patterns depending on " +
      "their network path. Real exchange feed protocols (e.g. ITCH-style feeds) compensate by " +
      "embedding monotonic sequence numbers in every message so each subscriber can detect gaps " +
      "locally, paired with either a unicast TCP 'recovery' service for on-demand retransmission " +
      "of missed messages or a periodically republished snapshot to bound how far behind a " +
      "recovering subscriber can fall.",
  },
  {
    id: "networking-ptp-ntp-27",
    category: "networking",
    difficulty: "medium",
    title: "PTP hardware timestamping versus NTP for trade timestamping",
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
        "PTP simply encodes more decimal places of precision in its packet format; the underlying synchronization mechanism is otherwise the same as NTP",
        "NTP's accuracy is fundamentally bounded by taking its timestamps in software, at the point sync packets are processed by the OS/application stack — subject to unpredictable interrupt handling, scheduling, and stack-traversal jitter — typically yielding millisecond-scale accuracy over WAN-scale, asymmetric paths. PTP, paired with hardware timestamping on the NIC (and ideally transparent/boundary clocks on intermediate switches), timestamps sync packets at the physical layer the instant they cross the wire, removing OS-induced jitter from the measurement entirely, and is normally run over a controlled, low-variance LAN — together enabling sub-microsecond (often tens-of-nanoseconds) synchronization",
        "PTP replaces UDP with a reliable, retransmitting transport for its sync messages, whereas NTP's sync messages can be silently dropped",
        "NTP is inherently more accurate than PTP but is avoided in trading because it requires a paid license",
      ],
      correctIndex: 1,
    },
    explanation:
      "Both NTP and PTP work by exchanging timestamped messages and computing offset/delay " +
      "estimates from them, but the accuracy ceiling of that computation is set by how precisely " +
      "(and how symmetrically) the timestamps themselves can be captured. NTP timestamps are " +
      "taken in software as the packet is processed by the kernel/application, so they inherit " +
      "OS scheduling latency, interrupt coalescing delay, and NIC-to-CPU transfer jitter, and " +
      "NTP is typically deployed over WAN paths with asymmetric, variable round trips — the " +
      "combination caps practical accuracy at roughly single-digit milliseconds. PTP's design " +
      "specifically targets this: when the NIC hardware itself timestamps sync packets at the " +
      "physical/MAC layer the instant they're transmitted or received, and intermediate switches " +
      "participate as transparent or boundary clocks to correct for their own queuing delay, " +
      "essentially all OS-induced jitter is removed from the measurement, and running over a " +
      "controlled LAN keeps path asymmetry minimal — together yielding sub-microsecond accuracy. " +
      "This is why PTP with hardware timestamping is the standard for regulatory trade-" +
      "timestamping requirements (e.g. MiFID II clock synchronization) in trading infrastructure.",
  },
  {
    id: "networking-cork-nodelay-28",
    category: "networking",
    difficulty: "hard",
    title: "TCP_CORK's inverse intent versus TCP_NODELAY",
    tags: ["tcp", "tcp_cork", "nagle", "throughput", "latency"],
    type: "trace",
    prompt:
      "A server handles two very different workloads on separate sockets: (1) streaming a " +
      "large file, where a header and payload are written via several small write() calls " +
      "that should ideally coalesce into full, efficiently-packed segments; and (2) a latency-" +
      "sensitive tick stream, where every small message must hit the wire immediately. Which " +
      "socket option suits which workload, and in what sense are TCP_CORK and TCP_NODELAY " +
      "roughly inverses of each other?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Workload 1: bulk file transfer
int one = 1;
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
        "TCP_CORK and TCP_NODELAY do the same thing — disable Nagle's algorithm — and are simply the older BSD name versus the newer Linux name for identical behavior",
        "TCP_CORK explicitly withholds transmission of a partially-full segment until either the socket is uncorked, an internal ~200ms timeout fires, or enough data accumulates to fill a full segment — letting an application deliberately batch several small writes into one efficiently-packed TCP segment. This is the opposite intent of TCP_NODELAY, which disables Nagle's algorithm so every write is transmitted immediately regardless of size. Workload 1 (bulk file transfer) benefits from corking around the header+payload writes to minimize segment overhead and maximize throughput efficiency; workload 2 (tick stream) needs TCP_NODELAY so each small message is flushed onto the wire immediately rather than waiting to batch, prioritizing latency over segment efficiency",
        "TCP_NODELAY should be used for the bulk file transfer too, since disabling all buffering unconditionally maximizes throughput for any workload",
        "TCP_CORK only affects UDP sockets and has no defined behavior when applied to a TCP socket",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP_NODELAY disables Nagle's algorithm, which normally withholds small writes while " +
      "earlier data is unacknowledged, so that every write() is pushed onto the wire as soon as " +
      "possible — favoring latency over segment packing efficiency. TCP_CORK (Linux; TCP_NOPUSH " +
      "on BSD/macOS is closely analogous) does the conceptual opposite: it actively suppresses " +
      "transmission of a partial segment so that multiple subsequent write() calls can accumulate " +
      "into a single, fully-packed segment before finally being flushed — either explicitly by " +
      "unsetting the option or automatically after roughly 200ms — favoring wire efficiency and " +
      "throughput over per-write latency. A bulk file transfer benefits from corking around the " +
      "logically-related header-plus-payload writes so they ship as one well-formed segment " +
      "instead of several small, overhead-heavy ones, whereas a tick stream needs TCP_NODELAY " +
      "precisely because waiting to batch is unacceptable — each message's value depends on " +
      "arriving as fast as possible, even at the cost of smaller, less-packed segments.",
  },
  {
    id: "networking-socket-buffer-tuning-29",
    category: "networking",
    difficulty: "hard",
    title: "A too-small receive buffer capping throughput on a clean, fast link",
    tags: ["tcp", "so_rcvbuf", "so_sndbuf", "bdp", "throughput"],
    type: "trace",
    prompt:
      "A bulk transfer over a 10 Gbps link with a 20ms RTT (bandwidth-delay product ≈ 25MB) " +
      "plateaus at a small fraction of the link's capacity, despite near-zero packet loss and " +
      "an already-large congestion window. The receiving socket's SO_RCVBUF was left at the " +
      "OS default of a few hundred KB. What mechanism, independent of congestion control, " +
      "explains the plateau?",
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
        "Buffer sizing only affects UDP sockets; TCP throughput is governed exclusively by the sender's congestion window, so SO_RCVBUF is irrelevant here",
        "The TCP window the receiver advertises to the sender can never exceed the memory actually allocated to the socket's receive buffer (SO_RCVBUF, itself bounded by kernel autotuning limits such as net.ipv4.tcp_rmem's max), since the receiver cannot promise buffer space it doesn't have for unacknowledged or out-of-order data. Throughput is fundamentally capped at roughly (advertised window)/RTT, so a receive buffer of a few hundred KB against a 25MB bandwidth-delay product limits achievable throughput to a small fraction of the link's capacity no matter how large the sender's congestion window grows or how clean the link is — the fix is sizing SO_RCVBUF (and correspondingly SO_SNDBUF on the sender, which must hold the same amount of unacknowledged data) to at least the bandwidth-delay product",
        "The congestion window alone determines throughput once slow start has completed; socket buffer size stops mattering after the first RTT",
        "The fix is to reduce the connection's MSS so more segments fit within the existing small buffer",
      ],
      correctIndex: 1,
    },
    explanation:
      "The amount of data a sender can have unacknowledged in flight is bounded by the minimum " +
      "of the congestion window and the receiver's advertised TCP window — and the receiver can " +
      "never advertise a window larger than the memory it has actually allocated to buffer " +
      "incoming data, i.e. SO_RCVBUF (itself subject to the kernel's configured ceiling, e.g. the " +
      "third value of net.ipv4.tcp_rmem when autotuning is enabled). Since achievable throughput " +
      "is fundamentally window/RTT, a receive buffer of only a few hundred KB against a 20ms RTT " +
      "caps throughput to a small fraction of the link's true capacity, even with zero loss and " +
      "an unbounded congestion window — the classic 'fast, clean link, mysteriously slow transfer' " +
      "symptom. Because the send buffer must equally hold every byte sent but not yet " +
      "acknowledged, SO_SNDBUF on the sender needs the same bandwidth-delay-product-driven sizing; " +
      "under-provisioning either side reproduces the same plateau, which is exactly why explicit " +
      "buffer tuning (or verified autotuning ceilings) matters for high-BDP bulk transfers.",
  },
  {
    id: "networking-head-of-line-blocking-30",
    category: "networking",
    difficulty: "easy",
    title: "TCP head-of-line blocking on an already-arrived segment",
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
        "Yes — the kernel delivers each arrived segment to the application independently as soon as it arrives, regardless of gaps earlier in the stream",
        "No — TCP enforces strict in-order delivery to the application; even though the segments carrying messages 3, 4, and 5 have physically arrived and sit in the kernel's receive buffer, recv()/read() will not release any of that data until the gap left by the lost segment 2 is filled by retransmission, so the entire connection's application-visible stream stalls on that one loss. This is TCP head-of-line blocking, and it's a core reason protocols like QUIC/HTTP-3 multiplex independent streams over UDP instead — so a loss on one stream doesn't block delivery of unrelated ones",
        "The kernel reorders and delivers segments 3, 4, and 5 out of order, tagging them so the application can reassemble message 2 later once it arrives",
        "Head-of-line blocking is strictly a UDP phenomenon and cannot occur on a reliable, ordered protocol like TCP",
      ],
      correctIndex: 1,
    },
    explanation:
      "TCP guarantees the application an ordered byte stream, which the kernel implements by " +
      "holding out-of-order-arrived data in an internal reassembly buffer rather than delivering " +
      "it to recv()/read() until every preceding byte has arrived. So even though the segments " +
      "carrying messages 3, 4, and 5 are already sitting in the kernel, none of that data is " +
      "released to the application until the retransmission of the lost segment carrying message " +
      "2 arrives and fills the gap — the whole connection, and anything multiplexed on top of it, " +
      "stalls on that single loss. This is TCP head-of-line blocking, and it's an intrinsic " +
      "consequence of TCP's single ordered stream abstraction, not a bug — it's precisely why " +
      "HTTP/2's stream multiplexing over one TCP connection still suffers head-of-line blocking " +
      "at the transport layer, and why QUIC was designed to multiplex independent streams over " +
      "UDP instead, so that a loss affecting one stream's data doesn't stall delivery of other " +
      "streams' already-arrived data.",
  },
];
