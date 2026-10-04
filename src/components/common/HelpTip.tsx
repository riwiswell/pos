import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HELP } from "@/domain/help";
import { useHelpEnabled } from "@/hooks/use-help";

/** ⓘ icon with a short explanation. Hidden when contextual help is disabled globally. */
export function HelpTip({ helpKey, text }: { helpKey: string; text?: string }) {
  const enabled = useHelpEnabled();
  const entry = HELP[helpKey];
  if (!enabled || (!entry && !text)) return null;
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`Ayuda: ${entry?.title ?? "¿Qué es esto?"}`}
        data-help-tip={helpKey}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <Info className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" side="top">
        <p className="font-medium">{entry?.title ?? "¿Qué es esto?"}</p>
        <p className="mt-1 text-muted-foreground">{text ?? entry?.description}</p>
      </PopoverContent>
    </Popover>
  );
}