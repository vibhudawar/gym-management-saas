"use client";

import { zodResolver } from "@/lib/forms/zod-resolver";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/server/actions/auth/forgot-password";

const formSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

type FormValues = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      await requestPasswordReset(values);
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <p className="border-primary/20 bg-primary/5 text-foreground rounded-md border px-3 py-3 text-sm">
        Check your email for reset instructions. The link expires in 1 hour.
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@gym.in"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
        </Button>
      </form>
    </Form>
  );
}
