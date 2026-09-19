"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { Category } from "@/types/domain";
import {
  createCategory,
  deleteCategoryPermanently,
  updateCategory,
} from "@/features/questions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      toast.success(`"${name}" added`);
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
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(c.isActive ? `"${c.name}" deactivated` : `"${c.name}" activated`);
      router.refresh();
    });
  }

  function remove(c: Category) {
    if (!window.confirm(`Delete "${c.name}" permanently? This cannot be undone.`))
      return;
    startTransition(async () => {
      const res = await deleteCategoryPermanently(c.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`"${c.name}" deleted`);
      router.refresh();
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
      {categories.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">No categories yet.</p>
      ) : (
        <Table>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="w-full">
                  <span className={c.isActive ? "" : "text-muted-foreground"}>
                    {c.name}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={c.isActive ? "default" : "outline"}>
                    {c.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={pending}
                        aria-label={`Actions for ${c.name}`}
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggle(c)}>
                        {c.isActive ? (
                          <ToggleLeft aria-hidden="true" />
                        ) : (
                          <ToggleRight aria-hidden="true" />
                        )}
                        {c.isActive ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      {viewerIsSuperAdmin ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => remove(c)}
                          >
                            <Trash2 aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
