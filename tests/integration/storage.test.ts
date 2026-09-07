import { afterAll, describe, expect, it } from "vitest";
import {
  hasSupabaseEnv,
  serviceClient,
  signInAs,
} from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/** Phase 8 — storage upload authorization (docs/SECURITY_RLS.md "Storage Security"). */
const d = hasSupabaseEnv ? describe : describe.skip;

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

d("quiz-assets storage", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  const adminPath = `questions/_hardening/${Date.now()}.png`;

  afterAll(async () => {
    await svc.storage.from("quiz-assets").remove([adminPath]);
  });

  it("a sales user cannot upload to quiz-assets", async () => {
    const sales = await signInAs(SEED_USERS.sales1.email);
    const { error } = await sales.storage
      .from("quiz-assets")
      .upload(`questions/_hardening/sales-${Date.now()}.png`, PNG, {
        contentType: "image/png",
      });
    expect(error).not.toBeNull();
    await sales.auth.signOut();
  });

  it("an admin can upload, and the object is publicly readable", async () => {
    const admin = await signInAs(SEED_USERS.trainer.email);
    const { error } = await admin.storage
      .from("quiz-assets")
      .upload(adminPath, PNG, { contentType: "image/png" });
    expect(error).toBeNull();

    const { data } = admin.storage.from("quiz-assets").getPublicUrl(adminPath);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);
    await admin.auth.signOut();
  });
});
