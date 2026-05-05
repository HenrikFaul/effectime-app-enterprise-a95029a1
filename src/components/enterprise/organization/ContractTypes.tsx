import { CatalogListEditor } from './CatalogListEditor';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export function ContractTypes({ workspaceId, isAdmin }: Props) {
  const t = useT();
  return (
    <CatalogListEditor
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      table="enterprise_contract_types"
      seedRpc="seed_default_contract_types"
      description={t('organization.contracts.description')}
      addLabel={t('organization.contracts.add_type')}
    />
  );
}
