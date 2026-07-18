export type DeliveryOutcome =
  | { type: 'delivered' }
  | { type: 'suppressed'; reason: 'email_suppressed' }
  | { type: 'failed'; reason: string };

export interface DeliverySummary {
  status: 'success' | 'skipped' | 'error' | 'partial_failure' | 'partial_delivery';
  delivered: number;
  suppressed: number;
  failed: number;
  context: string | null;
}

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
}

export function classifyTransactionalEmailResult(
  httpOk: boolean,
  httpStatus: number,
  payload: unknown,
): DeliveryOutcome {
  const record = payloadRecord(payload);
  if (httpOk && record?.success === true) return { type: 'delivered' };
  if (httpOk && record?.success === false && record.reason === 'email_suppressed') {
    return { type: 'suppressed', reason: 'email_suppressed' };
  }

  const payloadReason = typeof record?.reason === 'string'
    ? record.reason
    : typeof record?.error === 'string'
      ? record.error
      : null;
  return {
    type: 'failed',
    reason: payloadReason || (httpOk ? 'invalid_success_response' : `http_${httpStatus}`),
  };
}

export function summarizeDeliveryOutcomes(
  outcomes: DeliveryOutcome[],
  recipients: number,
): DeliverySummary {
  const delivered = outcomes.filter((outcome) => outcome.type === 'delivered').length;
  const suppressed = outcomes.filter((outcome) => outcome.type === 'suppressed').length;
  const failed = outcomes.filter((outcome) => outcome.type === 'failed').length;

  if (recipients === 0) {
    return {
      status: 'skipped',
      delivered,
      suppressed,
      failed,
      context: 'No report recipients configured',
    };
  }
  if (delivered === recipients) {
    return { status: 'success', delivered, suppressed, failed, context: null };
  }

  const context = `Delivered ${delivered}/${recipients}; suppressed ${suppressed}; failed ${failed}`;
  if (delivered === 0 && failed === 0) {
    return { status: 'skipped', delivered, suppressed, failed, context };
  }
  if (delivered === 0) {
    return { status: 'error', delivered, suppressed, failed, context };
  }
  return {
    status: failed > 0 ? 'partial_failure' : 'partial_delivery',
    delivered,
    suppressed,
    failed,
    context,
  };
}
