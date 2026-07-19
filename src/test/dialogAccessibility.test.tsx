import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function DialogHarness({ closeDisabled = false }: { closeDisabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
        Open admin dialog
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          closeLabel="Bezárás"
          closeDisabled={closeDisabled}
          onEscapeKeyDown={(event) => {
            if (closeDisabled) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (closeDisabled) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            const opener = openerRef.current;
            if (opener?.isConnected && !opener.disabled) {
              event.preventDefault();
              opener.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Admin override</DialogTitle>
          </DialogHeader>
          <p>Dialog body</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('shared dialog accessibility contract', () => {
  it('uses a localized close name and restores focus to an external opener', async () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Open admin dialog' });
    fireEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Admin override' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    fireEvent.click(screen.getByRole('button', { name: 'Bezárás' }));

    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: 'Admin override' })).not.toBeInTheDocument();
  });

  it('renders the close control as natively disabled when requested', async () => {
    const view = render(<DialogHarness closeDisabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Open admin dialog' }));

    const closeButton = await screen.findByRole('button', { name: 'Bezárás' });
    expect(closeButton).toBeDisabled();
    fireEvent.click(closeButton);
    expect(screen.getByRole('dialog', { name: 'Admin override' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Admin override' })).toBeInTheDocument();

    view.rerender(<DialogHarness closeDisabled={false} />);
    expect(screen.getByRole('button', { name: 'Bezárás' })).toBeEnabled();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', {
      name: 'Admin override',
    })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', {
      name: 'Open admin dialog',
    })).toHaveFocus());
  });

  it('keeps the default English close name for existing callers', async () => {
    render(
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent>
          <DialogTitle>Existing dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(await screen.findByRole('button', { name: 'Close' })).toBeEnabled();
  });

  it('prevents outside pointer dismissal while locked and permits it after unlocking', async () => {
    const view = render(<DialogHarness closeDisabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Open admin dialog' }));
    expect(await screen.findByRole('dialog', { name: 'Admin override' })).toBeInTheDocument();

    fireEvent.pointerDown(document.body, { button: 0, pointerType: 'mouse' });
    expect(screen.getByRole('dialog', { name: 'Admin override' })).toBeInTheDocument();

    view.rerender(<DialogHarness closeDisabled={false} />);
    fireEvent.pointerDown(document.body, { button: 0, pointerType: 'mouse' });
    await waitFor(() => expect(screen.queryByRole('dialog', {
      name: 'Admin override',
    })).not.toBeInTheDocument());
  });
});
