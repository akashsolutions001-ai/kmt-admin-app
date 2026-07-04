import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Route, TrendingUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Passenger, Route as RouteType } from '@/types/admin';

export default function Passengers() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [passengersSnap, routesSnap] = await Promise.all([
        getDocs(collection(db, 'passengers')),
        getDocs(collection(db, 'routes')),
      ]);
      setPassengers(passengersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Passenger[]);
      setRoutes(routesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as RouteType[]);
    } catch (error) {
      console.error('Error loading passengers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activePassengers = passengers.filter((p) => p.status !== 'inactive');
  const routeUsage = routes.map((route) => ({
    name: route.name,
    count: passengers.filter((p) => p.routeId === route.id || p.routeName === route.name).length,
  }));

  if (isLoading) {
    return (
      <AdminLayout title="Passengers" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Passengers" subtitle="Passenger analytics and registered users">
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Passengers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-3xl font-bold">{passengers.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Passengers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <span className="text-3xl font-bold">{activePassengers.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Popular Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5 text-secondary" />
              <span className="text-3xl font-bold">{routeUsage.filter((r) => r.count > 0).length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-4">
          <h3 className="font-semibold mb-4">Route Usage</h3>
          {routeUsage.length === 0 ? (
            <p className="text-muted-foreground text-sm">No route data available</p>
          ) : (
            <ul className="space-y-2">
              {routeUsage.map((r) => (
                <li key={r.name} className="flex justify-between text-sm">
                  <span className="truncate">{r.name}</span>
                  <span className="font-medium">{r.count} passengers</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card overflow-x-auto">
          <h3 className="font-semibold p-4 border-b">Registered Passengers</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden sm:table-cell">Phone</th>
                <th className="hidden sm:table-cell">Route</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {passengers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">
                    No registered passengers yet
                  </td>
                </tr>
              ) : (
                passengers.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td className="hidden sm:table-cell">{p.phone ?? '—'}</td>
                    <td className="hidden sm:table-cell truncate max-w-[120px]">{p.routeName ?? '—'}</td>
                    <td>
                      <span className={p.status === 'active' ? 'text-success' : 'text-muted-foreground'}>
                        {p.status ?? 'active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
