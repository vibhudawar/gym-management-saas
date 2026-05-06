/**
 * PostgreSQL error-code helpers for use inside server-action `catch` blocks.
 *
 * The `postgres` driver throws errors with a `.code` field carrying the
 * SQLSTATE code (e.g. `'23505'` for a unique-constraint violation). Use
 * these helpers instead of repeating the inline `typeof err === 'object'
 * && 'code' in err && err.code === '...'` dance in every action.
 *
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

function getPgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) {
    return undefined;
  }
  const code = (err as { code: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * `23505` — unique_violation. Fires when an INSERT/UPDATE collides with a
 * UNIQUE constraint or unique index (e.g. duplicate phone within a gym,
 * duplicate plan name, duplicate invoice number).
 */
export function isUniqueViolation(err: unknown): boolean {
  return getPgErrorCode(err) === "23505";
}
