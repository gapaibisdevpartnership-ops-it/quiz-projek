"use client";

import { useActionState } from "react";
import {
  changeOwnPasswordAction,
  signOutAction,
  type ActionState,
} from "@/features/auth/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";

const initial: ActionState = {};

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useActionState(changeOwnPasswordAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {forced ? "Set your password" : "Change password"}
        </CardTitle>
        <CardDescription>
          {forced
            ? "Choose your own password to finish signing in. At least 8 characters."
            : "Choose a new password of at least 8 characters."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error ? (
            <Alert variant="destructive">{state.error}</Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <SubmitButton className="w-full" pendingText="Saving…">
            Save password
          </SubmitButton>
        </form>
        <form action={signOutAction} className="mt-3 text-center">
          <button
            type="submit"
            className="text-muted-foreground text-sm underline"
          >
            Sign out
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
