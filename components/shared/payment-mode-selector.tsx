"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { paymentModes, type PaymentMode } from "@/lib/db/schema/payments";

const MODE_LABEL: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank",
};

type Props = {
  value: PaymentMode;
  onChange: (next: PaymentMode) => void;
  className?: string;
};

export function PaymentModeSelector({ value, onChange, className }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as PaymentMode)}
      variant="outline"
      className={className}
    >
      {paymentModes.map((mode) => (
        <ToggleGroupItem key={mode} value={mode} className="flex-1">
          {MODE_LABEL[mode]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
