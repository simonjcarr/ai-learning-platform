"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Role } from "@prisma/client";

export function useAuth() {
  const { user, isSignedIn, isLoaded } = useUser();
  
  // Initialize state with cached values
  const getCachedRole = () => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('userRole');
      return cached as Role | null;
    }
    return null;
  };
  
  const [userRole, setUserRole] = useState<Role | null>(getCachedRole);
  const [isLoadingRole, setIsLoadingRole] = useState(() => {
    // If we have a cached role and Clerk is loaded with a signed-in user, we're not loading
    const cached = getCachedRole();
    return !cached || !isLoaded || !isSignedIn;
  });

  useEffect(() => {
    async function fetchUserRole() {
      if (!isLoaded) {
        return;
      }
      
      if (!isSignedIn || !user) {
        setUserRole(null);
        setIsLoadingRole(false);
        // Clear cached role
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('userRole');
        }
        return;
      }

      try {
        const response = await fetch("/api/user/role");
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.role);
          // Cache role in sessionStorage
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('userRole', data.role);
          }
        } else {
          setUserRole(Role.USER);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('userRole', Role.USER);
          }
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

  // Function to refresh role (useful after subscription changes)
  const refreshRole = async () => {
    // Clear cache and refetch
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('userRole');
    }
    setIsLoadingRole(true);
    
    // Re-trigger role fetch
    if (user && isSignedIn && isLoaded) {
      try {
        const response = await fetch("/api/user/role");
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.role);
          // Cache role in sessionStorage
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('userRole', data.role);
          }
        } else {
          setUserRole(Role.USER);
        }
      } catch (error) {
        console.error("Failed to refresh user role:", error);
        setUserRole(Role.USER);
      } finally {
        setIsLoadingRole(false);
      }
    }
  };

  return {
    user,
    isSignedIn,
    isLoaded,
    userRole,
    isLoadingRole,
    hasRole,
    hasMinRole,
    refreshRole
  };
}