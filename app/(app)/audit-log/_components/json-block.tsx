type Props = {
  label: string;
  value: unknown;
};

/**
 * Pretty-printed read-only JSON block. Raw output, no diff highlighting in
 * v1 — just monospace + 2-space indent.
 */
export function JsonBlock({ label, value }: Props) {
  const formatted =
    value === null || value === undefined ? "(none)" : JSON.stringify(value, null, 2);
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <pre className="bg-muted/50 text-foreground/90 max-h-72 overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
        {formatted}
      </pre>
    </div>
  );
}
