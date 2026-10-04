import { forwardRef } from "react";

import { Input } from "@/components/ui/input";
import { formatAmountInput, parseAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}

/** Numeric, mobile-first money field. Digits only, grouped while typing. */
export const AmountInput = forwardRef<HTMLInputElement, Props>(function AmountInput(
  { value, onChange, className, placeholder = "0", autoFocus, onEnter },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
        $
      </span>
      <Input
        ref={ref}
        autoFocus={autoFocus}
        inputMode="numeric"
        value={value ? formatAmountInput(String(value)) : ""}
        placeholder={placeholder}
        onChange={(event) => onChange(parseAmountInput(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        className="h-14 pl-8 text-2xl font-semibold tabular-nums"
      />
    </div>
  );
});