import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StopLocationForm } from '@/components/stops/StopLocationForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Depot } from '@/types/admin';
import { getGoogleMapsUrl } from '@/lib/mapUtils';
import {
  getDepots,
  addDepot,
  updateDepot,
  deleteDepot,
} from '@/lib/depotsCatalog';
import { useStopLocationForm, parseStopFormCoordinates } from '@/hooks/useStopLocationForm';
import { ExternalLink, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Depots() {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingDepot, setEditingDepot] = useState<Depot | null>(null);
  const [depotToDelete, setDepotToDelete] = useState<Depot | null>(null);
  const [address, setAddress] = useState('');

  const {
    formData,
    setFormData,
    isLocating,
    parsedCoords,
    resetForm,
    handleUseCurrentLocation,
    handleCoordinateChange,
  } = useStopLocationForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getDepots();
      setDepots(data);
    } catch (error) {
      console.error('Error loading depots:', error);
      toast.error('Failed to load depots');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDepot = () => {
    setEditingDepot(null);
    setAddress('');
    resetForm();
    setIsFormOpen(true);
  };

  const handleEditDepot = (depot: Depot) => {
    setEditingDepot(depot);
    setAddress(depot.address || '');
    resetForm({
      name: depot.name,
      latitude: depot.latitude?.toString() ?? '',
      longitude: depot.longitude?.toString() ?? '',
    });
    setIsFormOpen(true);
  };

  const handleSaveDepot = async () => {
    if (!formData.name.trim()) {
      toast.error('Depot name is required');
      return;
    }

    try {
      const { parsedLat, parsedLng } = parseStopFormCoordinates(formData);
      const payload: Partial<Depot> = {
        name: formData.name.trim(),
        address: address.trim(),
        ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
        ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
      };

      if (editingDepot) {
        await updateDepot(editingDepot.id, payload);
        toast.success('Depot updated');
      } else {
        await addDepot(payload as Omit<Depot, 'id' | 'createdAt' | 'updatedAt'>);
        toast.success('Depot added');
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving depot:', error);
      toast.error('Failed to save depot');
    }
  };

  const handleDeleteDepot = (depot: Depot) => {
    setDepotToDelete(depot);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!depotToDelete) return;
    try {
      await deleteDepot(depotToDelete.id);
      toast.success('Depot deleted');
      setIsDeleteOpen(false);
      loadData();
    } catch (error) {
      console.error('Error deleting depot:', error);
      toast.error('Failed to delete depot');
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
    <AdminLayout 
      title="Depots" 
      subtitle="KMT bus depots and yards"
      actions={
        <Button onClick={handleAddDepot} size="sm">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Depot</span>
        </Button>
      }
    >
      <div className="glass-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Buses</th>
              <th className="hidden md:table-cell">Coordinates</th>
              <th className="hidden lg:table-cell">Map</th>
              <th className="w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {depots.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  No depots configured. Click &quot;Add Depot&quot; to create one.
                </td>
              </tr>
            ) : (
              depots.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.name}</td>
                  <td>{d.address}</td>
                  <td>{d.busCount ?? 0}</td>
                  <td className="hidden md:table-cell text-sm text-muted-foreground">
                    {d.latitude != null && d.longitude != null
                      ? `${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}`
                      : '—'}
                  </td>
                  <td className="hidden lg:table-cell">
                    {d.latitude != null && d.longitude != null ? (
                      <a
                        href={getGoogleMapsUrl(d.latitude, d.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditDepot(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteDepot(d)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDepot ? 'Edit Depot' : 'Add Depot'}</DialogTitle>
          </DialogHeader>
          <StopLocationForm
            formData={formData}
            isLocating={isLocating}
            parsedCoords={parsedCoords}
            onNameChange={(name) => setFormData((prev) => ({ ...prev, name }))}
            onCoordinateChange={handleCoordinateChange}
            onUseCurrentLocation={handleUseCurrentLocation}
            nameInputId="depotName"
            nameLabel="Depot Name"
          />
          <div className="space-y-2">
            <label htmlFor="depotAddress" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Address
            </label>
            <input
              id="depotAddress"
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., Kolhapur, Maharashtra"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveDepot} disabled={!formData.name.trim()} className="w-full sm:w-auto">
              {editingDepot ? 'Save Changes' : 'Add Depot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Depot"
        description={`Are you sure you want to delete "${depotToDelete?.name}"?`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </AdminLayout>
  );
}
