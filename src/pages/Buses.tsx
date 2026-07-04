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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Bus, BusStatus, Driver, Route } from '@/types/admin';
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

export default function Buses() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [formData, setFormData] = useState({
    busNumber: '',
    assignedDriverId: '',
    assignedRouteId: '',
    status: 'idle' as BusStatus,
  });

  // Load data from Firestore
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load buses
      const busesSnapshot = await getDocs(query(collection(db, 'buses'), orderBy('busNumber')));
      const busesData = busesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Bus[];
      setBuses(busesData);

      // Load drivers
      const driversSnapshot = await getDocs(query(collection(db, 'drivers'), orderBy('name')));
      const driversData = driversSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Driver[];
      setDrivers(driversData);

      // Load routes
      const routesSnapshot = await getDocs(query(collection(db, 'routes'), orderBy('name')));
      const routesData = routesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Route[];
      setRoutes(routesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const availableDrivers = drivers.filter(d => d.status === 'active');
  const availableRoutes = routes;

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return '—';
    const driver = availableDrivers.find(d => d.id === driverId);
    return driver?.name || '—';
  };

  const getRouteName = (routeId: string | null) => {
    if (!routeId) return '—';
    const route = availableRoutes.find(r => r.id === routeId);
    return route?.name || '—';
  };

  const handleAdd = () => {
    setSelectedBus(null);
    setFormData({ busNumber: '', assignedDriverId: 'none', assignedRouteId: 'none', status: 'idle' });
    setIsFormOpen(true);
  };

  const handleEdit = (bus: Bus) => {
    setSelectedBus(bus);
    setFormData({
      busNumber: bus.busNumber,
      assignedDriverId: bus.assignedDriverId || 'none',
      assignedRouteId: bus.assignedRouteId || 'none',
      status: bus.status,
    });
    setIsFormOpen(true);
  };

  const handleDelete = (bus: Bus) => {
    setSelectedBus(bus);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    try {
      const driverId = formData.assignedDriverId === 'none' ? null : formData.assignedDriverId;
      const routeId = formData.assignedRouteId === 'none' ? null : formData.assignedRouteId;

      if (selectedBus) {
        // Update existing bus
        const busRef = doc(db, 'buses', selectedBus.id);
        
        // Handle bidirectional driver-bus relationship
        const oldDriverId = selectedBus.assignedDriverId;
        const newDriverId = driverId;

        // If driver assignment changed, update both bus and driver documents
        if (oldDriverId !== newDriverId) {
          // Clear old driver's assignedBusId if it was assigned to this bus
          if (oldDriverId) {
            const oldDriverRef = doc(db, 'drivers', oldDriverId);
            await updateDoc(oldDriverRef, {
              assignedBusId: null,
              updatedAt: Timestamp.now(),
            });
          }

          // Set new driver's assignedBusId
          if (newDriverId) {
            const newDriverRef = doc(db, 'drivers', newDriverId);
            await updateDoc(newDriverRef, {
              assignedBusId: selectedBus.id,
              updatedAt: Timestamp.now(),
            });
          }
        }

        // Update bus document
        await updateDoc(busRef, {
          busNumber: formData.busNumber,
          assignedDriverId: driverId,
          assignedRouteId: routeId,
          status: formData.status,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Add new bus
        const newBusRef = await addDoc(collection(db, 'buses'), {
          busNumber: formData.busNumber,
          assignedDriverId: driverId,
          assignedRouteId: routeId,
          status: formData.status,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // Set driver's assignedBusId if driver is assigned
        if (driverId) {
          const driverRef = doc(db, 'drivers', driverId);
          await updateDoc(driverRef, {
            assignedBusId: newBusRef.id,
            updatedAt: Timestamp.now(),
          });
        }
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving bus:', error);
    }
  };

  const confirmDelete = async () => {
    if (selectedBus) {
      try {
        // Clear driver's assignedBusId if driver is assigned to this bus
        if (selectedBus.assignedDriverId) {
          const driverRef = doc(db, 'drivers', selectedBus.assignedDriverId);
          await updateDoc(driverRef, {
            assignedBusId: null,
            updatedAt: Timestamp.now(),
          });
        }

        // Delete bus document
        const busRef = doc(db, 'buses', selectedBus.id);
        await deleteDoc(busRef);
        setIsDeleteOpen(false);
        loadData();
      } catch (error) {
        console.error('Error deleting bus:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Buses Management" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Buses Management"
      subtitle="Manage physical buses and assignments"
      actions={
        <Button onClick={handleAdd} size="sm" className="sm:size-default">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Bus</span>
        </Button>
      }
    >
      {/* Desktop Table View */}
      <div className="hidden sm:block table-wrapper overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Bus Number</th>
              <th>Assigned Driver</th>
              <th className="hidden md:table-cell">Assigned Route</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => (
              <tr key={bus.id}>
                <td className="font-medium">{bus.busNumber}</td>
                <td className="max-w-[120px] truncate">{getDriverName(bus.assignedDriverId)}</td>
                <td className="hidden md:table-cell max-w-[150px] truncate">{getRouteName(bus.assignedRouteId)}</td>
                <td>
                  <StatusBadge status={bus.status} />
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(bus)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(bus)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {buses.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  No buses added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {buses.map((bus) => (
          <div key={bus.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-sm">{bus.busNumber}</h3>
                  <StatusBadge status={bus.status} />
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="truncate">
                    <span className="font-medium text-foreground">Driver:</span> {getDriverName(bus.assignedDriverId)}
                  </p>
                  <p className="truncate">
                    <span className="font-medium text-foreground">Route:</span> {getRouteName(bus.assignedRouteId)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(bus)} className="h-8 w-8 p-0">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(bus)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {buses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">No buses added yet</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {selectedBus ? 'Edit Bus' : 'Add New Bus'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {selectedBus ? 'Edit the selected bus details' : 'Add a new bus to the system'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="busNumber">Bus Number</Label>
              <Input
                id="busNumber"
                value={formData.busNumber}
                onChange={(e) => setFormData({ ...formData, busNumber: e.target.value })}
                placeholder="e.g., BUS-006"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver">Assign Driver</Label>
              <Select
                value={formData.assignedDriverId}
                onValueChange={(value) => setFormData({ ...formData, assignedDriverId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No driver assigned</SelectItem>
                  {availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} ({driver.driverId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="route">Assign Route</Label>
              <Select
                value={formData.assignedRouteId}
                onValueChange={(value) => setFormData({ ...formData, assignedRouteId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No route assigned</SelectItem>
                  {availableRoutes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as BusStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.busNumber} className="w-full sm:w-auto">
              {selectedBus ? 'Save Changes' : 'Add Bus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Bus"
        description={`Are you sure you want to delete ${selectedBus?.busNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </AdminLayout>
  );
}
