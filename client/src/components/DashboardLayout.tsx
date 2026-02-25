/*
 * DashboardLayout — Tactical Operations Dashboard Shell
 * Left sidebar (collapsible) + Top status bar + Main content area
 * Design: Deep blue-gray, electric blue accents, F1 engineer monitor feel
 */
import { useState, useEffect, type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Radar,
  ScrollText,
  Settings,
  Network,
  ChevronLeft,
  ChevronRight,
  Activity,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Radar, label: "雷达扫描", path: "/radar" },
  { icon: ScrollText, label: "运行日志", path: "/actions" },
  { icon: Settings, label: "系统配置", path: "/config" },
  { icon: Network, label: "架构文档", path: "/architecture" },
];

function StatusBar() {
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const bjTime = time.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const utcTime = time.toLocaleString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <header className="h-12 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary status-pulse" />
          <span className="font-mono text-xs text-muted-foreground">SEA</span>
          <span className="font-mono text-xs font-semibold text-primary">V5.9.4</span>
        </div>
        <div className="w-px h-5 bg-border" />
        <span className="text-xs text-muted-foreground">Emotion Arbitrage Radar</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {online ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={`text-xs font-mono ${online ? "text-emerald-400" : "text-red-400"}`}>
            {online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <div className="w-px h-5 bg-border" />
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">{bjTime}</span>
          <span className="font-mono text-xs text-muted-foreground">BJ</span>
          <span className="text-muted-foreground/50 text-xs mx-0.5">/</span>
          <span className="font-mono text-xs text-muted-foreground">{utcTime}</span>
          <span className="font-mono text-xs text-muted-foreground">UTC</span>
        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <StatusBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            collapsed ? "w-[60px]" : "w-[220px]"
          } border-r border-border bg-sidebar shrink-0 flex flex-col transition-all duration-300 ease-in-out`}
        >
          {/* Logo area */}
          <div className={`p-3 ${collapsed ? "px-2" : "px-4"} border-b border-sidebar-border`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Radar className="w-4.5 h-4.5 text-primary" />
              </div>
              {!collapsed && (
                <div className="overflow-hidden">
                  <div className="text-sm font-semibold text-sidebar-foreground truncate">SEA Admin</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">管理后台</div>
                </div>
              )}
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-2 space-y-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;

              const linkContent = (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-150 group ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary-foreground border-l-2 border-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-2 border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover text-popover-foreground">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </nav>

          {/* Collapse toggle */}
          <div className="p-2 border-t border-sidebar-border">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
