import type { ElementType } from "react";
import { CheckCircle2, Construction } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PagePlaceholderProps {
  title: string;
  description: string;
  phase: string;
  icon: ElementType;
  items: string[];
}

export function PagePlaceholder({
  title,
  description,
  phase,
  icon: Icon,
  items,
}: PagePlaceholderProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={title} description={description} />

      <Card className="overflow-hidden border-dashed bg-card/70">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center sm:py-14">
          <div className="relative mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 to-teal-500/10 text-primary ring-1 ring-primary/15">
            <Icon className="size-7" />
            <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
              <Construction className="size-3.5 text-amber-500" />
            </span>
          </div>

          <Badge variant="secondary" className="mb-3">
            Dijadwalkan · {phase}
          </Badge>
          <h2 className="text-balance text-lg font-semibold text-foreground">
            {title} sedang disiapkan
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {description}
          </p>

          <ul className="mt-6 grid w-full max-w-lg gap-2 text-left sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item}
                className={cn(
                  "flex items-start gap-2 rounded-lg border bg-background/70 px-3 py-2 text-xs text-muted-foreground",
                )}
              >
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
