import * as React from 'react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollapsibleCardTriggerProps {
  /** Accessible trigger name; include visible count/status context when it changes the card's meaning. */
  label: string;
  /** Static visual content only. The native overlay button intentionally owns all pointer interaction. */
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const CollapsibleCardTrigger = React.forwardRef<HTMLButtonElement, CollapsibleCardTriggerProps>(
  ({ label, children, className, contentClassName }, ref) => (
    <Card className={cn('relative', className)}>
      <CardContent aria-hidden="true" className={contentClassName}>{children}</CardContent>
      <CollapsibleTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
      </CollapsibleTrigger>
    </Card>
  ),
);

CollapsibleCardTrigger.displayName = 'CollapsibleCardTrigger';

export { CollapsibleCardTrigger };
