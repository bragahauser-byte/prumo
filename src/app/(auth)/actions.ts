"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(8).max(72);

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function signInAction(formData: FormData) {
  const credentials = z.object({ email: emailSchema, password: passwordSchema }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!credentials.success) redirect("/login?error=invalid");
  if (!isSupabaseConfigured()) redirect("/login?error=configuration");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);
  if (error) redirect("/login?error=credentials");
  redirect("/overview");
}

export async function signUpAction(formData: FormData) {
  const values = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(1).max(80),
  }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!values.success) redirect("/register?error=invalid");
  if (!isSupabaseConfigured()) redirect("/register?error=configuration");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.data.email,
    password: values.data.password,
    options: {
      data: { name: values.data.name },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/overview`,
    },
  });
  if (error) redirect("/register?error=signup");
  if (data.session) redirect("/overview");
  redirect("/login?registered=1");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect("/forgot-password?error=invalid");
  if (!isSupabaseConfigured()) redirect("/forgot-password?error=configuration");

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/settings/password`,
  });
  redirect("/forgot-password?sent=1");
}
