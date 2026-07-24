import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  phoneE164: string;
};

export function CallButton({ phoneE164 }: Props) {
  return (
    <Button asChild variant="outline" size="sm" className="h-8">
      <a href={`tel:${phoneE164}`} aria-label="Call">
        <Phone className="size-3.5" />
        Call
      </a>
    </Button>
  );
}
