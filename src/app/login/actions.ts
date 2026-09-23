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
    loginRedirect("error", "请输入邮箱和密码。");
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
        ? "邮箱尚未验证，请先检查验证邮件。"
        : "邮箱或密码不正确。",
    );
  }

  redirect("/");
}

export async function signUp(formData: FormData) {
  const displayName =
    formData.get("displayName")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (displayName.length < 1 || displayName.length > 100) {
    loginRedirect("error", "姓名需要填写 1 到 100 个字符。");
  }

  if (!email) {
    loginRedirect("error", "请输入邮箱。");
  }

  if (password.length < 8) {
    loginRedirect("error", "密码至少需要 8 个字符。");
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
        ? "该邮箱已经注册，请直接登录。"
        : "注册失败，请检查邮箱和密码后重试。",
    );
  }

  if (data.session) {
    redirect("/");
  }

  loginRedirect("message", "注册成功，请检查邮箱并完成验证后登录。");
}
