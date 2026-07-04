import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Phone } from 'lucide-react';
import { Driver, DriverStatus, Bus } from '@/types/admin';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    driverId: '',
    phone: '',
    status: 'active' as DriverStatus,
    password: '',
  });

  // Load data from Firestore
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load drivers
      const driversSnapshot = await getDocs(query(collection(db, 'drivers'), orderBy('name')));
      const driversData = driversSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Driver[];
      setDrivers(driversData);

      // Load buses
      const busesSnapshot = await getDocs(query(collection(db, 'buses'), orderBy('busNumber')));
      const busesData = busesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Bus[];
      setBuses(busesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getBusNumber = (busId: string | null) => {
    if (!busId) return '—';
    const bus = buses.find(b => b.id === busId);
    return bus?.busNumber || '—';
  };

  const isDriverOnRunningBus = (driver: Driver) => {
    if (!driver.assignedBusId) return false;
    const bus = buses.find(b => b.id === driver.assignedBusId);
    return bus?.status === 'running';
  };

  const handleAdd = () => {
    setSelectedDriver(null);
    setFormData({ name: '', driverId: '', phone: '', status: 'active', password: '' });
    setIsFormOpen(true);
  };

  const handleEdit = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name,
      driverId: driver.driverId,
      phone: driver.phone || '',
      status: driver.status,
      password: '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = (driver: Driver) => {
    setSelectedDriver(driver);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    try {
      if (selectedDriver) {
        // Update existing driver
        const driverRef = doc(db, 'drivers', selectedDriver.id);
        const updateData: Partial<Driver> = {
          name: formData.name,
          driverId: formData.driverId,
          phone: formData.phone,
          status: formData.status,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await updateDoc(driverRef, {
          ...updateData,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Add new driver
        await addDoc(collection(db, 'drivers'), {
          name: formData.name,
          driverId: formData.driverId,
          phone: formData.phone,
          password: formData.password,
          assignedBusId: null,
          status: formData.status,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving driver:', error);
    }
  };

  const confirmDelete = async () => {
    if (selectedDriver) {
      try {
        const driverRef = doc(db, 'drivers', selectedDriver.id);
        await deleteDoc(driverRef);
        setIsDeleteOpen(false);
        loadData();
      } catch (error) {
        console.error('Error deleting driver:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Drivers Management" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Drivers Management"
      subtitle="Manage drivers who will log in"
      actions={
        <Button onClick={handleAdd} size="sm" className="sm:size-default">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Driver</span>
        </Button>
      }
    >
      {/* Desktop Table View */}
      <div className="hidden sm:block table-wrapper overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Driver Name</th>
              <th>Driver ID</th>
              <th className="hidden md:table-cell">Phone</th>
              <th className="hidden lg:table-cell">Assigned Bus</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <td className="font-medium">{driver.name}</td>
                <td>{driver.driverId}</td>
                <td className="hidden md:table-cell">{driver.phone || '—'}</td>
                <td className="hidden lg:table-cell">{getBusNumber(driver.assignedBusId)}</td>
                <td>
                  <StatusBadge status={driver.status} />
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(driver)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(driver)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  No drivers added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {drivers.map((driver) => (
          <div key={driver.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="font-medium text-sm">{driver.name}</h3>
                  <StatusBadge status={driver.status} />
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-mono">{driver.driverId}</p>
                  {driver.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      {driver.phone}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-foreground">Bus:</span> {getBusNumber(driver.assignedBusId)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(driver)} className="h-8 w-8 p-0">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(driver)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {drivers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">No drivers added yet</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {selectedDriver ? 'Edit Driver' : 'Add New Driver'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {selectedDriver ? 'Edit the selected driver details' : 'Add a new driver to the system'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Driver Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Rajesh Kumar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverId">Driver ID</Label>
              <Input
                id="driverId"
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                placeholder="e.g., DRV-006"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g., +91 98765 43210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {selectedDriver ? 'Reset Password' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={selectedDriver ? 'Leave blank to keep current' : 'Enter password'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as DriverStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.driverId || (!selectedDriver && !formData.password)} className="w-full sm:w-auto">
              {selectedDriver ? 'Save Changes' : 'Add Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Driver"
        description={
          selectedDriver && isDriverOnRunningBus(selectedDriver)
            ? `Warning: ${selectedDriver.name} is currently assigned to a running bus. Are you sure you want to delete this driver? This action cannot be undone.`
            : `Are you sure you want to delete ${selectedDriver?.name}? This action cannot be undone.`
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </AdminLayout>
  );
}
