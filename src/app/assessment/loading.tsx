import { Loader2 } from "lucide-react";

export default function AssessmentLoading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
