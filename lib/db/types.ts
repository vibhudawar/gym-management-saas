import type { db } from "./index";

/**
 * Drizzle transaction handle, the parameter of `db.transaction((tx) => ...)`.
 * Service functions accept this so they can be composed inside the same
 * atomic operation as their callers.
 */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
