import { Skeleton } from "@/components/ui/skeleton";

export default function AssessmentLoading() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
