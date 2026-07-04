import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
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
import { StopLocationForm } from '@/components/stops/StopLocationForm';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  MapPin,
  Route as RouteIcon,
  ArrowLeft,
} from 'lucide-react';
import { Route, Stop, CatalogStop } from '@/types/admin';
import { cn } from '@/lib/utils';
import { getGoogleMapsUrl } from '@/lib/mapUtils';
import { getCatalogStops } from '@/lib/stopsCatalog';
import { useStopLocationForm, parseStopFormCoordinates } from '@/hooks/useStopLocationForm';
import { toast } from 'sonner';
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

export default function Routes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isRouteFormOpen, setIsRouteFormOpen] = useState(false);
  const [isStopFormOpen, setIsStopFormOpen] = useState(false);
  const [isDeleteRouteOpen, setIsDeleteRouteOpen] = useState(false);
  const [isDeleteStopOpen, setIsDeleteStopOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [stopToDelete, setStopToDelete] = useState<Stop | null>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  const [routeFormData, setRouteFormData] = useState({ name: '', startingPoint: '' });
  const [catalogStops, setCatalogStops] = useState<CatalogStop[]>([]);
  const [stopAddMode, setStopAddMode] = useState<'new' | 'library'>('new');
  const [selectedCatalogStopId, setSelectedCatalogStopId] = useState('');

  const {
    formData: stopFormData,
    setFormData: setStopFormData,
    isLocating,
    parsedCoords: parsedStopCoords,
    resetForm: resetStopForm,
    handleUseCurrentLocation,
    handleMapLinkChange,
    handleCoordinateChange,
  } = useStopLocationForm();

  // Load data from Firestore
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [routesSnapshot, catalog] = await Promise.all([
        getDocs(query(collection(db, 'routes'), orderBy('name'))),
        getCatalogStops(),
      ]);
      const routesData = routesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Route[];
      setRoutes(routesData);
      setCatalogStops(catalog);
      if (routesData.length > 0 && !selectedRouteId) {
        setSelectedRouteId(routesData[0].id);
        setShowRouteDetails(true);
      }
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoute = routes.find(r => r.id === selectedRouteId);

  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setShowRouteDetails(true);
  };

  const handleBackToList = () => {
    setShowRouteDetails(false);
  };

  const handleAddRoute = () => {
    setEditingRoute(null);
    setRouteFormData({ name: '', startingPoint: '' });
    setIsRouteFormOpen(true);
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setRouteFormData({ name: route.name, startingPoint: route.startingPoint });
    setIsRouteFormOpen(true);
  };

  const handleDeleteRoute = () => {
    setIsDeleteRouteOpen(true);
  };

  const handleSaveRoute = async () => {
    try {
      if (editingRoute) {
        // Update existing route
        const routeRef = doc(db, 'routes', editingRoute.id);
        await updateDoc(routeRef, {
          name: routeFormData.name,
          startingPoint: routeFormData.startingPoint,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Add new route
        const newRouteRef = await addDoc(collection(db, 'routes'), {
          name: routeFormData.name,
          startingPoint: routeFormData.startingPoint,
          stops: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        setSelectedRouteId(newRouteRef.id);
        setShowRouteDetails(true);
      }
      setIsRouteFormOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving route:', error);
    }
  };

  const confirmDeleteRoute = async () => {
    if (selectedRoute) {
      try {
        const routeRef = doc(db, 'routes', selectedRoute.id);
        await deleteDoc(routeRef);
        const newRoutes = routes.filter(r => r.id !== selectedRoute.id);
        setSelectedRouteId(newRoutes[0]?.id || null);
        setShowRouteDetails(false);
        loadData();
      } catch (error) {
        console.error('Error deleting route:', error);
      }
    }
    setIsDeleteRouteOpen(false);
  };

  // Stop management
  const handleAddStop = () => {
    setEditingStop(null);
    setStopAddMode('new');
    setSelectedCatalogStopId('');
    resetStopForm();
    setIsStopFormOpen(true);
  };

  const handleEditStop = (stop: Stop) => {
    setEditingStop(stop);
    setStopAddMode('new');
    const lat = stop.latitude?.toString() || '';
    const lng = stop.longitude?.toString() || '';
    resetStopForm({
      name: stop.name,
      latitude: lat,
      longitude: lng,
      mapLink: stop.mapLink || (lat && lng ? getGoogleMapsUrl(parseFloat(lat), parseFloat(lng)) : ''),
    });
    setIsStopFormOpen(true);
  };

  const handleAddFromLibrary = async () => {
    if (!selectedRoute || !selectedCatalogStopId) return;

    const catalogStop = catalogStops.find((s) => s.id === selectedCatalogStopId);
    if (!catalogStop) return;

    const alreadyOnRoute = selectedRoute.stops.some(
      (s) => s.catalogStopId === catalogStop.id || s.name === catalogStop.name
    );
    if (alreadyOnRoute) {
      toast.error('This stop is already on the route');
      return;
    }

    try {
      const newStop: Stop = {
        id: `${selectedRoute.id}-${Date.now()}`,
        name: catalogStop.name,
        order: selectedRoute.stops.length + 1,
        catalogStopId: catalogStop.id,
        ...(catalogStop.latitude != null ? { latitude: catalogStop.latitude } : {}),
        ...(catalogStop.longitude != null ? { longitude: catalogStop.longitude } : {}),
        ...(catalogStop.mapLink ? { mapLink: catalogStop.mapLink } : {}),
      };

      const routeRef = doc(db, 'routes', selectedRoute.id);
      await updateDoc(routeRef, {
        stops: [...selectedRoute.stops, newStop],
        updatedAt: Timestamp.now(),
      });
      setIsStopFormOpen(false);
      toast.success(`"${catalogStop.name}" added to route`);
      loadData();
    } catch (error) {
      console.error('Error adding stop from library:', error);
      toast.error('Failed to add stop from library');
    }
  };

  const handleDeleteStop = (stop: Stop) => {
    setStopToDelete(stop);
    setIsDeleteStopOpen(true);
  };

  const handleSaveStop = async () => {
    if (!selectedRoute) return;

    try {
      let updatedStops: Stop[];
      const { parsedLat, parsedLng, mapLink } = parseStopFormCoordinates(stopFormData);

      if (editingStop) {
        updatedStops = selectedRoute.stops.map(s =>
          s.id === editingStop.id
            ? {
              ...s,
              name: stopFormData.name,
              ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
              ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
              ...(mapLink ? { mapLink } : {}),
            }
            : s
        );
      } else {
        const newStop: Stop = {
          id: `${selectedRoute.id}-${Date.now()}`,
          name: stopFormData.name,
          order: selectedRoute.stops.length + 1,
          ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
          ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
          ...(mapLink ? { mapLink } : {}),
        };
        updatedStops = [...selectedRoute.stops, newStop];
      }

      const routeRef = doc(db, 'routes', selectedRoute.id);
      await updateDoc(routeRef, {
        stops: updatedStops,
        updatedAt: Timestamp.now(),
      });
      setIsStopFormOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving stop:', error);
    }
  };

  const confirmDeleteStop = async () => {
    if (!selectedRoute || !stopToDelete) return;

    try {
      const updatedStops = selectedRoute.stops
        .filter(s => s.id !== stopToDelete.id)
        .map((s, index) => ({ ...s, order: index + 1 }));

      const routeRef = doc(db, 'routes', selectedRoute.id);
      await updateDoc(routeRef, {
        stops: updatedStops,
        updatedAt: Timestamp.now(),
      });
      setIsDeleteStopOpen(false);
      loadData();
    } catch (error) {
      console.error('Error deleting stop:', error);
    }
  };

  const moveStop = async (stopId: string, direction: 'up' | 'down') => {
    if (!selectedRoute) return;

    try {
      const stops = [...selectedRoute.stops];
      const index = stops.findIndex(s => s.id === stopId);

      if (direction === 'up' && index > 0) {
        [stops[index - 1], stops[index]] = [stops[index], stops[index - 1]];
      } else if (direction === 'down' && index < stops.length - 1) {
        [stops[index], stops[index + 1]] = [stops[index + 1], stops[index]];
      }

      const reorderedStops = stops.map((s, i) => ({ ...s, order: i + 1 }));

      const routeRef = doc(db, 'routes', selectedRoute.id);
      await updateDoc(routeRef, {
        stops: reorderedStops,
        updatedAt: Timestamp.now(),
      });
      loadData();
    } catch (error) {
      console.error('Error moving stop:', error);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Routes & Stops" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Routes & Stops"
      subtitle="Define how buses move in the real world"
      actions={
        <Button onClick={handleAddRoute} size="sm" className="sm:size-default">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Route</span>
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Mobile: Route List (hidden when viewing details) */}
        <div className={cn(
          "lg:col-span-4",
          showRouteDetails && "hidden lg:block"
        )}>
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-medium">Routes ({routes.length})</h3>
            </div>
            <div className="divide-y max-h-[60vh] lg:max-h-[calc(100vh-220px)] overflow-y-auto">
              {routes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => handleSelectRoute(route.id)}
                  className={cn(
                    'w-full px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    selectedRouteId === route.id && 'bg-muted'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
                      selectedRouteId === route.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      <RouteIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{route.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {route.stops.length} stops
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {routes.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No routes created yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Route Details (Mobile: full screen, Desktop: side panel) */}
        <div className={cn(
          "lg:col-span-8",
          !showRouteDetails && "hidden lg:block"
        )}>
          {selectedRoute ? (
            <div className="space-y-4 lg:space-y-6">
              {/* Mobile Back Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
                className="lg:hidden -ml-2 mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Routes
              </Button>

              {/* Route Info */}
              <div className="rounded-lg border bg-card p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-heading text-base lg:text-lg font-semibold truncate">{selectedRoute.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground flex items-center">
                      <MapPin className="mr-1 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Starting Point: {selectedRoute.startingPoint}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleEditRoute(selectedRoute)}>
                      <Pencil className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteRoute} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stops List */}
              <div className="rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-sm font-medium">Stops ({selectedRoute.stops.length})</h3>
                  <Button size="sm" onClick={handleAddStop}>
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Stop</span>
                  </Button>
                </div>
                <div className="divide-y max-h-[50vh] lg:max-h-none overflow-y-auto">
                  {selectedRoute.stops.map((stop, index) => (
                    <div key={stop.id} className="flex items-center justify-between px-3 sm:px-4 py-3 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-xs sm:text-sm font-medium text-primary-foreground flex-shrink-0">
                          {stop.order}
                        </span>
                        <span className="text-sm truncate">{stop.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveStop(stop.id, 'up')}
                          disabled={index === 0}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveStop(stop.id, 'down')}
                          disabled={index === selectedRoute.stops.length - 1}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditStop(stop)} className="h-8 w-8 p-0">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStop(stop)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {selectedRoute.stops.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No stops added yet. Click "Add Stop" to create one.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-48 lg:h-64 items-center justify-center rounded-lg border bg-card">
              <p className="text-muted-foreground text-sm">Select a route to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Route Form Dialog */}
      <Dialog open={isRouteFormOpen} onOpenChange={setIsRouteFormOpen}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingRoute ? 'Edit Route' : 'Add New Route'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingRoute ? 'Edit the selected route details' : 'Create a new route for the bus system'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="routeName">Route Name</Label>
              <Input
                id="routeName"
                value={routeFormData.name}
                onChange={(e) => setRouteFormData({ ...routeFormData, name: e.target.value })}
                placeholder="e.g., Route D - West Campus"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startingPoint">Starting Point</Label>
              <Input
                id="startingPoint"
                value={routeFormData.startingPoint}
                onChange={(e) => setRouteFormData({ ...routeFormData, startingPoint: e.target.value })}
                placeholder="e.g., College Parking"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsRouteFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveRoute} disabled={!routeFormData.name || !routeFormData.startingPoint} className="w-full sm:w-auto">
              {editingRoute ? 'Save Changes' : 'Create Route'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop Form Dialog */}
      <Dialog open={isStopFormOpen} onOpenChange={setIsStopFormOpen}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingStop ? 'Edit Stop' : 'Add New Stop'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingStop ? 'Edit the selected stop details' : 'Add a new stop to this route'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingStop && (
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button
                  type="button"
                  variant={stopAddMode === 'new' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setStopAddMode('new')}
                >
                  Create New
                </Button>
                <Button
                  type="button"
                  variant={stopAddMode === 'library' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setStopAddMode('library')}
                >
                  From Library
                </Button>
              </div>
            )}

            {!editingStop && stopAddMode === 'library' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select stop from library</Label>
                  <Select value={selectedCatalogStopId || undefined} onValueChange={setSelectedCatalogStopId}>
                    <SelectTrigger>
                      <SelectValue placeholder={catalogStops.length === 0 ? 'No stops in library' : 'Choose a saved stop...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogStops.map((stop) => (
                        <SelectItem key={stop.id} value={stop.id}>
                          {stop.name}
                          {stop.latitude != null && stop.longitude != null
                            ? ` (${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)})`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Stops are managed in the Stops section. Pick one to add to this route.
                  </p>
                </div>
              </div>
            ) : (
              <StopLocationForm
                formData={stopFormData}
                isLocating={isLocating}
                parsedCoords={parsedStopCoords}
                onNameChange={(name) => setStopFormData((prev) => ({ ...prev, name }))}
                onCoordinateChange={handleCoordinateChange}
                onMapLinkChange={handleMapLinkChange}
                onUseCurrentLocation={handleUseCurrentLocation}
                nameInputId="routeStopName"
              />
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsStopFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            {!editingStop && stopAddMode === 'library' ? (
              <Button
                onClick={handleAddFromLibrary}
                disabled={!selectedCatalogStopId || catalogStops.length === 0}
                className="w-full sm:w-auto"
              >
                Add to Route
              </Button>
            ) : (
              <Button onClick={handleSaveStop} disabled={!stopFormData.name} className="w-full sm:w-auto">
                {editingStop ? 'Save Changes' : 'Add Stop'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Route Confirmation */}
      <ConfirmDialog
        open={isDeleteRouteOpen}
        onOpenChange={setIsDeleteRouteOpen}
        title="Delete Route"
        description={`Are you sure you want to delete "${selectedRoute?.name}"? This will also delete all ${selectedRoute?.stops.length || 0} stops. This action cannot be undone.`}
        confirmLabel="Delete Route"
        onConfirm={confirmDeleteRoute}
        variant="destructive"
      />

      {/* Delete Stop Confirmation */}
      <ConfirmDialog
        open={isDeleteStopOpen}
        onOpenChange={setIsDeleteStopOpen}
        title="Delete Stop"
        description={`Are you sure you want to delete "${stopToDelete?.name}"? The remaining stops will be reordered automatically.`}
        confirmLabel="Delete Stop"
        onConfirm={confirmDeleteStop}
        variant="destructive"
      />
    </AdminLayout>
  );
}
