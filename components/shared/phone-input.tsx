"use client";

import { forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatPhoneForDisplay, normalizeIndianPhone } from "@/lib/utils/phone";
import { cn } from "@/lib/utils";

export type PhoneInputProps = {
  value: string;
  onChange: (next: string) => void;
  onBlur?: (normalised: string | null) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  ariaInvalid?: boolean;
};

/**
 * Free-form phone input. Stores the raw user text; on blur tries to normalise
 * and surface the preview via the optional onBlur(normalised) callback.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      onBlur,
      name,
      id,
      placeholder = "98765 43210",
      disabled,
      className,
      autoFocus,
      ariaInvalid,
    },
    ref,
  ) {
    const [hint, setHint] = useState<string | null>(() => {
      const n = normalizeIndianPhone(value);
      return n ? formatPhoneForDisplay(n) : null;
    });

    return (
      <div className={cn("space-y-1.5", className)}>
        <Input
          ref={ref}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={ariaInvalid}
          value={value}
          onChange={(e) => {
            onChange(e.currentTarget.value);
            const n = normalizeIndianPhone(e.currentTarget.value);
            setHint(n ? formatPhoneForDisplay(n) : null);
          }}
          onBlur={() => {
            const n = normalizeIndianPhone(value);
            onBlur?.(n);
          }}
        />
        {hint ? (
          <p className="text-muted-foreground text-xs">
            Will be saved as <span className="text-foreground font-medium">{hint}</span>
          </p>
        ) : null}
      </div>
    );
  },
);
