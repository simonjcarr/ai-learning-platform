import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export type AuthUser = {
  clerkUserId: string;
  role: Role;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { clerkUserId: true, role: true }
  });

  return user;
}

export async function requireAuth(): Promise<AuthUser> {
  const authUser = await getAuthUser();
  
  if (!authUser) {
    throw new Error("Unauthorized: Authentication required");
  }

  return authUser;
}

export async function requireRole(requiredRole: Role | Role[]): Promise<AuthUser> {
  const authUser = await requireAuth();
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!allowedRoles.includes(authUser.role)) {
    throw new Error(`Forbidden: Requires one of these roles: ${allowedRoles.join(", ")}`);
  }

  return authUser;
}

export async function requireMinRole(minRole: Role): Promise<AuthUser> {
  const authUser = await requireAuth();
  const roleHierarchy = {
    [Role.USER]: 0,
    [Role.EDITOR]: 1,
    [Role.MODERATOR]: 2,
    [Role.ADMIN]: 3
  };

  if (roleHierarchy[authUser.role] < roleHierarchy[minRole]) {
    throw new Error(`Forbidden: Requires at least ${minRole} role`);
  }

  return authUser;
}

export function hasRole(userRole: Role, requiredRole: Role | Role[]): boolean {
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return allowedRoles.includes(userRole);
}

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  const roleHierarchy = {
    [Role.USER]: 0,
    [Role.EDITOR]: 1,
    [Role.MODERATOR]: 2,
    [Role.ADMIN]: 3
  };

  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}