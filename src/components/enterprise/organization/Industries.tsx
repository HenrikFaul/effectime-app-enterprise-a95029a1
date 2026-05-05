import { CatalogListEditor } from './CatalogListEditor';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export function Industries({ workspaceId, isAdmin }: Props) {
  const t = useT();
  return (
    <CatalogListEditor
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      table="enterprise_industries"
      description={t('organization.industry.description')}
      addLabel={t('organization.industry.add')}
    />
  );
}
