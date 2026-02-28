import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Subscriptions from "./pages/Subscriptions";
import Summaries from "./pages/Summaries";
import Bookmarks from "./pages/Bookmarks";
import DirectSummary from "./pages/DirectSummary";
import Playlists from "./pages/Playlists";
import Settings from "./pages/Settings";
import { BackgroundTasksBar } from "./components/BackgroundTasksBar";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/subscriptions">
        <DashboardLayout>
          <Subscriptions />
        </DashboardLayout>
      </Route>
      <Route path="/summaries">
        <DashboardLayout>
          <Summaries />
        </DashboardLayout>
      </Route>
      <Route path="/bookmarks">
        <DashboardLayout>
          <Bookmarks />
        </DashboardLayout>
      </Route>
      <Route path="/direct-summary">
        <DashboardLayout>
          <DirectSummary />
        </DashboardLayout>
      </Route>
      <Route path="/playlists">
        <DashboardLayout>
          <Playlists />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
          <BackgroundTasksBar />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
