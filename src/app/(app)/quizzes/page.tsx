import Link from "next/link";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { listMyAssignedQuizzes } from "@/features/assignments/service";
import { listQuizzes } from "@/features/quizzes/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QuizzesPage() {
  const profile = await requireProfile();
  const admin = isAdminRole(profile.role);
  const quizzes = admin
    ? await listQuizzes({ status: "published" })
    : await listMyAssignedQuizzes();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        {admin ? "Published quizzes" : "Your quizzes"}
      </h1>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {admin
              ? "No published quizzes yet."
              : "You have no assigned quizzes right now."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base">{q.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {q.description ? (
                  <p className="text-muted-foreground line-clamp-2">
                    {q.description}
                  </p>
                ) : null}
                <ul className="text-muted-foreground text-xs">
                  <li>Passing score: {q.passingScore}%</li>
                  <li>
                    Duration:{" "}
                    {q.durationMinutes ? `${q.durationMinutes} min` : "Untimed"}
                  </li>
                  <li>Attempts allowed: {q.maxAttempts}</li>
                  {q.endAt ? (
                    <li>Closes: {new Date(q.endAt).toLocaleString()}</li>
                  ) : null}
                </ul>
                <Link
                  href={`/quizzes/${q.id}`}
                  className="inline-block text-sm underline"
                >
                  Open
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
