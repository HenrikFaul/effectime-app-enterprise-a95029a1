import { CatalogListEditor } from './CatalogListEditor';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export function JobFamilies({ workspaceId, isAdmin }: Props) {
  const t = useT();
  return (
    <CatalogListEditor
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      table="enterprise_job_families"
      description={t('organization.job_families.description')}
      addLabel={t('organization.job_families.add')}
    />
  );
}
