import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyTransactionalEmailResult,
  summarizeDeliveryOutcomes,
  type DeliveryOutcome,
} from '../../supabase/functions/send-scheduled-reports/delivery-result';

const delivered: DeliveryOutcome = { type: 'delivered' };
const suppressed: DeliveryOutcome = { type: 'suppressed', reason: 'email_suppressed' };
const failed: DeliveryOutcome = { type: 'failed', reason: 'provider_error' };

describe('scheduled report recipient result classification', () => {
  it('requires both HTTP success and payload success=true for delivery', () => {
    expect(classifyTransactionalEmailResult(true, 200, { success: true, queued: true }))
      .toEqual(delivered);
    expect(classifyTransactionalEmailResult(true, 200, { queued: true }))
      .toEqual({ type: 'failed', reason: 'invalid_success_response' });
    expect(classifyTransactionalEmailResult(false, 500, { success: true }))
      .toEqual({ type: 'failed', reason: 'http_500' });
  });

  it('classifies the HTTP 200 email_suppressed contract as non-delivery', () => {
    expect(classifyTransactionalEmailResult(true, 200, {
      success: false,
      reason: 'email_suppressed',
    })).toEqual(suppressed);
  });

  it('keeps other business failures separate from suppression', () => {
    expect(classifyTransactionalEmailResult(true, 200, {
      success: false,
      reason: 'template_rejected',
    })).toEqual({ type: 'failed', reason: 'template_rejected' });
  });
});

describe('scheduled report run delivery summary', () => {
  it.each([
    [[], 0, 'skipped', 0, 0, 0],
    [[delivered, delivered], 2, 'success', 2, 0, 0],
    [[suppressed, suppressed], 2, 'skipped', 0, 2, 0],
    [[delivered, suppressed], 2, 'partial_delivery', 1, 1, 0],
    [[delivered, failed], 2, 'partial_failure', 1, 0, 1],
    [[suppressed, failed], 2, 'error', 0, 1, 1],
    [[failed, failed], 2, 'error', 0, 0, 2],
  ] as const)(
    'summarizes recipients=%d as %s without false success',
    (outcomes, recipients, status, deliveredCount, suppressedCount, failedCount) => {
      const summary = summarizeDeliveryOutcomes([...outcomes], recipients);
      expect(summary).toMatchObject({
        status,
        delivered: deliveredCount,
        suppressed: suppressedCount,
        failed: failedCount,
      });
      if (deliveredCount === 0) expect(summary.status).not.toBe('success');
    },
  );
});

describe('send-scheduled-reports integration invariant', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', 'supabase', 'functions', 'send-scheduled-reports', 'index.ts'),
    'utf8',
  );

  it('parses the transactional response body and persists the business summary', () => {
    expect(source).toContain('sendPayload = await sendRes.json()');
    expect(source).toContain(
      'classifyTransactionalEmailResult(sendRes.ok, sendRes.status, sendPayload)',
    );
    expect(source).toContain('summarizeDeliveryOutcomes(outcomes, recipients.length)');
    expect(source).toContain('await markRun(admin, sch.id, summary.status, summary.context)');
    expect(source).toContain('delivered: summary.delivered');
    expect(source).toContain('suppressed: summary.suppressed');
  });
});
