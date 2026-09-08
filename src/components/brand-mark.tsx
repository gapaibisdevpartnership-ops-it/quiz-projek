import { LightbulbIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * GAPAI Mentorship wordmark: a brand-yellow lightbulb + "GAPAI mentorship".
 * Text inherits `currentColor` so it works on the violet sidebar and on light
 * pages; pass `textClassName` to recolour or to hide it (collapsed sidebar).
 */
export function BrandMark({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LightbulbIcon className="size-5 shrink-0 fill-brand text-brand" />
      <span
        className={cn(
          "font-semibold tracking-tight whitespace-nowrap",
          textClassName,
        )}
      >
        GAPAI <span className="font-medium opacity-80">mentorship</span>
      </span>
    </span>
  );
}
