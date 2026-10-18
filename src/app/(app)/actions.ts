"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updatePasswordAction(formData: FormData) {
  const password = z.string().min(8).max(72).safeParse(formData.get("password"));
  if (!password.success) redirect("/settings/password?error=invalid");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect("/settings/password?error=update");
  redirect("/settings/password?updated=1");
}
