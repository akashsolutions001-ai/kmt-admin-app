import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Buses from "./pages/Buses";
import Drivers from "./pages/Drivers";
import Passengers from "./pages/Passengers";
import RoutesPage from "./pages/Routes";
import Stops from "./pages/Stops";
import Schedules from "./pages/Schedules";
import LiveMonitoring from "./pages/LiveMonitoring";
import Complaints from "./pages/Complaints";
import Announcements from "./pages/Announcements";
import Depots from "./pages/Depots";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/buses" element={<Buses />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/passengers" element={<Passengers />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/stops" element={<Stops />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/live" element={<LiveMonitoring />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/depots" element={<Depots />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
