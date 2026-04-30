const E164_RE = /^\+[1-9]\d{1,14}$/;
const DEFAULT_COUNTRY_CODE = "+91";

export function isE164(value: string): boolean {
  return E164_RE.test(value);
}

export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    return E164_RE.test(trimmed) ? trimmed : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    const candidate = `${DEFAULT_COUNTRY_CODE}${digits}`;
    return E164_RE.test(candidate) ? candidate : null;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const candidate = `+${digits}`;
    return E164_RE.test(candidate) ? candidate : null;
  }
  return null;
}

export function formatPhoneForDisplay(e164: string): string {
  if (!isE164(e164)) return e164;
  if (e164.startsWith("+91") && e164.length === 13) {
    const rest = e164.slice(3);
    return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
  }
  return e164;
}
