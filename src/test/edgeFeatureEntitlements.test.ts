import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function edgeFunctionSource(name: string): string {
  return readFileSync(
    resolve(process.cwd(), 'supabase', 'functions', name, 'index.ts'),
    'utf8',
  );
}

describe('paid Edge Function entitlement boundaries', () => {
  it('enforces ai_copilot_chat after caller authorization and before rate limiting or AI work', () => {
    const source = edgeFunctionSource('ai-copilot');
    const authorization = source.indexOf('if (!membershipResult.data || !conversationResult.data)');
    const entitlement = source.indexOf(
      'checkWorkspaceFeature(admin, workspace_id, "ai_copilot_chat")',
    );
    const rateLimit = source.indexOf('if (!await consumeRateLimit');

    expect(authorization).toBeGreaterThan(-1);
    expect(entitlement).toBeGreaterThan(authorization);
    expect(entitlement).toBeLessThan(rateLimit);
    expect(source).toContain('entitlement.reason === "lookup_error"');
    expect(source).toContain('AbortSignal.timeout(30_000)');
    expect(source).not.toContain('checkWorkspaceFeature(admin, workspace_id, "ai_smart_schedule")');
  });

  it('limits document polishing to the creator or workspace admins and enforces document_generator', () => {
    const source = edgeFunctionSource('document-ai-polish');
    const membership = source.indexOf('.from("enterprise_memberships")');
    const ownership = source.indexOf('generatedBy === user.id');
    const entitlement = source.indexOf(
      'checkWorkspaceFeature(admin, workspaceId, "document_generator")',
    );
    const externalAi = source.indexOf('if (!ANTHROPIC_API_KEY)');

    expect(source).toContain('content_html, doc_type, generated_by');
    expect(source).toContain('["owner", "resourceAssistant"].includes(role)');
    expect(source).toContain('req.method !== "POST"');
    expect(source).toContain('MAX_INSTRUCTION_LENGTH');
    expect(source).toContain('MAX_DOCUMENT_HTML_LENGTH');
    expect(source).toContain('AbortSignal.timeout(30_000)');
    expect(membership).toBeGreaterThan(-1);
    expect(ownership).toBeGreaterThan(membership);
    expect(entitlement).toBeGreaterThan(ownership);
    expect(entitlement).toBeLessThan(externalAi);
    expect(source).toMatch(
      /\.update\(\{ content_html: polishedHtml \}\)[\s\S]*?\.eq\("id", document_id\)[\s\S]*?\.eq\("workspace_id", workspaceId\)/,
    );
  });

  it('enforces open_api for every authenticated public API request before usage is reserved', () => {
    const source = edgeFunctionSource('public-api');
    const validKey = source.indexOf('if (!keyRow || !isApiKeyActive(keyRow))');
    const entitlement = source.indexOf(
      'checkWorkspaceFeature(admin, workspaceId, "open_api")',
    );
    const usageReservation = source.indexOf('await reserveUsageLog');

    expect(validKey).toBeGreaterThan(-1);
    expect(entitlement).toBeGreaterThan(validKey);
    expect(entitlement).toBeLessThan(usageReservation);
    expect(source).toContain('return jsonRes({ error: "Forbidden", request_id: requestId }, 403');
    expect(source).toContain('entitlement.reason === "lookup_error"');
  });

  it('checks open_api before each webhook claim and leaves disabled deliveries untouched', () => {
    const source = edgeFunctionSource('webhook-dispatcher');
    const deliveryLoop = source.indexOf('for (const delivery of deliveries)');
    const entitlement = source.indexOf(
      'checkWorkspaceFeature(admin, delivery.workspace_id, "open_api")',
    );
    const claim = source.indexOf('const claimToken = createDeliveryClaim()');

    expect(deliveryLoop).toBeGreaterThan(-1);
    expect(entitlement).toBeGreaterThan(deliveryLoop);
    expect(entitlement).toBeLessThan(claim);
    expect(source.slice(entitlement, claim)).toContain('skipped += 1');
    expect(source.slice(entitlement, claim)).toContain('continue');
    expect(source).not.toContain('.delete(');
  });

  it('enforces ms365_calendar_sync before OAuth, sync, status, and scheduled work', () => {
    const source = edgeFunctionSource('ms365-sync');
    const centralCheck = source.indexOf(
      'checkWorkspaceFeature(admin, workspaceId, M365_FEATURE_KEY)',
    );
    const tokenRefresh = source.indexOf('const token = await ensureFreshToken(integration)');
    const callbackExchange = source.indexOf('const tokens = await exchangeCode(code)');

    expect(source).toContain('const M365_FEATURE_KEY = "ms365_calendar_sync"');
    expect(centralCheck).toBeGreaterThan(-1);
    expect(source).toContain('await checkM365Entitlement(workspace_id)');
    expect(source).toContain('await checkM365Entitlement(stateRow.workspace_id)');
    expect(source).toContain('await checkM365Entitlement(integration.workspace_id)');
    expect(source).toContain('return jsonResponse(result, result.entitlementStatus ?? 200)');
    expect(source).toContain('else if (r.entitlementStatus === 403) skipped++');
    expect(source.indexOf('const featureFailure = await checkM365Entitlement(integration.workspace_id)'))
      .toBeLessThan(tokenRefresh);
    expect(source.indexOf('const featureFailure = await checkM365Entitlement(stateRow.workspace_id)'))
      .toBeLessThan(callbackExchange);
    expect(source).toContain('featureFailure?.status === 503');
  });
});
