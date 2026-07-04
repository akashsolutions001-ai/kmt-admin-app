import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bus, Users, Route, MessageSquareWarning, Radio } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Reports() {
  const [stats, setStats] = useState({
    buses: 0, drivers: 0, routes: 0, liveTrips: 0, complaints: 0, passengers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [buses, drivers, routes, live, complaints, passengers] = await Promise.all([
        getDocs(collection(db, 'buses')),
        getDocs(collection(db, 'drivers')),
        getDocs(collection(db, 'routes')),
        getDocs(collection(db, 'liveBuses')),
        getDocs(collection(db, 'complaints')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'passengers')).catch(() => ({ size: 0 })),
      ]);
      setStats({
        buses: buses.size,
        drivers: drivers.size,
        routes: routes.size,
        liveTrips: live.size,
        complaints: 'size' in complaints ? complaints.size : 0,
        passengers: 'size' in passengers ? passengers.size : 0,
      });
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Reports" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  const items = [
    { label: 'Total Buses', value: stats.buses, icon: Bus },
    { label: 'Drivers', value: stats.drivers, icon: Users },
    { label: 'Routes', value: stats.routes, icon: Route },
    { label: 'Live Trips', value: stats.liveTrips, icon: Radio },
    { label: 'Passengers', value: stats.passengers, icon: Users },
    { label: 'Complaints', value: stats.complaints, icon: MessageSquareWarning },
  ];

  return (
    <AdminLayout title="Reports" subtitle="Operational summary for KMT">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.label} className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <item.icon className="h-6 w-6 text-primary" />
                <span className="text-3xl font-bold">{item.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="glass-card p-6 mt-6">
        <h3 className="font-semibold mb-2">KMT Operations Report</h3>
        <p className="text-sm text-muted-foreground">
          This report summarizes fleet size, active trips, registered passengers, and open complaints.
          Export and detailed analytics can be extended from this dashboard.
        </p>
      </div>
    </AdminLayout>
  );
}
