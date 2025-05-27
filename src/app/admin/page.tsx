"use client";

import { useAuth } from "@/hooks/use-auth";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const { hasMinRole, isLoadingRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoadingRole) {
      if (hasMinRole(Role.ADMIN)) {
        router.replace("/admin/users");
      } else if (hasMinRole(Role.MODERATOR)) {
        router.replace("/admin/flagged");
      } else if (hasMinRole(Role.EDITOR)) {
        router.replace("/admin/articles");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [hasMinRole, isLoadingRole, router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
    </div>
  );
}