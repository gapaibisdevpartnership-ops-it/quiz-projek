"use client";

import { createClient } from "@/lib/supabase/client";
import {
  ASSET_MIME_TYPES,
  MAX_ASSET_BYTES,
  STORAGE_BUCKET,
  type AssetMimeType,
} from "@/lib/constants";

export type AssetFolder = "questions" | "question-options" | "quiz-covers";

/**
 * Uploads an image to the quiz-assets bucket and returns its public URL.
 * The storage RLS policy still checks is_admin() server-side.
 */
export async function uploadAsset(
  folder: AssetFolder,
  ownerId: string,
  file: File,
): Promise<string> {
  if (!ASSET_MIME_TYPES.includes(file.type as AssetMimeType)) {
    throw new Error("Use a JPG, PNG or WEBP image.");
  }
  if (file.size > MAX_ASSET_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${folder}/${ownerId}/${crypto.randomUUID()}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
