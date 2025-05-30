"use client";

import { useAuth } from "@/hooks/use-auth";
import { Role } from "@prisma/client";
import { ReactNode } from "react";

type RoleGuardProps = {
  children: ReactNode;
  requiredRole?: Role | Role[];
  minRole?: Role;
  fallback?: ReactNode;
};

export function RoleGuard({ 
  children, 
  requiredRole, 
  minRole, 
  fallback = null 
}: RoleGuardProps) {
  const { isLoadingRole, hasRole, hasMinRole } = useAuth();

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasRequiredRole = requiredRole ? hasRole(requiredRole) : true;
  const hasMinimumRole = minRole ? hasMinRole(minRole) : true;

  if (!hasRequiredRole || !hasMinimumRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}