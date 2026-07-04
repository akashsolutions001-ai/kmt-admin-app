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
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Route as RouteType, Stop, CatalogStop } from '@/types/admin';
import { getGoogleMapsUrl } from '@/lib/mapUtils';
import {
  getCatalogStops,
  addCatalogStop,
  updateCatalogStop,
  deleteCatalogStop,
} from '@/lib/stopsCatalog';
import { useStopLocationForm, parseStopFormCoordinates } from '@/hooks/useStopLocationForm';
import { ExternalLink, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Stops() {
  const [catalogStops, setCatalogStops] = useState<CatalogStop[]>([]);
  const [routeStops, setRouteStops] = useState<Stop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<CatalogStop | null>(null);
  const [stopToDelete, setStopToDelete] = useState<CatalogStop | null>(null);

  const {
    formData,
    setFormData,
    isLocating,
    parsedCoords,
    resetForm,
    handleUseCurrentLocation,
    handleMapLinkChange,
    handleCoordinateChange,
  } = useStopLocationForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [catalog, routesSnap] = await Promise.all([
        getCatalogStops(),
        getDocs(collection(db, 'routes')),
      ]);
      setCatalogStops(catalog);

      const routes = routesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as RouteType[];
      const allStops: Stop[] = [];
      routes.forEach((route) => {
        (route.stops ?? []).forEach((stop) => {
          allStops.push({ ...stop, routeId: route.id, routeName: route.name });
        });
      });
      setRouteStops(allStops.sort((a, b) => (a.routeName ?? '').localeCompare(b.routeName ?? '')));
    } catch (error) {
      console.error('Error loading stops:', error);
      toast.error('Failed to load stops');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStop = () => {
    setEditingStop(null);
    resetForm();
    setIsFormOpen(true);
  };

  const handleEditStop = (stop: CatalogStop) => {
    setEditingStop(stop);
    resetForm({
      name: stop.name,
      latitude: stop.latitude?.toString() ?? '',
      longitude: stop.longitude?.toString() ?? '',
      mapLink: stop.mapLink ?? (stop.latitude != null && stop.longitude != null
        ? getGoogleMapsUrl(stop.latitude, stop.longitude)
        : ''),
    });
    setIsFormOpen(true);
  };

  const handleSaveStop = async () => {
    if (!formData.name.trim()) return;

    try {
      const { parsedLat, parsedLng, mapLink } = parseStopFormCoordinates(formData);
      const payload = {
        name: formData.name.trim(),
        ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
        ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
        ...(mapLink ? { mapLink } : {}),
      };

      if (editingStop) {
        await updateCatalogStop(editingStop.id, payload);
        toast.success('Stop updated');
      } else {
        await addCatalogStop(payload);
        toast.success('Stop added to library');
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving stop:', error);
      toast.error('Failed to save stop');
    }
  };

  const handleDeleteStop = (stop: CatalogStop) => {
    setStopToDelete(stop);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!stopToDelete) return;
    try {
      await deleteCatalogStop(stopToDelete.id);
      toast.success('Stop removed from library');
      setIsDeleteOpen(false);
      loadData();
    } catch (error) {
      console.error('Error deleting stop:', error);
      toast.error('Failed to delete stop');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Stops" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Bus Stops"
      subtitle="Manage stop library and view stops on routes"
      actions={
        <Button onClick={handleAddStop} size="sm">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Stop</span>
        </Button>
      }
    >
      <div className="space-y-8">
        {/* Stop Library */}
        <section>
          <h3 className="text-sm font-semibold mb-3">Stop Library</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add stops here once — reuse them when building routes.
          </p>
          <div className="glass-card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Stop Name</th>
                  <th className="hidden md:table-cell">Coordinates</th>
                  <th className="hidden lg:table-cell">Map</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogStops.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No stops in library. Click &quot;Add Stop&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  catalogStops.map((stop) => (
                    <tr key={stop.id}>
                      <td className="font-medium">{stop.name}</td>
                      <td className="hidden md:table-cell text-sm text-muted-foreground">
                        {stop.latitude != null && stop.longitude != null
                          ? `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="hidden lg:table-cell">
                        {(stop.mapLink || (stop.latitude != null && stop.longitude != null)) ? (
                          <a
                            href={stop.mapLink ?? getGoogleMapsUrl(stop.latitude!, stop.longitude!)}
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
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditStop(stop)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteStop(stop)}
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
        </section>

        {/* Stops on routes (existing view) */}
        <section>
          <h3 className="text-sm font-semibold mb-3">Stops on Routes</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Stops currently assigned to routes (manage order in Routes &amp; Stops).
          </p>
          <div className="glass-card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Stop Name</th>
                  <th>Route</th>
                  <th className="hidden sm:table-cell">Order</th>
                  <th className="hidden md:table-cell">Coordinates</th>
                  <th className="hidden lg:table-cell">Map</th>
                </tr>
              </thead>
              <tbody>
                {routeStops.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No stops assigned to routes yet
                    </td>
                  </tr>
                ) : (
                  routeStops.map((stop) => (
                    <tr key={`${stop.routeId}-${stop.id}`}>
                      <td className="font-medium">{stop.name}</td>
                      <td>{stop.routeName}</td>
                      <td className="hidden sm:table-cell">{stop.order}</td>
                      <td className="hidden md:table-cell text-sm text-muted-foreground">
                        {stop.latitude != null && stop.longitude != null
                          ? `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="hidden lg:table-cell">
                        {(stop.mapLink || (stop.latitude != null && stop.longitude != null)) ? (
                          <a
                            href={stop.mapLink ?? getGoogleMapsUrl(stop.latitude!, stop.longitude!)}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStop ? 'Edit Stop' : 'Add Stop to Library'}</DialogTitle>
          </DialogHeader>
          <StopLocationForm
            formData={formData}
            isLocating={isLocating}
            parsedCoords={parsedCoords}
            onNameChange={(name) => setFormData((prev) => ({ ...prev, name }))}
            onCoordinateChange={handleCoordinateChange}
            onMapLinkChange={handleMapLinkChange}
            onUseCurrentLocation={handleUseCurrentLocation}
            nameInputId="catalogStopName"
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveStop} disabled={!formData.name.trim()} className="w-full sm:w-auto">
              {editingStop ? 'Save Changes' : 'Add Stop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Stop"
        description={`Remove "${stopToDelete?.name}" from the stop library? Routes already using this stop will not be affected.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </AdminLayout>
  );
}
