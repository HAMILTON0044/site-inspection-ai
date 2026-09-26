"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(
  type: "error" | "message",
  value: string,
): never {
  redirect(`/login?${type}=${encodeURIComponent(value)}`);
}

export async function signIn(formData: FormData) {
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    loginRedirect("error", "auth.error.missingCredentials");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    loginRedirect(
      "error",
      error.code === "email_not_confirmed"
        ? "auth.error.emailNotConfirmed"
        : "auth.error.invalidCredentials",
    );
  }

  redirect("/workspace");
}

export async function signUp(formData: FormData) {
  const displayName =
    formData.get("displayName")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (displayName.length < 1 || displayName.length > 100) {
    loginRedirect("error", "auth.error.invalidName");
  }

  if (!email) {
    loginRedirect("error", "auth.error.missingEmail");
  }

  if (password.length < 8) {
    loginRedirect("error", "auth.error.shortPassword");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    loginRedirect(
      "error",
      error.code === "user_already_exists"
        ? "auth.error.userExists"
        : "auth.error.signUpFailed",
    );
  }

  if (data.session) {
    redirect("/workspace");
  }

  loginRedirect("message", "auth.message.checkEmail");
}
