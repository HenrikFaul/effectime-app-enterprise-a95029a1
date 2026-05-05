import { useI18n } from '@/i18n/I18nProvider';
import { LOCALE_LABEL, SUPPORTED_LOCALES, type Locale } from '@/i18n/locales';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface Props {
  size?: 'sm' | 'default';
  align?: 'start' | 'center' | 'end';
}

export function LanguageSelector({ size = 'sm', align = 'end' }: Props) {
  const { locale, setLocale, t } = useI18n();
  const current = LOCALE_LABEL[locale];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className="h-9 w-9 rounded-full p-0 text-base shadow-sm ring-1 ring-border hover:bg-accent"
          aria-label={`${t('header.language')}: ${current.english}`}
          title={`${t('header.language')}: ${current.native}`}
        >
          <span className="text-lg leading-none" aria-hidden>
            {current.flag}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[10rem]">
        <DropdownMenuLabel>{t('header.select_language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((l: Locale) => {
          const meta = LOCALE_LABEL[l];
          const active = l === locale;
          return (
            <DropdownMenuItem
              key={l}
              onSelect={() => setLocale(l)}
              className="flex items-center gap-2"
              aria-checked={active}
            >
              <span aria-hidden>{meta.flag}</span>
              <span className="flex-1">{meta.native}</span>
              {active ? <Check className="h-4 w-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
