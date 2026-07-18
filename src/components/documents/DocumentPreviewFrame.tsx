import { useMemo } from 'react';
import { buildDocumentPreviewSrcDoc } from '@/lib/documentPreview';

interface DocumentPreviewFrameProps {
  untrustedHtml: string;
  title: string;
}

export function DocumentPreviewFrame({ untrustedHtml, title }: DocumentPreviewFrameProps) {
  const srcDoc = useMemo(
    () => buildDocumentPreviewSrcDoc(untrustedHtml),
    [untrustedHtml],
  );

  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      // Empty sandbox means no scripts, same-origin access, forms, popups,
      // downloads, or parent/top navigation are granted to stored HTML.
      sandbox=""
      referrerPolicy="no-referrer"
      className="h-[32rem] w-full rounded border bg-white"
    />
  );
}
