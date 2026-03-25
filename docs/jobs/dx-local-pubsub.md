# Local Pub/Sub Development

This guide covers how to test the job dispatch system locally using the GCP Pub/Sub emulator.

## Background

The SCMS job system has **two levels** of Pub/Sub:

1. **Dispatch topic** (`scmsJobDispatch`) — centralized topic for all job creation. Internal callers publish here; the dispatch endpoint receives push messages, creates DB rows, and runs handlers.
2. **Worker topics** (`scmsCheckTopic`, `scmsTaskConverterTopic`, etc.) — topic-specific topics for external workers (Cloud Run containers). Handlers publish to these; workers receive and process.

In development, routing is determined automatically:

| Condition                            | Behavior                                                |
| ------------------------------------ | ------------------------------------------------------- |
| `NODE_ENV=test`                      | No publishing — returns fake ID                         |
| `PUBSUB_EMULATOR_HOST` set           | Uses `@google-cloud/pubsub` client → routes to emulator |
| `NODE_ENV=development` (no emulator) | HTTP stub — POSTs directly to local endpoint            |
| Production (none of the above)       | Real GCP Pub/Sub                                        |

There are **no feature flags** (`DEV_PUBSUB_*` etc.) to manage. The presence of `PUBSUB_EMULATOR_HOST` is the only toggle between HTTP stub and emulator.

## Quick Start: HTTP Stub Mode (default)

No setup required. When `NODE_ENV=development` and `PUBSUB_EMULATOR_HOST` is not set:

- `dispatchAJob()` POSTs the Pub/Sub envelope directly to `http://127.0.0.1:3031/v1/jobs/dispatch`
- Check/converter handlers POST to `http://127.0.0.1:8080/`

Just start the SCMS app as usual:

```bash
npm run dev
```

Jobs dispatched via `dispatchAJob()` will hit the dispatch endpoint immediately. The dispatch endpoint creates the DB row and runs the handler inline.

## Emulator Setup

Use the emulator when you want to test the full Pub/Sub push flow, retry behavior, or message delivery.

### Project ID (`curvenote-dev-1`)

The emulator still exposes resources under `projects/{projectId}/...`. The start/setup scripts and the SCMS Pub/Sub client (when `pubsubProjectId` is not set in app config) default to **`curvenote-dev-1`**, the development GCP project, so topic names and REST paths line up with what the app uses for real dev Pub/Sub.

Set **`PUBSUB_PROJECT_ID`** in your environment when running `start-pubsub-emulator.sh` or `emulator-setup.sh` only if you need a different project id.

### Prerequisites

```bash
# Install the Pub/Sub emulator component (one-time)
gcloud components install pubsub-emulator
```

**Java (macOS)** — The emulator runs on the JVM. If `java -version` is not found or the version is too old, install a JDK (17 is a safe choice):

Using [Homebrew](https://brew.sh/):

```bash
brew install openjdk@17
```

Put the JDK on your `PATH` (Apple Silicon — adjust if you use Intel Homebrew under `/usr/local`):

```bash
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

After install, `brew info openjdk@17` also prints the exact `PATH` and optional symlink steps if you prefer the macOS `java` wrapper.

Verify:

```bash
java -version
```

### Step 1: Start the Emulator (includes topic setup)

From the repo root or `platform/scms`:

```bash
npm run dev:pubsub:emulator
```

This runs `docs/jobs/scripts/start-pubsub-emulator.sh`, which:

1. If nothing is listening yet, starts `gcloud beta emulators pubsub start` **in the background** (via `nohup`)
2. Waits until the emulator’s HTTP API responds
3. Writes `docs/jobs/scripts/.pubsub-emulator.pid` with the **process listening on the emulator port** (via `lsof`), so `dev:pubsub:emulator:stop` works even when the “emulator already up” path runs (no fresh `nohup` PID) or the PID file was deleted while the emulator kept running
4. Runs `docs/jobs/scripts/emulator-setup.sh` to create topics and subscriptions

The command **exits when setup finishes** so you can reuse the same terminal (for example for `npm run dev`). Emulator output is appended to `docs/jobs/scripts/.pubsub-emulator.log`.

If the emulator is **already** listening (for example you ran the command twice, or started `gcloud` by hand), the script skips starting a new process, **refreshes the PID file**, re-runs `emulator-setup.sh`, and exits.

Because the emulator is **in-memory**, every process restart clears topics and subscriptions — run `npm run dev:pubsub:emulator` again after stopping it, or rely on the “already listening” path to re-run setup only.

### Stop the emulator

```bash
npm run dev:pubsub:emulator:stop
```

This reads `.pubsub-emulator.pid` and stops that process. If there is no PID file, the command exits successfully — run `npm run dev:pubsub:emulator` once to recreate the PID file, or stop the listener on port `8085` manually if the emulator is still running.

### Step 2: Set Environment Variables

```bash
# Same or another terminal: set the emulator host
export PUBSUB_EMULATOR_HOST=localhost:8085
```

Or add the same line to `platform/scms/.env` (see `platform/scms/.env.sample`) so every `npm run dev` in that app picks it up without exporting manually.

Do not use a `VITE_` prefix: the Pub/Sub client reads the standard `PUBSUB_EMULATOR_HOST` name on the server, and this value should not be exposed to the browser.

**This is the only variable you need.** When set, the `@google-cloud/pubsub` Node.js client automatically routes all requests to the emulator. No credentials, no project ID configuration needed — the emulator ignores auth.

### Step 3: Topics and Subscriptions (usually automatic)

`npm run dev:pubsub:emulator` already runs `emulator-setup.sh`. Run it again by hand only if you changed `PORT` / push URLs and need to recreate subscriptions, or if you started the emulator without this npm script:

```bash
# From repo root (with PUBSUB_EMULATOR_HOST set)
bash docs/jobs/scripts/emulator-setup.sh
```

To delete and recreate everything **without** restarting the emulator (e.g. after changing `SCMS_PORT`), use:

```bash
bash docs/jobs/scripts/emulator-setup.sh --reset
```

`emulator-setup.sh` creates:

| Resource                         | Type              | Target                                    |
| -------------------------------- | ----------------- | ----------------------------------------- |
| `scmsJobDispatch`                | Topic             | —                                         |
| `scmsJobDispatch-deadletter`     | Topic             | —                                         |
| `scmsCheckTopic`                 | Topic             | —                                         |
| `scmsTaskConverterTopic`         | Topic             | —                                         |
| `scmsJobDispatch-sub`            | Push subscription | `http://127.0.0.1:3031/v1/jobs/dispatch`     |
| `scmsJobDispatch-deadletter-sub` | Push subscription | `http://127.0.0.1:3031/v1/jobs/dispatch/dlq` |
| `scmsCheckTopic-sub`             | Pull subscription | (for local check workers)                 |
| `scmsTaskConverterTopic-sub`     | Pull subscription | (for local converter workers)             |

### Step 4: Start the SCMS App

```bash
# From platform/scms, with PUBSUB_EMULATOR_HOST in the shell or in .env
npm run dev
```

The app detects `PUBSUB_EMULATOR_HOST` and routes all Pub/Sub publishing through the emulator. The emulator's push subscriptions deliver messages back to the app.

### Step 5: Test It

Trigger a job from the UI (e.g. export to PDF) or publish a test message:

```bash
# Publish a test message directly to the emulator
curl -s -X POST \
  "http://localhost:8085/v1/projects/curvenote-dev-1/topics/scmsJobDispatch:publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"messages\": [{
      \"attributes\": {
        \"handshake\": \"test-token\",
        \"job_type\": \"CHECK\"
      },
      \"data\": \"$(echo '{"job_id":"test-123","job_type":"CHECK","payload":{}}' | base64)\"
    }]
  }"
```

Watch the SCMS app logs — you should see the dispatch endpoint receive and process the message.

## How It Works

### Automatic Routing

The shared `sendJobPubSubMessage()` function handles all routing:

```
sendJobPubSubMessage()
  ├─ NODE_ENV=test              → return fake ID
  ├─ PUBSUB_EMULATOR_HOST set  → PubSub client (→ emulator)
  ├─ NODE_ENV=development       → HTTP stub POST to devLocalPush.url
  └─ otherwise                  → PubSub client (→ real GCP)
```

Each caller provides a `devLocalPush.url` for the HTTP stub path:

- Dispatch: `http://127.0.0.1:3031/v1/jobs/dispatch`
- Check service: `http://127.0.0.1:8080/`
- Converter service: `http://127.0.0.1:8080/`

When `PUBSUB_EMULATOR_HOST` is set, the `devLocalPush` is ignored — the PubSub client routes to the emulator, and the emulator's push subscription delivers to the same endpoints.

### Push Subscriptions on the Emulator

The emulator supports push subscriptions over HTTP (not HTTPS). When a message is published to a topic with a push subscription, the emulator:

1. Receives the publish request
2. Immediately POSTs the message to the push endpoint URL
3. If the endpoint returns 2xx, the message is acked
4. If non-2xx, the message is retried (with backoff)

**Limitation:** The emulator does not support dead letter routing (`--dead-letter-topic`). Messages that fail delivery are retried indefinitely. For testing dead letter behavior, use a real GCP Pub/Sub project.

### HTTP Stub vs Emulator

| Aspect                 | HTTP Stub (default dev)        | Emulator                              |
| ---------------------- | ------------------------------ | ------------------------------------- |
| `PUBSUB_EMULATOR_HOST` | Not set                        | `localhost:8085`                      |
| How it works           | `fetch()` directly to endpoint | Publish → emulator → push to endpoint |
| Retry behavior         | No retries (fire-and-forget)   | Emulator retries on non-2xx           |
| Dead letters           | Not tested                     | Not supported by emulator             |
| Latency                | Immediate                      | Small delay (emulator hop)            |
| Setup required         | None                           | Emulator (`npm run dev:pubsub:emulator` runs setup) |
| Credentials needed     | No                             | No (emulator ignores creds)           |

## Troubleshooting

### Emulator not receiving messages

- Confirm `PUBSUB_EMULATOR_HOST` is set in the terminal running the app: `echo $PUBSUB_EMULATOR_HOST`
- Confirm the emulator is running: `curl http://localhost:8085/v1/projects/curvenote-dev-1/topics`
- If you see `[dev local push]` in the logs, the HTTP stub is being used — `PUBSUB_EMULATOR_HOST` is not set

### Stop command does not match how I started the emulator

`dev:pubsub:emulator:stop` reads `docs/jobs/scripts/.pubsub-emulator.pid`. Each successful `npm run dev:pubsub:emulator` run refreshes that file (including the “emulator already up” path). If the file is missing while the emulator is still running, run `npm run dev:pubsub:emulator` once to recreate it, or stop the listener on port `8085` manually.

### Push subscription not delivering

- The SCMS app must be running before you publish (the emulator POSTs immediately)
- Check the push endpoint URL matches your app's port (`127.0.0.1:3031` by default in `emulator-setup.sh`; using `localhost` can fail: the Java emulator may connect to IPv6 `::1` while the dev server only listens on IPv4)
- If `.pubsub-emulator.log` shows `Failed to push ... Connection refused`, confirm SCMS is listening and re-run `bash docs/jobs/scripts/emulator-setup.sh --reset` after changing `PORT`
- Restart the emulator and run `npm run dev:pubsub:emulator` again, or run `bash docs/jobs/scripts/emulator-setup.sh` if the emulator is already running — subscriptions are lost when the emulator restarts (it's in-memory)

### "dispatchTopic must be set" error

In production mode, `dispatchTopic` and `dispatchSASecretKeyfile` must be set in the app config. In development or when using the emulator, dummy values are used automatically.

### Emulator state is lost on restart

The emulator stores everything in memory. After `npm run dev:pubsub:emulator:stop`, run `npm run dev:pubsub:emulator` again to get a fresh process and topics. If the emulator is still running and you only need to recreate subscriptions (for example you changed `PORT`), `npm run dev:pubsub:emulator` will detect the running emulator and run `emulator-setup.sh` only.

## Inspecting the emulator

There is no web UI. Use the [emulator REST API](https://cloud.google.com/pubsub/docs/reference/rest) (same shape as production) over HTTP.

Defaults below match the setup script: host `localhost:8085`, project `curvenote-dev-1`. Adjust `PUBSUB_EMULATOR_HOST` / `PUBSUB_PROJECT_ID` if you changed them.

**List topics**

```bash
curl -s "http://localhost:8085/v1/projects/curvenote-dev-1/topics"
```

**List subscriptions**

```bash
curl -s "http://localhost:8085/v1/projects/curvenote-dev-1/subscriptions"
```

**Get one topic or subscription**

```bash
curl -s "http://localhost:8085/v1/projects/curvenote-dev-1/topics/scmsJobDispatch"
curl -s "http://localhost:8085/v1/projects/curvenote-dev-1/subscriptions/scmsJobDispatch-sub"
```

Pipe through `jq` if you have it for readable JSON.

**Pull subscriptions** (`scmsCheckTopic-sub`, `scmsTaskConverterTopic-sub`) hold messages until a worker pulls them. **Push** subscriptions (`scmsJobDispatch-sub`) do not expose a queue in the API — delivery is an HTTP POST to your app; watch SCMS logs or the push endpoint.

**Health check**

```bash
curl -sf "http://localhost:8085/v1/projects/curvenote-dev-1/topics" >/dev/null && echo OK
```

## Reference

- [GCP Pub/Sub Emulator Docs](https://cloud.google.com/pubsub/docs/emulator)
- [Emulator REST API](https://cloud.google.com/pubsub/docs/reference/rest)
- `docs/jobs/scripts/start-pubsub-emulator.sh` — background emulator + setup (PID in `.pubsub-emulator.pid`, logs in `.pubsub-emulator.log`)
- `docs/jobs/scripts/stop-pubsub-emulator.sh` — stop emulator started by the script above
- `docs/jobs/scripts/emulator-setup.sh` — creates topics + subscriptions on the emulator
- `packages/scms-server/src/backend/jobs/scripts/pubsub-dispatch.sh` — creates topics + subscriptions on real GCP (production/staging)

npm scripts: `dev:pubsub:emulator`, `dev:pubsub:emulator:stop` (repo root and `platform/scms`).
