import { LanguagesIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { LANGUAGE_NAMES, languages } from "@/i18n/settings";
import { useAppRoute, useT } from "@/i18n/use-lang";

export function LanguageMenu() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const route = useAppRoute();
  const { search } = useLocation();

  if (languages.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={t("text-language")} />}>
        <LanguagesIcon data-icon="inline-start" />
        {lang.toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("text-language")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={lang} onValueChange={(value) => navigate(`/${value}${route === "/" ? "" : route}${search}`)}>
            {languages.map((code) => (
              <DropdownMenuRadioItem key={code} value={code}>
                {LANGUAGE_NAMES[code] ?? code}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
