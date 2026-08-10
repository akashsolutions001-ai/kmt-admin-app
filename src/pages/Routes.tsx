import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  DatabaseZap,
  Search,
} from 'lucide-react';
import { Route, Stop, CatalogStop } from '@/types/admin';
import { cn } from '@/lib/utils';
import { areCoordinatesWithinDistance } from '@/lib/mapUtils';
import { getCatalogStops, addCatalogStop, updateCatalogStop, findNearbyCatalogStop } from '@/lib/stopsCatalog';
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

type PendingReorderAction =
  | { type: 'move'; stopIds: string[]; direction: 'up' | 'down'; description: string }
  | { type: 'serial'; stopIds: string[]; targetOrder: number; description: string };

function reorderStopsByPosition(stops: Stop[], stopIds: string[], targetOrder: number): Stop[] {
  const selectedSet = new Set(stopIds);
  const selected = stops.filter((stop) => selectedSet.has(stop.id));
  if (selected.length === 0) return stops;

  const remaining = stops.filter((stop) => !selectedSet.has(stop.id));
  const insertIndex = Math.max(0, Math.min(targetOrder - 1, remaining.length));
  const reordered = [...remaining];
  reordered.splice(insertIndex, 0, ...selected);
  return reordered.map((stop, index) => ({ ...stop, order: index + 1 }));
}

function moveStopsInDirection(
  stops: Stop[],
  stopIds: string[],
  direction: 'up' | 'down'
): Stop[] | null {
  const selectedSet = new Set(stopIds);
  const indices = stops
    .map((stop, index) => (selectedSet.has(stop.id) ? index : -1))
    .filter((index) => index >= 0);

  if (indices.length === 0) return null;

  const firstIndex = Math.min(...indices);
  const lastIndex = Math.max(...indices);

  if (direction === 'up' && firstIndex === 0) return null;
  if (direction === 'down' && lastIndex === stops.length - 1) return null;

  const nextStops = [...stops];
  const selectedBlock = nextStops.splice(firstIndex, indices.length);

  if (direction === 'up') {
    nextStops.splice(firstIndex - 1, 0, ...selectedBlock);
  } else {
    nextStops.splice(firstIndex + 1, 0, ...selectedBlock);
  }

  return nextStops.map((stop, index) => ({ ...stop, order: index + 1 }));
}

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
  const [isMigrating, setIsMigrating] = useState(false);

  const [routeFormData, setRouteFormData] = useState({ name: '', startingPoint: '' });
  const [catalogStops, setCatalogStops] = useState<CatalogStop[]>([]);
  const [stopAddMode, setStopAddMode] = useState<'new' | 'library'>('new');
  const [selectedCatalogStopIds, setSelectedCatalogStopIds] = useState<string[]>([]);
  const [stopSearchQuery, setStopSearchQuery] = useState('');
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
  const [editingOrderStopId, setEditingOrderStopId] = useState<string | null>(null);
  const [orderInputValue, setOrderInputValue] = useState('');
  const [isReorderConfirmOpen, setIsReorderConfirmOpen] = useState(false);
  const [pendingReorder, setPendingReorder] = useState<PendingReorderAction | null>(null);

  const {
    formData: stopFormData,
    setFormData: setStopFormData,
    isLocating,
    parsedCoords: parsedStopCoords,
    resetForm: resetStopForm,
    handleUseCurrentLocation,
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

  const matchedCatalogStop = useMemo(() => {
    if (stopAddMode === 'library' && !editingStop) return null;
    const { parsedLat, parsedLng } = parseStopFormCoordinates(stopFormData);
    return findNearbyCatalogStop(
      catalogStops.filter((stop) => stop.id !== editingStop?.catalogStopId),
      parsedLat,
      parsedLng
    ) ?? null;
  }, [stopFormData, catalogStops, editingStop, stopAddMode]);

  useEffect(() => {
    if (editingStop || stopAddMode === 'library' || !matchedCatalogStop) return;
    if (stopFormData.name !== matchedCatalogStop.name) {
      setStopFormData((prev) => ({ ...prev, name: matchedCatalogStop.name }));
    }
  }, [matchedCatalogStop, editingStop, stopAddMode, stopFormData.name, setStopFormData]);

  useEffect(() => {
    setSelectedStopIds([]);
    setEditingOrderStopId(null);
  }, [selectedRouteId]);

  const toggleStopSelection = (stopId: string, checked: boolean) => {
    setSelectedStopIds((prev) =>
      checked ? [...new Set([...prev, stopId])] : prev.filter((id) => id !== stopId)
    );
  };

  const getReorderStopIds = (stopId: string) =>
    selectedStopIds.length > 0 && selectedStopIds.includes(stopId) ? selectedStopIds : [stopId];

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
    setSelectedCatalogStopIds([]);
    setStopSearchQuery('');
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
      description: stop.description ?? '',
    });
    setIsStopFormOpen(true);
  };

  const handleAddFromLibrary = async () => {
    if (!selectedRoute || selectedCatalogStopIds.length === 0) return;

    const stopsToAdd = catalogStops.filter((s) => selectedCatalogStopIds.includes(s.id));
    if (stopsToAdd.length === 0) return;

    const newStops: Stop[] = [];
    const duplicateNames: string[] = [];

    stopsToAdd.forEach((catalogStop) => {
      const alreadyOnRoute = selectedRoute.stops.some(
        (s) =>
          s.catalogStopId === catalogStop.id ||
          areCoordinatesWithinDistance(
            s.latitude,
            s.longitude,
            catalogStop.latitude,
            catalogStop.longitude
          )
      );
      if (alreadyOnRoute) {
        duplicateNames.push(catalogStop.name);
      } else {
        newStops.push({
          id: `${selectedRoute.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: catalogStop.name,
          order: selectedRoute.stops.length + newStops.length + 1,
          catalogStopId: catalogStop.id,
          ...(catalogStop.latitude != null ? { latitude: catalogStop.latitude } : {}),
          ...(catalogStop.longitude != null ? { longitude: catalogStop.longitude } : {}),
        });
      }
    });

    if (newStops.length === 0) {
      toast.error('Selected stops are already on the route');
      return;
    }

    try {
      const routeRef = doc(db, 'routes', selectedRoute.id);
      await updateDoc(routeRef, {
        stops: [...selectedRoute.stops, ...newStops],
        updatedAt: Timestamp.now(),
      });
      setIsStopFormOpen(false);
      
      if (duplicateNames.length > 0) {
        toast.success(`Added ${newStops.length} stop(s). Skipped ${duplicateNames.length} duplicate(s).`);
      } else {
        toast.success(`Added ${newStops.length} stop(s) to route`);
      }
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
      const { parsedLat, parsedLng } = parseStopFormCoordinates(stopFormData);

      if (editingStop) {
        const nearbyStop = findNearbyCatalogStop(
          catalogStops.filter((stop) => stop.id !== editingStop.catalogStopId),
          parsedLat,
          parsedLng
        );
        
        let targetCatalogId = editingStop.catalogStopId;
        let finalName = stopFormData.name.trim();
        let finalLat = parsedLat;
        let finalLng = parsedLng;
        let finalDescription = stopFormData.description.trim();
        
        if (nearbyStop) {
           targetCatalogId = nearbyStop.id;
           finalName = nearbyStop.name;
           finalLat = nearbyStop.latitude;
           finalLng = nearbyStop.longitude;
           // keep description from form when snapping to nearby stop
        } else if (editingStop.catalogStopId) {
           const payload = {
              name: finalName,
              ...(finalLat !== undefined && !isNaN(finalLat) ? { latitude: finalLat } : {}),
              ...(finalLng !== undefined && !isNaN(finalLng) ? { longitude: finalLng } : {}),
              description: finalDescription,
           };
           await updateCatalogStop(editingStop.catalogStopId, payload);
        }

        updatedStops = selectedRoute.stops.map((s) =>
          s.id === editingStop.id
            ? {
                ...s,
                name: finalName,
                ...(targetCatalogId ? { catalogStopId: targetCatalogId } : {}),
                ...(finalLat !== undefined && !isNaN(finalLat) ? { latitude: finalLat } : {}),
                ...(finalLng !== undefined && !isNaN(finalLng) ? { longitude: finalLng } : {}),
                description: finalDescription,
              }
            : s
        );
      } else {
        const nearbyStop = matchedCatalogStop ?? findNearbyCatalogStop(catalogStops, parsedLat, parsedLng);
        let catalogId: string;
        let stopName = stopFormData.name.trim();

        if (nearbyStop) {
          catalogId = nearbyStop.id;
          stopName = nearbyStop.name;
        } else {
          catalogId = await addCatalogStop({
            name: stopName,
            ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
            ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
          });
        }

        const alreadyOnRoute = selectedRoute.stops.some(
          (s) =>
            s.catalogStopId === catalogId ||
            areCoordinatesWithinDistance(s.latitude, s.longitude, parsedLat, parsedLng)
        );
        if (alreadyOnRoute) {
          toast.error(`"${stopName}" is already on this route`);
          return;
        }

        const newStop: Stop = {
          id: `${selectedRoute.id}-${Date.now()}`,
          name: stopName,
          order: selectedRoute.stops.length + 1,
          catalogStopId: catalogId,
          ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
          ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
          ...(stopFormData.description.trim() ? { description: stopFormData.description.trim() } : {}),
        };
        updatedStops = [...selectedRoute.stops, newStop];
      }

      const routeRef = doc(db, 'routes', selectedRoute.id);
      await updateDoc(routeRef, {
        stops: updatedStops,
        updatedAt: Timestamp.now(),
      });
      setIsStopFormOpen(false);
      toast.success(
        editingStop
          ? 'Stop updated'
          : matchedCatalogStop
            ? `Added existing stop "${matchedCatalogStop.name}" to route`
            : 'Stop added and saved to library'
      );
      loadData();
    } catch (error) {
      console.error('Error saving stop:', error);
      toast.error('Failed to save stop');
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

  const requestMoveStop = (stopId: string, direction: 'up' | 'down') => {
    if (!selectedRoute) return;

    const stopIds = getReorderStopIds(stopId);
    const preview = moveStopsInDirection(selectedRoute.stops, stopIds, direction);
    if (!preview) return;

    const stopNames = selectedRoute.stops
      .filter((stop) => stopIds.includes(stop.id))
      .map((stop) => stop.name)
      .join(', ');

    setPendingReorder({
      type: 'move',
      stopIds,
      direction,
      description:
        stopIds.length > 1
          ? `Move ${stopIds.length} selected stops (${stopNames}) ${direction === 'up' ? 'up' : 'down'}?`
          : `Move "${stopNames}" ${direction === 'up' ? 'up' : 'down'}?`,
    });
    setIsReorderConfirmOpen(true);
  };

  const submitOrderChange = (stop: Stop) => {
    if (!selectedRoute) return;

    const targetOrder = parseInt(orderInputValue, 10);
    setEditingOrderStopId(null);

    if (Number.isNaN(targetOrder) || targetOrder < 1 || targetOrder > selectedRoute.stops.length) {
      toast.error(`Enter a position between 1 and ${selectedRoute.stops.length}`);
      return;
    }

    const stopIds = getReorderStopIds(stop.id);
    const currentOrder = stop.order;
    if (stopIds.length === 1 && targetOrder === currentOrder) return;

    const stopNames = selectedRoute.stops
      .filter((item) => stopIds.includes(item.id))
      .map((item) => item.name)
      .join(', ');

    setPendingReorder({
      type: 'serial',
      stopIds,
      targetOrder,
      description:
        stopIds.length > 1
          ? `Move ${stopIds.length} selected stops (${stopNames}) to position ${targetOrder}?`
          : `Change "${stop.name}" from position ${currentOrder} to ${targetOrder}?`,
    });
    setIsReorderConfirmOpen(true);
  };

  const confirmReorder = async () => {
    if (!selectedRoute || !pendingReorder) return;

    try {
      const reorderedStops =
        pendingReorder.type === 'move'
          ? moveStopsInDirection(selectedRoute.stops, pendingReorder.stopIds, pendingReorder.direction)
          : reorderStopsByPosition(
              selectedRoute.stops,
              pendingReorder.stopIds,
              pendingReorder.targetOrder
            );

      if (!reorderedStops) return;

      const routeRef = doc(db, 'routes', selectedRoute.id);
      await updateDoc(routeRef, {
        stops: reorderedStops,
        updatedAt: Timestamp.now(),
      });

      setIsReorderConfirmOpen(false);
      setPendingReorder(null);
      toast.success('Stop order updated');
      loadData();
    } catch (error) {
      console.error('Error reordering stops:', error);
      toast.error('Failed to update stop order');
    }
  };

  // One-time migration: push existing route stops (without catalogStopId) into the stops collection
  const handleMigrateStops = async () => {
    setIsMigrating(true);
    try {
      // Fetch fresh routes & existing catalog in parallel
      const [routesSnap, existingCatalog] = await Promise.all([
        getDocs(query(collection(db, 'routes'), orderBy('name'))),
        getCatalogStops(),
      ]);

      const allRoutes = routesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Route[];

      // Build name→catalogId map and keep catalog list for 50 m lookups
      const catalogByName = new Map<string, string>();
      const catalogEntries = [...existingCatalog];
      for (const stop of catalogEntries) {
        catalogByName.set(stop.name.toLowerCase().trim(), stop.id);
      }

      let migratedCount = 0;

      for (const route of allRoutes) {
        const stops: Stop[] = route.stops ?? [];
        let routeUpdated = false;

        const updatedStops = await Promise.all(
          stops.map(async (stop) => {
            // Skip stops already linked to the catalog
            if (stop.catalogStopId) return stop;

            const nameKey = stop.name.toLowerCase().trim();
            const nearbyStop = findNearbyCatalogStop(catalogEntries, stop.latitude, stop.longitude);
            let catalogId = nearbyStop?.id ?? catalogByName.get(nameKey);

            if (!catalogId) {
              // Create a new catalog entry
              const payload = {
                name: stop.name,
                ...(stop.latitude != null ? { latitude: stop.latitude } : {}),
                ...(stop.longitude != null ? { longitude: stop.longitude } : {}),
              };
              catalogId = await addCatalogStop(payload);
              const newStop: CatalogStop = {
                id: catalogId,
                name: stop.name,
                latitude: stop.latitude,
                longitude: stop.longitude,
              };
              catalogEntries.push(newStop);
              catalogByName.set(nameKey, catalogId);
            }

            routeUpdated = true;
            migratedCount++;
            return { ...stop, catalogStopId: catalogId };
          })
        );

        if (routeUpdated) {
          const routeRef = doc(db, 'routes', route.id);
          await updateDoc(routeRef, {
            stops: updatedStops,
            updatedAt: Timestamp.now(),
          });
        }
      }

      if (migratedCount === 0) {
        toast.info('All stops are already in the library — nothing to migrate.');
      } else {
        toast.success(`Migrated ${migratedCount} stop${migratedCount > 1 ? 's' : ''} to the Stop Library.`);
      }
      loadData();
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Migration failed — check the console for details.');
    } finally {
      setIsMigrating(false);
    }
  };

  // Count stops that still need migration
  const unmigatedCount = routes.reduce(
    (acc, r) => acc + r.stops.filter((s) => !s.catalogStopId).length,
    0
  );

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
        <div className="flex items-center gap-2">
          {unmigatedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMigrateStops}
              disabled={isMigrating}
              title={`${unmigatedCount} stop(s) not yet in the library`}
            >
              <DatabaseZap className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {isMigrating ? 'Syncing…' : `Sync ${unmigatedCount} Stop${unmigatedCount > 1 ? 's' : ''}`}
              </span>
            </Button>
          )}
          <Button onClick={handleAddRoute} size="sm" className="sm:size-default">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Route</span>
          </Button>
        </div>
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
                <div className="flex items-center justify-between border-b px-4 py-3 gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">Stops ({selectedRoute.stops.length})</h3>
                    {selectedStopIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedStopIds.length} selected — use arrows or edit serial to reorder together
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedStopIds.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedStopIds([])}>
                        Clear
                      </Button>
                    )}
                    <Button size="sm" onClick={handleAddStop}>
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Add Stop</span>
                    </Button>
                  </div>
                </div>
                <div className="divide-y max-h-[50vh] lg:max-h-none overflow-y-auto">
                  {selectedRoute.stops.map((stop, index) => (
                    <div
                      key={stop.id}
                      className={cn(
                        'flex items-center justify-between px-3 sm:px-4 py-3 gap-2',
                        selectedStopIds.includes(stop.id) && 'bg-muted/40'
                      )}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Checkbox
                          checked={selectedStopIds.includes(stop.id)}
                          onCheckedChange={(checked) => toggleStopSelection(stop.id, checked === true)}
                          aria-label={`Select ${stop.name}`}
                        />
                        {editingOrderStopId === stop.id ? (
                          <Input
                            type="number"
                            min={1}
                            max={selectedRoute.stops.length}
                            value={orderInputValue}
                            onChange={(e) => setOrderInputValue(e.target.value)}
                            onBlur={() => submitOrderChange(stop)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitOrderChange(stop);
                              if (e.key === 'Escape') setEditingOrderStopId(null);
                            }}
                            className="h-8 w-14 px-2 text-center"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrderStopId(stop.id);
                              setOrderInputValue(String(stop.order));
                            }}
                            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-xs sm:text-sm font-medium text-primary-foreground flex-shrink-0 hover:opacity-90"
                            title="Change stop position"
                          >
                            {stop.order}
                          </button>
                        )}
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{stop.name}</span>
                          {stop.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{stop.description}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => requestMoveStop(stop.id, 'up')}
                          disabled={!moveStopsInDirection(selectedRoute.stops, getReorderStopIds(stop.id), 'up')}
                          className="h-8 w-8 p-0"
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => requestMoveStop(stop.id, 'down')}
                          disabled={!moveStopsInDirection(selectedRoute.stops, getReorderStopIds(stop.id), 'down')}
                          className="h-8 w-8 p-0"
                          title="Move down"
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
        <DialogContent>
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
        <DialogContent className="sm:max-w-2xl">
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
                <div className="space-y-3">
                  <Label>Select stops from library</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search stops..."
                      className="pl-9"
                      value={stopSearchQuery}
                      onChange={(e) => setStopSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="rounded-md border p-0 max-h-[250px] overflow-y-auto">
                    {catalogStops
                      .filter(stop => stop.name.toLowerCase().includes(stopSearchQuery.toLowerCase()))
                      .map((stop) => (
                        <div key={stop.id} className="flex flex-row items-center space-x-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50" onClick={() => {
                          setSelectedCatalogStopIds(prev => 
                            prev.includes(stop.id)
                              ? prev.filter(id => id !== stop.id)
                              : [...prev, stop.id]
                          )
                        }}>
                          <Checkbox
                            checked={selectedCatalogStopIds.includes(stop.id)}
                            onCheckedChange={(checked) => {
                              setSelectedCatalogStopIds(prev => 
                                checked 
                                  ? [...prev, stop.id]
                                  : prev.filter(id => id !== stop.id)
                              )
                            }}
                          />
                          <div className="text-sm font-medium flex-1">
                            {stop.name}
                            {stop.latitude != null && stop.longitude != null && (
                              <span className="text-muted-foreground ml-2 text-xs font-normal">
                                ({stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    {catalogStops.filter(stop => stop.name.toLowerCase().includes(stopSearchQuery.toLowerCase())).length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No stops found.
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stops are managed in the Stops section. Pick one or more to add to this route.
                  </p>
                </div>
              </div>
            ) : (
              <StopLocationForm
                formData={stopFormData}
                isLocating={isLocating}
                parsedCoords={parsedStopCoords}
                onNameChange={(name) => setStopFormData((prev) => ({ ...prev, name }))}
                onDescriptionChange={(description) => setStopFormData((prev) => ({ ...prev, description }))}
                onCoordinateChange={handleCoordinateChange}
                onUseCurrentLocation={handleUseCurrentLocation}
                nameInputId="routeStopName"
                matchedCatalogStop={matchedCatalogStop}
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
                disabled={selectedCatalogStopIds.length === 0 || catalogStops.length === 0}
                className="w-full sm:w-auto"
              >
                Add {selectedCatalogStopIds.length > 0 ? `(${selectedCatalogStopIds.length}) ` : ''}to Route
              </Button>
            ) : (
              <Button onClick={handleSaveStop} disabled={!stopFormData.name} className="w-full sm:w-auto">
                {editingStop
                  ? 'Save Changes'
                  : matchedCatalogStop
                    ? `Add "${matchedCatalogStop.name}"`
                    : 'Add Stop'}
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

      <ConfirmDialog
        open={isReorderConfirmOpen}
        onOpenChange={(open) => {
          setIsReorderConfirmOpen(open);
          if (!open) setPendingReorder(null);
        }}
        title="Confirm Stop Order Change"
        description={pendingReorder?.description ?? 'Apply this stop order change?'}
        confirmLabel="Confirm Change"
        onConfirm={confirmReorder}
      />
    </AdminLayout>
  );
}
