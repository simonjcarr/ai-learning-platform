"use client";

import { useAuth } from "@/hooks/use-auth";
import { Role } from "@prisma/client";
import { notFound, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FileText, Flag, DollarSign, Users, Shield, FolderOpen, Tags, Brain, Zap, BarChart, Settings, History, Mail, Layers, Folder, GraduationCap, Award, HelpCircle, Activity, Youtube, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, hasMinRole, isLoadingRole } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('admin-sidebar');
      const menuButton = document.getElementById('menu-button');
      
      if (isSidebarOpen && 
          sidebar && 
          !sidebar.contains(event.target as Node) && 
          menuButton && 
          !menuButton.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

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
      name: "Courses",
      href: "/admin/courses",
      icon: GraduationCap,
      minRole: Role.ADMIN,
    },
    {
      name: "Flagged Content",
      href: "/admin/flagged",
      icon: Flag,
      minRole: Role.MODERATOR,
    },
    {
      name: "Change History",
      href: "/admin/changes",
      icon: History,
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
      name: "Tags",
      href: "/admin/tags",
      icon: Tags,
      minRole: Role.ADMIN,
    },
    {
      name: "AI Models",
      href: "/admin/ai-models",
      icon: Brain,
      minRole: Role.ADMIN,
    },
    {
      name: "YouTube API",
      href: "/admin/youtube-api",
      icon: Youtube,
      minRole: Role.ADMIN,
    },
    {
      name: "AI Interactions",
      href: "/admin/ai-interactions",
      icon: Zap,
      minRole: Role.ADMIN,
    },
    {
      name: "AI Reports",
      href: "/admin/ai-reports",
      icon: BarChart,
      minRole: Role.ADMIN,
    },
    {
      name: "Subscription Pricing",
      href: "/admin/pricing",
      icon: DollarSign,
      minRole: Role.ADMIN,
    },
    {
      name: "Features",
      href: "/admin/features",
      icon: Layers,
      minRole: Role.ADMIN,
    },
    {
      name: "Feature Categories",
      href: "/admin/feature-categories",
      icon: Folder,
      minRole: Role.ADMIN,
    },
    {
      name: "Feature Assignments",
      href: "/admin/feature-assignments",
      icon: Settings,
      minRole: Role.ADMIN,
    },
    {
      name: "Email Templates",
      href: "/admin/email-templates",
      icon: Mail,
      minRole: Role.ADMIN,
    },
    {
      name: "Suggestion Settings",
      href: "/admin/suggestions/settings",
      icon: Zap,
      minRole: Role.ADMIN,
    },
    {
      name: "Course Completion",
      href: "/admin/course-completion",
      icon: Award,
      minRole: Role.ADMIN,
    },
    {
      name: "Certificates",
      href: "/admin/certificates",
      icon: Award,
      minRole: Role.ADMIN,
    },
    {
      name: "Quiz Generation",
      href: "/admin/quiz-generation",
      icon: HelpCircle,
      minRole: Role.ADMIN,
    },
    {
      name: "BullMQ Management",
      href: "/admin/bullmq",
      icon: Activity,
      minRole: Role.ADMIN,
    },
  ];

  const availableNav = navigation.filter((item) => hasMinRole(item.minRole));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          id="menu-button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-md bg-white shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {isSidebarOpen ? (
            <X className="h-6 w-6 text-gray-600" />
          ) : (
            <Menu className="h-6 w-6 text-gray-600" />
          )}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div 
          id="admin-sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
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
        <div className="flex-1 lg:pl-64">
          <main className="flex-1">
            <div className="py-8 px-4 sm:px-6 lg:px-8 pt-20 lg:pt-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}