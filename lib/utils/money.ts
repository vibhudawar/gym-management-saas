const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_FORMATTER_2DP = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format an integer paise amount as ₹ for display.
 * Pass `withDecimals: true` to always show two decimals (₹4,500.00).
 */
export function formatMoney(
  amountPaise: number | bigint,
  options: { withDecimals?: boolean } = {},
): string {
  const paise = typeof amountPaise === "bigint" ? Number(amountPaise) : amountPaise;
  const rupees = paise / 100;
  return options.withDecimals
    ? INR_FORMATTER_2DP.format(rupees)
    : INR_FORMATTER.format(rupees);
}

/**
 * Convert a rupee value (string or number from a form input) to integer paise.
 * Returns null when the input is not a valid non-negative number.
 *
 * Rounds to the nearest paise — half away from zero — to avoid float drift.
 */
export function rupeesToPaise(input: string | number): number | null {
  const trimmed = typeof input === "string" ? input.replace(/,/g, "").trim() : input;
  if (trimmed === "" || trimmed === null || trimmed === undefined) return null;
  const n = typeof trimmed === "number" ? trimmed : Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function paiseToRupeesString(amountPaise: number | bigint): string {
  const paise = typeof amountPaise === "bigint" ? Number(amountPaise) : amountPaise;
  return (paise / 100).toFixed(2);
}
