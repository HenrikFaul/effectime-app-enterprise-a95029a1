import { CatalogListEditor } from './CatalogListEditor';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export function LeadershipLevels({ workspaceId, isAdmin }: Props) {
  const t = useT();
  return (
    <CatalogListEditor
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      table="enterprise_leadership_levels"
      seedRpc="seed_default_leadership_levels"
      description={t('organization.leadership.description')}
      addLabel={t('organization.leadership.add_level')}
    />
  );
}
