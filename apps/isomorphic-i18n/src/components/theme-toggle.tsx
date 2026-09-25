import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useTheme } from "@/components/theme-provider";
import { useT } from "@/i18n/use-lang";

/** Light/dark switch; the icons swap with the `dark` class CSS. */
export function ThemeToggle() {
  const { t } = useT();
  const { theme, setTheme } = useTheme();
  const label = t("text-toggle-theme");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
        }
      >
        <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
