import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  href,
  emphasize,
  loading,
}: {
  label: string;
  value?: string | number;
  hint?: string;
  /** Makes the card a link — use for stats that lead to an actionable view. */
  href?: string;
  /** Draws attention with the primary color — use when the value needs action. */
  emphasize?: boolean;
  /** Value is still being fetched — shows a skeleton in place of the value only. */
  loading?: boolean;
}) {
  const card = (
    <Card
      className={cn(
        emphasize && "border-primary/40 bg-primary/5",
        href && "transition-colors hover:border-primary/40 hover:bg-accent/50",
      )}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <CardTitle className={cn("text-2xl", emphasize && "text-primary")}>
            {value}
          </CardTitle>
        )}
        {hint ? (
          <p className="text-muted-foreground text-xs">{hint}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
