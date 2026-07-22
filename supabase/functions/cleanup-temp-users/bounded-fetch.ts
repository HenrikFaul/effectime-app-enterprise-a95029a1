export function createBoundedFetch(options: {
  deadlineAt: number;
  operationTimeoutMs: number;
  now?: () => number;
  fetchImplementation?: typeof fetch;
}): typeof fetch {
  const now = options.now ?? Date.now;
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const remaining = options.deadlineAt - now();
    if (remaining <= 0) {
      throw new DOMException("Request deadline exceeded", "TimeoutError");
    }

    const controller = new AbortController();
    const inheritedSignal = init?.signal;
    const abortFromInheritedSignal = () =>
      controller.abort(inheritedSignal?.reason);
    if (inheritedSignal?.aborted) abortFromInheritedSignal();
    else {
      inheritedSignal?.addEventListener("abort", abortFromInheritedSignal, {
        once: true,
      });
    }

    const timeout = setTimeout(
      () =>
        controller.abort(new DOMException("Request timed out", "TimeoutError")),
      Math.min(options.operationTimeoutMs, remaining),
    );
    try {
      return await fetchImplementation(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      inheritedSignal?.removeEventListener("abort", abortFromInheritedSignal);
    }
  };
}
