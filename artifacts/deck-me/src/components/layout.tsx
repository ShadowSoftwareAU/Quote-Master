import { Link, useLocation } from "wouter";
import { Hammer, Calculator, FileText, Users, Box, Calendar, Menu, UserCheck, CalendarDays, Images, TrendingUp, PieChart, FolderKanban, UserCog, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ReactNode } from "react";
import { Show, UserButton } from "@clerk/react";
import { useProfileAccess } from "@/lib/access";

const navItems = [
  { href: "/", label: "Dashboard", icon: Hammer },
  { href: "/calculator", label: "Quote Builder", icon: Calculator },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/materials", label: "Materials", icon: Box },
  { href: "/bookings", label: "Bookings", icon: Calendar },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/team", label: "Team", icon: UserCheck },
  { href: "/portfolio", label: "Gallery", icon: Images },
  { href: "/referrals", label: "Referrals", icon: TrendingUp },
  { href: "/finance", label: "Finance", icon: PieChart },
  { href: "/settings/profile", label: "Profile", icon: UserCog },
];
const LOGO_SRC = `${import.meta.env.BASE_URL}quote-master-logo.jpg`;

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { canManageTeam, canViewFinancials, canViewGeneralWorkspace, isMasterBuilder } = useProfileAccess();
  const roleFilteredItems = navItems.filter((item) => {
    if (item.href === "/finance") return canViewFinancials;
    if (item.href === "/team" || item.href === "/planner") return canManageTeam;
    if (["/customers", "/materials", "/portfolio", "/referrals"].includes(item.href)) return canViewGeneralWorkspace;
    return true;
  });
  const visibleNavItems = canManageTeam
    ? [...roleFilteredItems, { href: "/projects", label: "Projects", icon: FolderKanban }]
    : roleFilteredItems;

  return (
    <div className="flex min-h-[100dvh] w-full bg-background flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2 font-display font-black text-xl text-sidebar-primary">
            <img src={LOGO_SRC} alt="Quote Master" className="w-44 h-auto object-contain" />
          </Link>
        </div>
        <div className="px-6 py-4 border-b border-sidebar-border">
          <Show when="signed-out">
            <Link href="/sign-in" className="text-xs font-bold uppercase text-sidebar-primary">Sign in</Link>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors font-medium text-sm ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.href === "/projects" && !isMasterBuilder && (
                  <LockKeyhole className="ml-auto w-3.5 h-3.5" aria-label="Upgrade required" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Header & Bottom Nav */}
      <div className="md:hidden flex h-14 items-center justify-between px-4 border-b bg-card">
        <Link href="/" className="flex items-center gap-2 font-display font-black text-xl text-primary">
          <img src={LOGO_SRC} alt="Quote Master" className="w-40 h-auto object-contain" />
        </Link>
        <div className="flex items-center gap-1">
          <Show when="signed-out">
            <Button asChild variant="ghost" size="sm" className="font-bold">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-r-sidebar-border">
            <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
              <span className="flex items-center gap-2 font-display font-black text-xl text-sidebar-primary">
                <img src={LOGO_SRC} alt="Quote Master" className="w-44 h-auto object-contain" />
              </span>
            </div>
            <nav className="py-4 px-4 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors font-medium text-sm ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {item.href === "/projects" && !isMasterBuilder && (
                      <LockKeyhole className="ml-auto w-3.5 h-3.5" aria-label="Upgrade required" />
                    )}
                  </Link>
                );
              })}
            </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Bar — first 5 items */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around px-2 z-50">
        {visibleNavItems.slice(0, 5).map((item) => {
          const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
