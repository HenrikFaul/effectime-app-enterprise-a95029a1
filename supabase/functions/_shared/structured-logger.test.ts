import {
  createStructuredLogger,
  type LogSink,
  REDACTED_EMAIL,
  REDACTED_VALUE,
} from "./structured-logger.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("structured logger redacts email, bearer tokens and sensitive keys", () => {
  const entries: string[] = [];
  const sink: LogSink = {
    debug: (entry) => entries.push(entry),
    info: (entry) => entries.push(entry),
    warn: (entry) => entries.push(entry),
    error: (entry) => entries.push(entry),
  };
  const logger = createStructuredLogger({
    service: "redaction-test",
    now: () => new Date("2026-07-17T12:00:00.000Z"),
    sink,
  });

  const written = logger.info("email_enqueued", {
    templateName: "enterprise-invite",
    email: "person@example.com",
    header: "Bearer bearer-secret-value",
    nested: {
      authorization: "Bearer second-secret-value",
      apiKey: "api-secret-value",
      secretKey: "super-secret-value",
      privateKey: "private-key-value",
      note: "Notify backup@example.net when complete",
      unicode: "árvíztűrő@example.hu",
      serialized: '{"password":"raw-password","safe":"retained"}',
      transportHeader: "Cookie: session=raw-session-secret; theme=dark",
    },
  });

  assert(written, "The log entry should be written");
  assert(entries.length === 1, "Exactly one entry should be emitted");
  assert(!entries[0].includes("person@example.com"), "Raw email leaked into the log");
  assert(!entries[0].includes("backup@example.net"), "Nested email leaked into the log");
  assert(!entries[0].includes("bearer-secret-value"), "Bearer token leaked into the log");
  assert(!entries[0].includes("second-secret-value"), "Authorization leaked into the log");
  assert(!entries[0].includes("api-secret-value"), "Sensitive key value leaked into the log");
  assert(!entries[0].includes("super-secret-value"), "Secret key value leaked into the log");
  assert(!entries[0].includes("private-key-value"), "Private key value leaked into the log");
  assert(!entries[0].includes("árvíztűrő@example.hu"), "Unicode email leaked into the log");
  assert(!entries[0].includes("raw-password"), "Serialized password leaked into the log");
  assert(!entries[0].includes("raw-session-secret"), "Cookie session leaked into the log");

  const parsed = JSON.parse(entries[0]);
  assert(parsed.timestamp === "2026-07-17T12:00:00.000Z", "Timestamp is not deterministic");
  assert(parsed.level === "info", "Unexpected log level");
  assert(parsed.service === "redaction-test", "Unexpected service");
  assert(parsed.event === "email_enqueued", "Unexpected event");
  assert(parsed.context.templateName === "enterprise-invite", "Safe context was removed");
  assert(parsed.context.email === REDACTED_VALUE, "Email key was not redacted");
  assert(parsed.context.header === `Bearer ${REDACTED_VALUE}`, "Bearer token was not redacted");
  assert(
    parsed.context.nested.authorization === REDACTED_VALUE,
    "Authorization key was not redacted",
  );
  assert(parsed.context.nested.apiKey === REDACTED_VALUE, "API key was not redacted");
  assert(parsed.context.nested.secretKey === REDACTED_VALUE, "Secret key was not redacted");
  assert(parsed.context.nested.privateKey === REDACTED_VALUE, "Private key was not redacted");
  assert(
    parsed.context.nested.note === `Notify ${REDACTED_EMAIL} when complete`,
    "Email embedded in text was not redacted",
  );
  assert(parsed.context.nested.unicode === REDACTED_EMAIL, "Unicode email was not fully redacted");
  assert(
    parsed.context.nested.serialized === `{"password":"${REDACTED_VALUE}","safe":"retained"}`,
    "Serialized JSON secret was not redacted",
  );
  assert(
    parsed.context.nested.transportHeader === `Cookie: ${REDACTED_VALUE}`,
    "Cookie header was not redacted",
  );
});

Deno.test("structured logger never throws when a sink fails", () => {
  const fail = () => {
    throw new Error("sink unavailable");
  };
  const logger = createStructuredLogger({
    service: "redaction-test",
    now: () => new Date("2026-07-17T12:00:00.000Z"),
    sink: { debug: fail, info: fail, warn: fail, error: fail },
  });

  assert(
    logger.error("sink_failure", { password: "must-not-fallback" }) === false,
    "Sink failure should be reported",
  );
});
