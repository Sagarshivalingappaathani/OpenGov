"use client";

import { cn } from "@/lib/utils";
import { Home, LayoutDashboard, Settings, Users, Wallet, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  {
    title: "Home",
    href: "/dashboard/home",
    icon: Home,
  },
  {
    title: "Election",
    href: "/dashboard/election",
    icon: Home,
  },
  {
    title: "Fund Management",
    href: "/dashboard/fund-mangement",
    icon: LayoutDashboard,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleDisconnect = async () => {
    if (typeof window !== "undefined") {
      router.push("/");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-black text-white">
        <div className="h-full flex flex-col">
          <div className="p-6">
            <h2 className="text-2xl font-bold">Dashboard</h2>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4">
            <Button
              variant="destructive"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleDisconnect}
            >
              <LogOut className="w-4 h-4" />
              Disconnect Wallet
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-100">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}