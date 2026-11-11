# GitCourt native interoperability case

This small, manually prepared implementation qualifies the real GenLayer-to-Arkhai settlement path. It does not demonstrate autonomous code generation. The subsequent GitCourt worker milestone supplies runtime tasks and agent-created code.

`createReceiver({secret,onEvent,maxDeliveries})` returns an asynchronous function taking `{deliveryId,signature,rawBody}`. Supply the original raw body as a Buffer, the GitHub X-GitHub-Delivery identifier, and X-Hub-Signature-256 value. Configure the secret outside repository code. Authenticate raw bytes before parsing JSON. The wrapper returns a status object; an HTTP adapter must send its status and JSON response.

Valid deliveries call `onEvent` once while retained. A completed duplicate returns 200 without a second callback; an in-flight duplicate returns 202. Reusing a delivery ID with different authenticated bytes returns 409. An absent, null or empty signature is a missing field and returns 400; a nonempty malformed or incorrect signature returns 401. Other missing required fields or malformed JSON return 400, and processing failure returns 503 so the delivery can retry.

Retention is bounded and process-local. Completed entries are evicted at capacity, and all entries disappear on restart. Consequently a previously completed delivery may run again after eviction or restart. This wrapper provides no durable exactly-once guarantee. Use a transactional persistent delivery ledger and idempotent side effects before relying on it across restarts or multiple replicas. If every retained entry is in flight, capacity exhaustion returns 503.

Run `node --test webhook.test.mjs` with Node 24. No external packages or network are required. The tests cover authentication, duplicate and concurrent delivery, conflict detection, retryable failure, malformed JSON and eviction behavior. Test secrets are fixtures, never production credentials.

The eight buyer tests remain frozen at commit `124687ed293149ed97ced4dc2c84adee8243ded6`. The baseline transcript in `logs/test-results.txt` predates this repair. Each fulfillment's immutable verifier evidence records its own source commit, frozen test commit, test-file hash and fresh execution results. Supplemental verifier probes check missing signatures and all-in-flight capacity; they do not replace or alter the buyer's harness.
