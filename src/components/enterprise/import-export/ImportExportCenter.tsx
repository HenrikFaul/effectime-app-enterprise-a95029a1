import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EntitySelector } from './EntitySelector';
import { ExportWizard } from './ExportWizard';
import { ImportWizard } from './ImportWizard';
import { getEntityConfig } from './config/entity-registry';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  canImport: boolean;
}

type ActionMode = 'export' | 'import';

export function ImportExportCenter({ workspaceId, userId, isAdmin, canImport }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<ActionMode>('export');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const importUnavailableDescriptionId = useId();
  const exportModeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreExportFocusOnCloseRef = useRef(false);

  const entity = selectedEntity ? getEntityConfig(selectedEntity) : null;

  useEffect(() => {
    if (canImport || mode !== 'import') return;

    restoreExportFocusOnCloseRef.current = dialogOpen;
    setMode('export');
    setDialogOpen(false);
    setSelectedEntity(null);
  }, [canImport, dialogOpen, mode]);

  if (!isAdmin) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        {t('import_export.access_restricted')}
      </div>
    );
  }

  const openWizard = () => {
    if (!entity) return;
    if (mode === 'import' && !canImport) return;
    setDialogOpen(true);
  };

  const closeWizard = () => {
    setDialogOpen(false);
    setSelectedEntity(null);
  };

  return (
    <div className="space-y-3">
      {/* Action selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          ref={exportModeButtonRef}
          type="button"
          onClick={() => setMode('export')}
          aria-pressed={mode === 'export'}
          className={cn(
            'rounded-md border p-3 text-left transition flex items-center gap-3',
            mode === 'export' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-accent/30'
          )}
        >
          <div className={cn('rounded-md p-2', mode === 'export' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <ArrowDown className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Export</p>
            <p className="text-[11px] text-muted-foreground">{t('import_export.export_description')}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => canImport && setMode('import')}
          disabled={!canImport}
          aria-pressed={mode === 'import'}
          aria-describedby={!canImport ? importUnavailableDescriptionId : undefined}
          className={cn(
            'rounded-md border p-3 text-left transition flex items-center gap-3',
            mode === 'import'
              ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
              : canImport
                ? 'hover:bg-accent/30'
                : 'cursor-not-allowed opacity-60',
          )}
        >
          <div className={cn('rounded-md p-2', mode === 'import' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <ArrowUp className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Import</p>
            <p
              id={!canImport ? importUnavailableDescriptionId : undefined}
              className="text-[11px] text-muted-foreground"
            >
              {canImport
                ? t('import_export.import_description')
                : t('feature_gate.locked_desc', { feature: t('features.csv_import.name') })}
            </p>
          </div>
        </button>
      </div>

      {/* Entity selector */}
      <div>
        <p className="text-xs font-medium mb-2">{t('import_export.select_entity')}</p>
        <EntitySelector mode={mode} selected={selectedEntity} onSelect={setSelectedEntity} />
      </div>

      {/* Continue button */}
      <div className="flex justify-end pt-2 border-t">
        <Button type="button" size="sm" onClick={openWizard} disabled={!selectedEntity}>
          {t('import_export.continue_btn')}
        </Button>
      </div>

      {/* Wizard Dialog */}
      <Dialog open={dialogOpen && (mode === 'export' || canImport)} onOpenChange={(o) => { if (!o) closeWizard(); }}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            if (!restoreExportFocusOnCloseRef.current) return;

            event.preventDefault();
            restoreExportFocusOnCloseRef.current = false;
            exportModeButtonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {entity && <entity.icon className="h-4 w-4" />}
              {mode === 'export' ? 'Export' : 'Import'} — {entity?.label}
            </DialogTitle>
          </DialogHeader>
          {entity && mode === 'export' && (
            <ExportWizard entity={entity} workspaceId={workspaceId} userId={userId} onClose={closeWizard} />
          )}
          {entity && mode === 'import' && canImport && (
            <ImportWizard entity={entity} workspaceId={workspaceId} userId={userId} onClose={closeWizard} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
