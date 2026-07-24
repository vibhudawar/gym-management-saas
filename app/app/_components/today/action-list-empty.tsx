import { CheckCircle2 } from "lucide-react";

type Props = {
  message: string;
};

export function ActionListEmpty({ message }: Props) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 px-5 py-6 text-sm">
      <CheckCircle2 className="text-emerald-600 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
