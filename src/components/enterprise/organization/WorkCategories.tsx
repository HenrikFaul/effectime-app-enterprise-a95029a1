import { CatalogListEditor } from './CatalogListEditor';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export function WorkCategories({ workspaceId, isAdmin }: Props) {
  const t = useT();
  return (
    <CatalogListEditor
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      table="enterprise_work_categories"
      description={t('organization.categories.description')}
      addLabel={t('organization.categories.add')}
    />
  );
}
