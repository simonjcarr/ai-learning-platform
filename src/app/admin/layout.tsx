"use client";

import { useAuth } from "@/hooks/use-auth";
import { Role } from "@prisma/client";
import { notFound, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FileText, Flag, DollarSign, Users, Shield, FolderOpen } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, hasMinRole, isLoadingRole } = useAuth();
  const pathname = usePathname();

  // Show loading state while role is being fetched
  if (isLoadingRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Redirect if not at least EDITOR role
  if (!hasMinRole(Role.EDITOR)) {
    notFound();
  }

  const navigation = [
    {
      name: "Articles",
      href: "/admin/articles",
      icon: FileText,
      minRole: Role.EDITOR,
    },
    {
      name: "Flagged Content",
      href: "/admin/flagged",
      icon: Flag,
      minRole: Role.MODERATOR,
    },
    {
      name: "Users",
      href: "/admin/users",
      icon: Users,
      minRole: Role.ADMIN,
    },
    {
      name: "Categories",
      href: "/admin/categories",
      icon: FolderOpen,
      minRole: Role.ADMIN,
    },
    {
      name: "Subscription Pricing",
      href: "/admin/pricing",
      icon: DollarSign,
      minRole: Role.ADMIN,
    },
  ];

  const availableNav = navigation.filter((item) => hasMinRole(item.minRole));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between px-4 border-b">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-orange-600" />
                <h2 className="text-lg font-semibold">Admin Panel</h2>
              </div>
              <span className="text-xs text-gray-500 uppercase">{userRole}</span>
            </div>
            
            <nav className="flex-1 space-y-1 px-2 py-4">
              {availableNav.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-orange-50 text-orange-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            
            <div className="border-t p-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 pl-64">
          <main className="flex-1">
            <div className="py-8 px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}