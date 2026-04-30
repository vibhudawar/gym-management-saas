import { zodResolver as baseResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Thin wrapper around @hookform/resolvers/zod that papers over a TS-only
 * version-stamp mismatch between Zod 4.3+ and resolvers v5.2.x. Runtime
 * behaviour is identical — only the inferred type is normalised.
 */
export function zodResolver<TSchema extends z.ZodType>(
  schema: TSchema,
): Resolver<z.infer<TSchema> & FieldValues> {
  return baseResolver(schema as never) as Resolver<
    z.infer<TSchema> & FieldValues
  >;
}
