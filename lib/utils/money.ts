const INR_FORMATTER_NO_DECIMALS = new Intl.NumberFormat("en-IN", {
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
 *
 * - Whole rupees → no decimals: ₹4,500
 * - Non-whole rupees → two decimals: ₹4,500.50
 * - Negative → leading minus (refunds): -₹500
 *
 * Pass `withDecimals: true` to force two decimals even for whole rupees.
 * Indian numbering (lakhs/crores) is handled by the en-IN locale.
 */
export function formatMoney(
  amountPaise: number | bigint,
  options: { withDecimals?: boolean } = {},
): string {
  const paise = typeof amountPaise === "bigint" ? Number(amountPaise) : amountPaise;
  const rupees = paise / 100;
  const isWhole = Number.isInteger(rupees);
  if (options.withDecimals || !isWhole) {
    return INR_FORMATTER_2DP.format(rupees);
  }
  return INR_FORMATTER_NO_DECIMALS.format(rupees);
}

/**
 * Compact Indian-locale formatter for dashboard tiles.
 *   - < 1,000 rupees      → ₹450
 *   - < 1 lakh            → ₹47K
 *   - < 1 crore           → ₹4.7L  (5 lakh 12 thousand → ₹5.1L)
 *   - >= 1 crore          → ₹4.2Cr
 * Negative values keep the minus sign in front of ₹.
 */
export function formatMoneyShort(amountPaise: number | bigint): string {
  const paise = typeof amountPaise === "bigint" ? Number(amountPaise) : amountPaise;
  const rupees = paise / 100;
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);

  if (abs >= 10_000_000) {
    return `${sign}₹${trim(abs / 10_000_000)}Cr`;
  }
  if (abs >= 100_000) {
    return `${sign}₹${trim(abs / 100_000)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${trim(abs / 1_000)}K`;
  }
  return `${sign}₹${trim(abs)}`;
}

function trim(value: number): string {
  // Up to one decimal, trimmed of trailing zeros: 4 → "4", 4.7 → "4.7", 4.0 → "4"
  return value
    .toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 0 })
    .replace(/\.0$/, "");
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
