import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { Schedule } from '@/types/admin';
import { toast } from 'sonner';

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'schedules'));
      setSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Schedule[]);
    } catch {
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    toast.info('Bus schedule import', { description: 'Upload a CSV with columns: routeName, busNumber, departureTime, frequency' });
  };

  const handleAddDemo = async () => {
    try {
      await addDoc(collection(db, 'schedules'), {
        routeName: 'Route 1 – Kolhapur City',
        busNumber: 'KMT-001',
        departureTime: '06:30',
        frequency: 'Every 30 min',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        createdAt: Timestamp.now(),
      });
      toast.success('Schedule added');
      await loadData();
    } catch (error) {
      toast.error('Failed to add schedule');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Schedules" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Bus Schedules" subtitle="Manage departure times and frequencies">
      <div className="flex flex-wrap gap-3 mb-6">
        <Button onClick={handleImport} variant="outline">
          <Upload className="h-4 w-4 mr-2" /> Import Schedule (CSV)
        </Button>
        <Button onClick={handleAddDemo}>
          <Plus className="h-4 w-4 mr-2" /> Add Schedule
        </Button>
      </div>

      <div className="glass-card p-4 mb-6">
        <h3 className="font-semibold mb-3">Quick Add</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Route Name</Label>
            <Input placeholder="Route name" disabled />
          </div>
          <div>
            <Label>Bus Number</Label>
            <Input placeholder="KMT-001" disabled />
          </div>
          <div>
            <Label>Departure Time</Label>
            <Input placeholder="06:30" disabled />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Use Import or Add Schedule to manage timetables.</p>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Bus</th>
              <th>Departure</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">No schedules yet. Import or add one.</td>
              </tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.routeName}</td>
                  <td>{s.busNumber}</td>
                  <td>{s.departureTime}</td>
                  <td>{s.frequency ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
