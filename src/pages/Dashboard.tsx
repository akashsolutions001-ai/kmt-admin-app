import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StatCard } from '@/components/StatCard';
import { Bus, Users, Route, Radio, MapPin, AlertTriangle, MessageSquareWarning, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Bus as BusType, Driver, Route as RouteType, LiveBus, Complaint } from '@/types/admin';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [totalBuses, setTotalBuses] = useState(0);
  const [activeBuses, setActiveBuses] = useState(0);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [driversOnDuty, setDriversOnDuty] = useState(0);
  const [totalRoutes, setTotalRoutes] = useState(0);
  const [totalStops, setTotalStops] = useState(0);
  const [runningTrips, setRunningTrips] = useState(0);
  const [delayedBuses, setDelayedBuses] = useState(0);
  const [openComplaints, setOpenComplaints] = useState(0);
  const [todayTrips, setTodayTrips] = useState(0);
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const busesSnapshot = await getDocs(collection(db, 'buses'));
      const busesData = busesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as BusType[];
      setTotalBuses(busesData.length);
      setActiveBuses(busesData.filter((b) => b.status === 'running').length);

      const driversSnapshot = await getDocs(collection(db, 'drivers'));
      const driversData = driversSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Driver[];
      setTotalDrivers(driversData.length);
      setDriversOnDuty(driversData.filter((d) => d.status === 'active').length);

      const routesSnapshot = await getDocs(collection(db, 'routes'));
      const routesData = routesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as RouteType[];
      setTotalRoutes(routesData.length);
      setTotalStops(routesData.reduce((acc, r) => acc + (r.stops?.length ?? 0), 0));

      const liveBusesSnapshot = await getDocs(collection(db, 'liveBuses'));
      const liveBusesData = liveBusesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as LiveBus[];
      setLiveBuses(liveBusesData);
      setRunningTrips(liveBusesData.length);
      setDelayedBuses(liveBusesData.filter((b) => b.isDelayed).length);
      setTodayTrips(liveBusesData.length);

      try {
        const complaintsSnapshot = await getDocs(collection(db, 'complaints'));
        const complaints = complaintsSnapshot.docs.map((d) => d.data()) as Complaint[];
        setOpenComplaints(complaints.filter((c) => c.status === 'pending' || c.status === 'in_review').length);
      } catch {
        setOpenComplaints(0);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard" subtitle="KMT Municipal Transport Overview">
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Total Buses" value={totalBuses} icon={Bus} description={`${activeBuses} active`} variant="primary" />
        <StatCard title="Active Buses" value={activeBuses} icon={Radio} description="Currently on trip" variant="success" />
        <StatCard title="Running Trips" value={runningTrips} icon={Route} description="Live now" variant="success" />
        <StatCard title="Drivers On Duty" value={driversOnDuty} icon={Users} description={`${totalDrivers} total`} />
        <StatCard title="Routes" value={totalRoutes} icon={Route} description="City routes" />
        <StatCard title="Stops" value={totalStops} icon={MapPin} description="Across all routes" />
        <StatCard title="Delayed Buses" value={delayedBuses} icon={AlertTriangle} description="Needs attention" variant={delayedBuses > 0 ? 'warning' : undefined} />
        <StatCard title="Complaints" value={openComplaints} icon={MessageSquareWarning} description="Open tickets" />
        <StatCard title="Today's Trips" value={todayTrips} icon={Calendar} description="Scheduled today" />
      </div>

      <div className="mt-6 sm:mt-8">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Active Trips</h2>
        <div className="glass-card overflow-hidden">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bus Number</th>
                <th>Driver</th>
                <th className="hidden sm:table-cell">Route</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {liveBuses.length > 0 ? (
                liveBuses.map((bus) => (
                  <tr key={bus.id}>
                    <td className="font-medium">{bus.busNumber}</td>
                    <td className="max-w-[100px] sm:max-w-none truncate">{bus.driverName}</td>
                    <td className="hidden sm:table-cell">{bus.routeName}</td>
                    <td>
                      <span className="status-badge status-running">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        Running
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">
                    No active trips at the moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
