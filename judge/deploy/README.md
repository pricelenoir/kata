# Judge runner

The worker that runs submissions (`judge/src/worker.ts`) lives on its own
Linux server, never on Vercel. It claims jobs from the database, judges them
in gVisor sandboxes, and writes results back. It only makes outbound
connections, so the server needs no open ports except SSH.

Run/Submit stay off on the site until `JUDGE_ENABLED=true` is set in Vercel,
so a runner can be set up and checked before anyone can reach it.

## The server

- Any Linux VM you have root on: Ubuntu 22.04/24.04 or Debian 12, amd64 or
  arm64. gVisor doesn't need nested virtualization.
- **4 vCPUs and 8 GB RAM** is a good start (2 jobs at once). A job uses up to
  2 CPUs and about 2.4 GB at its peak (compiling, or a sanitizer run), and the
  setup script sizes concurrency from that.
- About 10 GB of disk for the images.
- Use it for nothing else. The worker can start containers through the Docker
  socket, so the host is trusted territory; untrusted code only ever runs
  inside the gVisor sandboxes.

## One-time setup

### 1. Give the worker's database role a password

The `judge_worker` role exists (migration 0003) but can't log in yet. In the
Supabase dashboard → SQL Editor:

```sql
alter role judge_worker login password '<generate one: openssl rand -hex 24>';
```

The role has no table access. It can call four functions: claim a queued
job (which hands it that submission's code), extend its lease on it, record
the result, and fetch an exercise's hidden-test bundle. Nothing else: no user
accounts, progress, or other submissions.

### 2. Build its connection string

Dashboard → **Connect** → **Session pooler**, then replace the user
`postgres.<project-ref>` with `judge_worker.<project-ref>` and use the
password from step 1:

```
postgresql://judge_worker.<project-ref>:<password>@<pooler-host>:5432/postgres
```

Use port **5432** (session mode). The worker uses `LISTEN` to hear about new
jobs, which the transaction pooler on 6543 doesn't support; the setup script
refuses that port. A direct connection (`db.<project-ref>.supabase.co:5432`)
also works if the server has IPv6.

### 3. Publish the hidden tests

From your machine, in the repo root (the bundles come from `private/`):

```sh
npx tsx private/scripts/build.ts
JUDGE_ADMIN_DATABASE_URL='postgresql://postgres.<project-ref>:<db password>@<pooler-host>:5432/postgres' \
  npx tsx private/scripts/publish.ts
```

Re-run after changing any hidden tests. Without a bundle, Submit refuses to
judge that exercise ("hidden tests aren't published yet"); Run still works.

### 4. Set up the server

```sh
sudo git clone https://github.com/pricelenoir/kata /opt/kata
sudo /opt/kata/judge/deploy/setup-runner.sh
```

It installs Docker and gVisor, asks for the connection string from step 2
(stored in `/opt/kata/judge/.env`, mode 600), builds the sandbox images
(several minutes the first time), starts the worker, and runs a smoke test that
compiles C++ and Rust under gVisor and checks ThreadSanitizer catches a race.
It ends with the worker's log, which should show it connected and waiting.

Optional, but sensible since nothing needs to reach the server:

```sh
sudo ufw allow OpenSSH && sudo ufw enable
```

### 5. Turn it on

Vercel → kata → Settings → Environment Variables: add `JUDGE_ENABLED` =
`true` for Production, then redeploy (pages read it at build time). Then
try Run and Submit on the spin lock while watching the worker log.

## Day to day

```sh
# logs
docker compose -f /opt/kata/judge/compose.yaml logs -f worker

# after pushing judge, exercise, or image changes to main
sudo /opt/kata/judge/deploy/update-runner.sh
```

Exercise statements are compiled into the worker image, so a new or edited
exercise needs `update-runner.sh` as well as a site deploy, and new hidden
tests need `publish.ts`.

To change how many jobs run at once, edit `JUDGE_CONCURRENCY` in
`/opt/kata/judge/.env` and run `update-runner.sh`; re-running setup keeps
your value.

## Turning it off

Set `JUDGE_ENABLED=false` in Vercel and redeploy first, so nothing new
queues, then `docker compose -f /opt/kata/judge/compose.yaml down`. Jobs
left in the queue are picked up whenever a worker starts again.
