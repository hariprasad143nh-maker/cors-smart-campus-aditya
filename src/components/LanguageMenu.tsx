import { Check, Languages, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LANGUAGE_LABELS, useI18n, type Language } from '@/lib/i18n';

interface LanguageMenuProps {
  className?: string;
}

export function LanguageMenu({ className }: LanguageMenuProps) {
  const { lang, setLang, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-10 max-w-full shrink gap-1.5 px-2.5 ${className ?? ''}`}
          aria-label={t('lang.select')}
        >
          <Languages className="w-4 h-4 shrink-0" />
          <span className="truncate text-xs font-medium">{t('lang.select')}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Languages className="w-4 h-4" />
          {t('lang.select')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLang(code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{LANGUAGE_LABELS[code]}</span>
            {lang === code && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
