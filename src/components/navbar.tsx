"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Search, BookOpen, Home, User, Menu, X, CreditCard, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Role } from "@prisma/client";

export function Navbar() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const { hasMinRole } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/categories", label: "Categories", icon: BookOpen },
    { href: "/search", label: "Search", icon: Search },
  ];

  return (
    <nav className="border-b bg-white">
      <div className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold sm:inline hidden">IT Learning Platform</span>
              <span className="text-xl font-bold sm:hidden">IT Learning</span>
            </Link>
            <div className="hidden md:ml-10 md:flex items-baseline space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/pricing"
              className={cn(
                "flex items-center space-x-1 text-sm font-medium transition-colors",
                pathname === "/pricing"
                  ? "text-blue-700"
                  : "text-gray-700 hover:text-gray-900"
              )}
            >
              <CreditCard className="h-4 w-4" />
              <span>Pricing</span>
            </Link>
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                {hasMinRole(Role.ADMIN) && (
                  <Link
                    href="/admin/users"
                    className={cn(
                      "flex items-center space-x-1 text-sm font-medium transition-colors",
                      pathname.startsWith("/admin")
                        ? "text-blue-700"
                        : "text-gray-700 hover:text-gray-900"
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin</span>
                  </Link>
                )}
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <Link
                href="/sign-in"
                className="flex items-center justify-center p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                aria-label="Sign in"
              >
                <User className="h-5 w-5" />
              </Link>
            )}
          </div>
          <div className="flex md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Mobile menu */}
      <div className={cn("md:hidden bg-white absolute top-full left-0 right-0 shadow-lg z-50", isMenuOpen ? "block" : "hidden")}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium w-full",
                  pathname === item.href
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/pricing"
            onClick={() => setIsMenuOpen(false)}
            className={cn(
              "flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium w-full",
              pathname === "/pricing"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <CreditCard className="h-5 w-5" />
            <span>Pricing</span>
          </Link>
        </div>
        {isSignedIn ? (
          <>
            <div className="px-2 pb-3 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium w-full",
                  pathname === "/dashboard"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <span>Dashboard</span>
              </Link>
              {hasMinRole(Role.ADMIN) && (
                <Link
                  href="/admin/users"
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium w-full",
                    pathname.startsWith("/admin")
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Shield className="h-5 w-5" />
                  <span>Admin</span>
                </Link>
              )}
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="px-5">
                <div className="flex items-center space-x-3">
                  <UserButton afterSignOutUrl="/" />
                  <span className="text-sm font-medium text-gray-700">Account</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-2">
              <Link
                href="/sign-in"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center space-x-2 px-4 py-2 rounded-md bg-blue-600 text-white text-base font-medium hover:bg-blue-700 transition-colors w-full"
              >
                <User className="h-5 w-5" />
                <span>Sign In</span>
              </Link>
            </div>
          </div>
        )}
      </div>
      </div>
    </nav>
  );
}