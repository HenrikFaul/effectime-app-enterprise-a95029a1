import { createBoundedFetch } from "./bounded-fetch.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("bounded fetch rejects an exhausted total deadline before network access", async () => {
  let fetchCalls = 0;
  const boundedFetch = createBoundedFetch({
    deadlineAt: 99,
    operationTimeoutMs: 10,
    now: () => 100,
    fetchImplementation: async () => {
      fetchCalls += 1;
      return new Response(null, { status: 204 });
    },
  });

  let rejected = false;
  try {
    await boundedFetch("https://abcdefghijklmnopqrst.supabase.co/rest/v1/test");
  } catch (error) {
    rejected = error instanceof DOMException && error.name === "TimeoutError";
  }
  assert(rejected, "Exhausted deadline was not rejected");
  assert(fetchCalls === 0, "Network access happened after the total deadline");
});

Deno.test("bounded fetch aborts an in-flight operation at the per-call limit", async () => {
  let observedAbort = false;
  const boundedFetch = createBoundedFetch({
    deadlineAt: Date.now() + 1_000,
    operationTimeoutMs: 20,
    fetchImplementation: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          observedAbort = true;
          reject(init.signal?.reason);
        }, { once: true });
      }),
  });

  let rejected = false;
  try {
    await boundedFetch(
      "https://abcdefghijklmnopqrst.supabase.co/auth/v1/admin/users",
    );
  } catch (error) {
    rejected = error instanceof DOMException && error.name === "TimeoutError";
  }
  assert(rejected, "Per-call timeout did not reject the request");
  assert(observedAbort, "Underlying fetch did not receive an abort signal");
});

Deno.test("bounded fetch preserves an inherited abort signal", async () => {
  const inherited = new AbortController();
  const boundedFetch = createBoundedFetch({
    deadlineAt: Date.now() + 1_000,
    operationTimeoutMs: 500,
    fetchImplementation: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      }),
  });

  const request = boundedFetch(
    "https://abcdefghijklmnopqrst.supabase.co/rest/v1/test",
    { signal: inherited.signal },
  );
  inherited.abort(new DOMException("caller aborted", "AbortError"));

  let rejected = false;
  try {
    await request;
  } catch (error) {
    rejected = error instanceof DOMException && error.name === "AbortError";
  }
  assert(rejected, "Inherited abort did not cancel the request");
});
