"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AuthStatusVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === "/" || pathname === "/login" ? null : children;
}
