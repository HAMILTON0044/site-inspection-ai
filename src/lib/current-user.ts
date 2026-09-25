import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: "INSPECTOR" | "MANAGER";
};

export async function getCurrentUserContext() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return { ok: false as const, status: 401 as const, supabase };
  }

  const { data: rawProfile, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load current profile", error);
    return { ok: false as const, status: 500 as const, supabase };
  }

  if (!rawProfile || !rawProfile.is_active) {
    return { ok: false as const, status: 403 as const, supabase };
  }

  const profile: CurrentUserProfile = {
    id: rawProfile.id,
    email: rawProfile.email,
    displayName: rawProfile.display_name,
    role: rawProfile.role,
  };

  return { ok: true as const, profile, supabase };
}
