import Image from "next/image";
import type { Question, QuestionOption } from "@/types/domain";
import { QUESTION_TYPE_LABELS } from "@/lib/validation/question";

/**
 * Read-only presentation of a question. Used by the Quiz Builder preview
 * (docs/UI_UX_SPEC.md: preview renders the same content but creates no
 * attempt). The interactive player is a separate component (Phase 5).
 *
 * `revealCorrect` is only ever passed in trusted admin contexts.
 */
export function QuestionRenderer({
  index,
  question,
  options,
  points,
  revealCorrect = false,
}: {
  index: number;
  question: Question;
  options: QuestionOption[];
  points?: number;
  revealCorrect?: boolean;
}) {
  const isEssay = question.questionType === "essay";

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {index + 1} · {QUESTION_TYPE_LABELS[question.questionType]}
        </span>
        {points != null ? <span>{points} pt</span> : null}
      </div>

      {question.questionText ? (
        <p className="font-medium">{question.questionText}</p>
      ) : null}

      {question.questionImageUrl ? (
        <Image
          src={question.questionImageUrl}
          alt=""
          width={480}
          height={320}
          className="rounded-md border object-contain"
          unoptimized
        />
      ) : null}

      {isEssay ? (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Free-text answer (manually graded)
        </div>
      ) : (
        <ul className="space-y-2">
          {options.map((o) => {
            const correct = revealCorrect && o.isCorrect;
            return (
              <li
                key={o.id}
                className={
                  "flex items-center gap-3 rounded-md border p-2 text-sm " +
                  (correct ? "border-emerald-500/60 bg-emerald-500/5" : "")
                }
              >
                <span className="inline-block h-4 w-4 rounded-full border" />
                {o.imageUrl ? (
                  <Image
                    src={o.imageUrl}
                    alt=""
                    width={80}
                    height={60}
                    className="rounded border object-cover"
                    unoptimized
                  />
                ) : null}
                {o.answerText ? <span>{o.answerText}</span> : null}
                {correct ? (
                  <span className="ml-auto text-xs font-medium text-emerald-600">
                    Correct
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {revealCorrect && question.explanation ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Explanation: </span>
          {question.explanation}
        </p>
      ) : null}
    </div>
  );
}
