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
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-4 text-base leading-6"
        side="top"
      >
        <p className="text-sm font-semibold leading-5">
          {entry?.title ?? "¿Qué es esto?"}
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/85">
          {text ?? entry?.description}
        </p>
      </PopoverContent>
    </Popover>
  );
}