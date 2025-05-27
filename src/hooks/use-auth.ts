"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Role } from "@prisma/client";

export function useAuth() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      if (!isLoaded || !isSignedIn || !user) {
        setUserRole(null);
        setIsLoadingRole(false);
        return;
      }

      try {
        const response = await fetch("/api/user/role");
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.role);
        } else {
          setUserRole(Role.USER);
        }
      } catch (error) {
        console.error("Failed to fetch user role:", error);
        setUserRole(Role.USER);
      } finally {
        setIsLoadingRole(false);
      }
    }

    fetchUserRole();
  }, [user, isSignedIn, isLoaded]);

  const hasRole = (requiredRole: Role | Role[]): boolean => {
    if (!userRole) return false;
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return allowedRoles.includes(userRole);
  };

  const hasMinRole = (minRole: Role): boolean => {
    if (!userRole) return false;
    const roleHierarchy = {
      [Role.USER]: 0,
      [Role.EDITOR]: 1,
      [Role.MODERATOR]: 2,
      [Role.ADMIN]: 3
    };
    return roleHierarchy[userRole] >= roleHierarchy[minRole];
  };

  return {
    user,
    isSignedIn,
    isLoaded,
    userRole,
    isLoadingRole,
    hasRole,
    hasMinRole
  };
}