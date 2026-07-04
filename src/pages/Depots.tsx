import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { Depot } from '@/types/admin';
import { toast } from 'sonner';

export default function Depots() {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'depots'));
      setDepots(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Depot[]);
    } catch {
      setDepots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !address.trim()) {
      toast.error('Name and address are required');
      return;
    }
    try {
      await addDoc(collection(db, 'depots'), {
        name: name.trim(),
        address: address.trim(),
        busCount: 0,
        createdAt: Timestamp.now(),
      });
      setName('');
      setAddress('');
      toast.success('Depot added');
      await loadData();
    } catch {
      toast.error('Failed to add depot');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Depots" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Depots" subtitle="KMT bus depots and yards">
      <div className="glass-card p-4 sm:p-6 mb-6">
        <h3 className="font-semibold mb-4">Add Depot</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Depot Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Central Depot" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Kolhapur, Maharashtra" />
          </div>
        </div>
        <Button className="mt-4" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Depot
        </Button>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Buses</th>
            </tr>
          </thead>
          <tbody>
            {depots.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-8 text-muted-foreground">No depots configured</td>
              </tr>
            ) : (
              depots.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.name}</td>
                  <td>{d.address}</td>
                  <td>{d.busCount ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
