"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/types/domain";
import {
  createCategory,
  deleteCategoryPermanently,
  updateCategory,
} from "@/features/questions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function CategoryManager({
  categories,
  viewerIsSuperAdmin,
}: {
  categories: Category[];
  viewerIsSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await createCategory({ name, description: "", isActive: true });
      if (!res.ok) return setError(res.error);
      setName("");
      router.refresh();
    });
  }

  function toggle(c: Category) {
    startTransition(async () => {
      const res = await updateCategory(c.id, {
        name: c.name,
        description: c.description ?? "",
        isActive: !c.isActive,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function remove(c: Category) {
    if (!window.confirm(`Delete "${c.name}" permanently? This cannot be undone.`))
      return;
    startTransition(async () => {
      const res = await deleteCategoryPermanently(c.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex gap-2">
        <Input
          value={name}
          placeholder="New category name"
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={add} disabled={pending || !name.trim()}>
          Add
        </Button>
      </div>
      <ul className="divide-y text-sm">
        {categories.length === 0 ? (
          <li className="text-muted-foreground py-2">No categories yet.</li>
        ) : null}
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2">
            <span className={c.isActive ? "" : "text-muted-foreground line-through"}>
              {c.name}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => toggle(c)}
              >
                {c.isActive ? "Deactivate" : "Activate"}
              </Button>
              {viewerIsSuperAdmin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => remove(c)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
