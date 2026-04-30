"use client";

import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { paiseToRupeesString, rupeesToPaise } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

export type MoneyInputProps = {
  value: number | null | undefined; // paise
  onChange: (paise: number | null) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaInvalid?: boolean;
};

/**
 * Rupee input bound to a paise value. Parses on blur (not per keystroke), so
 * users can freely type intermediate states like "4500." without thrashing.
 * Negative inputs are rejected; invalid input snaps back to the last valid value.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      value,
      onChange,
      onBlur,
      name,
      id,
      placeholder = "0.00",
      disabled,
      className,
      ariaInvalid,
    },
    ref,
  ) {
    const formatForDisplay = (v: number | null | undefined) =>
      v === null || v === undefined || v === 0 ? "" : paiseToRupeesString(v);

    const [text, setText] = useState(() => formatForDisplay(value));

    // Sync external value changes (e.g. form reset) back into the displayed text
    useEffect(() => {
      const next = formatForDisplay(value);
      setText((current) => {
        const currentPaise = rupeesToPaise(current);
        if (currentPaise === value) return current;
        if (current === "" && (value === null || value === undefined || value === 0)) {
          return current;
        }
        return next;
      });
    }, [value]);

    function handleBlur() {
      const paise = rupeesToPaise(text);
      if (paise === null) {
        setText(formatForDisplay(value));
      } else {
        setText(formatForDisplay(paise));
        if (paise !== value) onChange(paise);
      }
      onBlur?.();
    }

    return (
      <div className={cn("relative", className)}>
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
          ₹
        </span>
        <Input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={handleBlur}
          className="pl-7"
        />
      </div>
    );
  },
);
