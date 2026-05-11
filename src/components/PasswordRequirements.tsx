import { Check, X } from 'lucide-react';
import { PasswordCheck } from '@/lib/passwordValidation';
import { useI18n } from '@/i18n/I18nProvider';

interface PasswordRequirementsProps {
  checks: PasswordCheck;
  show: boolean;
}

export function PasswordRequirements({ checks, show }: PasswordRequirementsProps) {
  const { t } = useI18n();

  const rules: { key: keyof PasswordCheck; label: string }[] = [
    { key: 'minLength', label: t('password_req.min_length') },
    { key: 'hasLower', label: t('password_req.has_lower') },
    { key: 'hasUpper', label: t('password_req.has_upper') },
    { key: 'hasNumber', label: t('password_req.has_number') },
    { key: 'hasSpecial', label: t('password_req.has_special') },
  ];

  if (!show) return null;

  return (
    <ul className="space-y-1 text-xs mt-2">
      {rules.map(({ key, label }) => (
        <li key={key} className="flex items-center gap-1.5">
          {checks[key] ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={checks[key] ? 'text-muted-foreground' : 'text-destructive'}>
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
