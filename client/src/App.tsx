import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import RadarScan from "./pages/RadarScan";
import SystemConfig from "./pages/SystemConfig";
import Architecture from "./pages/Architecture";
import ActionsLog from "./pages/ActionsLog";

function ProtectedRouter() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/radar" component={RadarScan} />
        <Route path="/actions" component={ActionsLog} />
        <Route path="/config" component={SystemConfig} />
        <Route path="/architecture" component={Architecture} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster
              theme="dark"
              toastOptions={{
                style: {
                  background: "oklch(0.17 0.015 250)",
                  border: "1px solid oklch(0.25 0.015 250)",
                  color: "oklch(0.92 0.005 250)",
                },
              }}
            />
            <ProtectedRouter />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
