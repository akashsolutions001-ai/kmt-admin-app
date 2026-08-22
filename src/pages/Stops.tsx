import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StopLocationForm } from '@/components/stops/StopLocationForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Route as RouteType, Stop, CatalogStop } from '@/types/admin';
import { getGoogleMapsUrl } from '@/lib/mapUtils';
import {
  getCatalogStops,
  addCatalogStop,
  updateCatalogStop,
  deleteCatalogStop,
  analyzeDuplicateStops,
  deduplicateStopsByCoordinates,
  findNearbyCatalogStop,
  formatAllStopNames,
  syncOrphanedRouteStopsToCatalog,
} from '@/lib/stopsCatalog';
import { useStopLocationForm, parseStopFormCoordinates } from '@/hooks/useStopLocationForm';
import { Copy, ExternalLink, Plus, Pencil, Search, Trash2, Download, RefreshCw } from 'lucide-react';
import { exportCatalogStops, exportRouteStops } from '@/lib/exportUtils';
import { toast } from 'sonner';

export default function Stops() {
  const [catalogStops, setCatalogStops] = useState<CatalogStop[]>([]);
  const [routeStops, setRouteStops] = useState<Stop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<CatalogStop | null>(null);
  const [stopToDelete, setStopToDelete] = useState<CatalogStop | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [duplicateSummary, setDuplicateSummary] = useState({ duplicateCatalogCount: 0, duplicateRouteStopCount: 0 });
  const [isDeduping, setIsDeduping] = useState(false);
  const [isDedupeOpen, setIsDedupeOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);

  // Export state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedCatalogForExport, setSelectedCatalogForExport] = useState<string[]>([]);
  const [selectedRouteStopsForExport, setSelectedRouteStopsForExport] = useState<string[]>([]);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
  const filteredCatalogStops = useMemo(
    () =>
      catalogStops.filter(
        (stop) => !normalizedSearch || stop.name.toLowerCase().includes(normalizedSearch)
      ),
    [catalogStops, normalizedSearch]
  );
  const filteredRouteStops = useMemo(
    () =>
      routeStops.filter(
        (stop) =>
          !normalizedSearch ||
          stop.name.toLowerCase().includes(normalizedSearch) ||
          (stop.routeName ?? '').toLowerCase().includes(normalizedSearch)
      ),
    [routeStops, normalizedSearch]
  );

  const duplicateCount = duplicateSummary.duplicateCatalogCount + duplicateSummary.duplicateRouteStopCount;

  const {
    formData,
    setFormData,
    isLocating,
    parsedCoords,
    resetForm,
    handleUseCurrentLocation,
    handleCoordinateChange,
  } = useStopLocationForm();

  const matchedCatalogStop = useMemo(() => {
    const { parsedLat, parsedLng } = parseStopFormCoordinates(formData);
    return findNearbyCatalogStop(
      catalogStops.filter((stop) => stop.id !== editingStop?.id),
      parsedLat,
      parsedLng
    ) ?? null;
  }, [formData, catalogStops, editingStop]);

  useEffect(() => {
    if (editingStop || !isFormOpen || !matchedCatalogStop) return;
    if (formData.name !== matchedCatalogStop.name) {
      setFormData((prev) => ({ ...prev, name: matchedCatalogStop.name }));
    }
  }, [matchedCatalogStop, editingStop, isFormOpen, formData.name, setFormData]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let [catalog, routesSnap] = await Promise.all([
        getCatalogStops(),
        getDocs(collection(db, 'routes')),
      ]);

      const catalogMap = new Map<string, CatalogStop>();
      for (const c of catalog) {
        catalogMap.set(c.id, c);
      }

      let routes = routesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as RouteType[];
      
      let hasOrphans = false;
      for (const route of routes) {
        for (const stop of (route.stops ?? [])) {
          const linkedCatalog = catalogMap.get(stop.catalogStopId ?? '');
          if (!linkedCatalog || linkedCatalog.name.toLowerCase().trim() !== stop.name.toLowerCase().trim()) {
            hasOrphans = true;
            break;
          }
        }
        if (hasOrphans) break;
      }

      if (hasOrphans) {
        const addedCount = await syncOrphanedRouteStopsToCatalog();
        if (addedCount > 0) {
          toast.success(`Synced ${addedCount} missing route stop(s) to the library`);
        }
        // Fetch fresh data after sync
        const [freshCatalog, freshRoutesSnap] = await Promise.all([
          getCatalogStops(),
          getDocs(collection(db, 'routes')),
        ]);
        catalog = freshCatalog;
        routes = freshRoutesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as RouteType[];
      }

      setCatalogStops(catalog);
      const allStops: Stop[] = [];
      routes.forEach((route) => {
        (route.stops ?? []).forEach((stop) => {
          allStops.push({ ...stop, routeId: route.id, routeName: route.name });
        });
      });
      setRouteStops(allStops.sort((a, b) => (a.routeName ?? '').localeCompare(b.routeName ?? '')));

      const duplicates = await analyzeDuplicateStops(catalog, routes);
      setDuplicateSummary(duplicates);
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
      description: stop.description ?? '',
    });
    setIsFormOpen(true);
  };

  const handleSaveStop = async () => {
    if (!formData.name.trim()) return;

    try {
      const { parsedLat, parsedLng } = parseStopFormCoordinates(formData);
      const existing = findNearbyCatalogStop(
        catalogStops.filter((stop) => stop.id !== editingStop?.id),
        parsedLat,
        parsedLng
      );
      if (existing && !editingStop) {
        toast.info(`Stop already exists within 50 m: "${existing.name}"`);
        setIsFormOpen(false);
        return;
      }
      if (existing && editingStop) {
        toast.error(`Another stop already exists within 50 m: "${existing.name}"`);
        return;
      }

      const payload = {
        name: (matchedCatalogStop?.name ?? formData.name).trim(),
        ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
        ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
        ...(formData.description.trim() ? { description: formData.description.trim() } : { description: '' }),
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

  const confirmUpdateExisting = async () => {
    if (!matchedCatalogStop) return;
    try {
      const { parsedLat, parsedLng } = parseStopFormCoordinates(formData);
      const payload = {
        name: formData.name.trim(),
        ...(parsedLat !== undefined && !isNaN(parsedLat) ? { latitude: parsedLat } : {}),
        ...(parsedLng !== undefined && !isNaN(parsedLng) ? { longitude: parsedLng } : {}),
        ...(formData.description.trim() ? { description: formData.description.trim() } : { description: '' }),
      };
      await updateCatalogStop(matchedCatalogStop.id, payload);
      toast.success('Stop updated');
      setIsUpdateConfirmOpen(false);
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating existing stop:', error);
      toast.error('Failed to update stop');
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

  const confirmDeduplicate = async () => {
    setIsDeduping(true);
    try {
      const result = await deduplicateStopsByCoordinates();
      setIsDedupeOpen(false);
      if (result.duplicateCatalogCount === 0 && result.duplicateRouteStopCount === 0) {
        toast.info('No duplicate stops found by coordinates.');
      } else {
        toast.success(
          `Removed ${result.duplicateCatalogCount} duplicate library stop${result.duplicateCatalogCount === 1 ? '' : 's'} and ${result.duplicateRouteStopCount} repeated route stop${result.duplicateRouteStopCount === 1 ? '' : 's'} across ${result.updatedRoutes} route${result.updatedRoutes === 1 ? '' : 's'}.`
        );
      }
      loadData();
    } catch (error) {
      console.error('Error deduplicating stops:', error);
      toast.error('Failed to remove duplicate stops');
    } finally {
      setIsDeduping(false);
    }
  };

  const [isFormatting, setIsFormatting] = useState(false);

  const handleFormatNames = async () => {
    setIsFormatting(true);
    try {
      const result = await formatAllStopNames();
      toast.success(
        `Formatted names for ${result.catalogUpdated} library stop(s) and ${result.routesUpdated} route(s).`
      );
      loadData();
    } catch (error) {
      console.error('Error formatting names:', error);
      toast.error('Failed to format stop names');
    } finally {
      setIsFormatting(false);
    }
  };

  // Export handlers
  const handleExportCatalog = () => {
    if (catalogStops.length === 0) {
      toast.error('No stops in library to export');
      return;
    }
    exportCatalogStops(catalogStops, 'csv');
    toast.success(`Exported ${catalogStops.length} stop(s) from library as CSV`);
    setIsExportOpen(false);
  };

  const handleExportSelectedCatalog = () => {
    if (selectedCatalogForExport.length === 0) {
      toast.error('No stops selected');
      return;
    }
    const selectedStops = catalogStops.filter(s => selectedCatalogForExport.includes(s.id));
    exportCatalogStops(selectedStops, 'csv');
    toast.success(`Exported ${selectedStops.length} selected stop(s) as CSV`);
    setIsExportOpen(false);
    setSelectedCatalogForExport([]);
  };

  const handleExportRouteStops = () => {
    if (routeStops.length === 0) {
      toast.error('No stops on routes to export');
      return;
    }
    exportRouteStops(routeStops, 'csv');
    toast.success(`Exported ${routeStops.length} stop(s) from routes as CSV`);
    setIsExportOpen(false);
  };

  const handleExportSelectedRouteStops = () => {
    if (selectedRouteStopsForExport.length === 0) {
      toast.error('No stops selected');
      return;
    }
    const selectedStops = routeStops.filter(s => 
      selectedRouteStopsForExport.includes(`${s.routeId}-${s.id}`)
    );
    exportRouteStops(selectedStops, 'csv');
    toast.success(`Exported ${selectedStops.length} selected stop(s) as CSV`);
    setIsExportOpen(false);
    setSelectedRouteStopsForExport([]);
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const addedCount = await syncOrphanedRouteStopsToCatalog();
      if (addedCount > 0) {
        toast.success(`Synced ${addedCount} missing route stop(s) to the library`);
      } else {
        toast.info('All route stops are already in the library.');
      }
      await loadData();
    } catch (error) {
      console.error('Error syncing stops:', error);
      toast.error('Failed to sync stops');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Stops" subtitle="Loading...">
        <div className="flex items-center justify-center min-h-[60vh]">
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceSync}
            disabled={isSyncing}
            title="Force Sync Missing Stops"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isSyncing ? 'Syncing…' : 'Force Sync'}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            title="Export stops"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFormatNames}
            disabled={isFormatting}
            title="Capitalize first letter of every word for all stops"
          >
            <span className="font-serif font-bold text-sm sm:mr-2">Aa</span>
            <span className="hidden sm:inline">
              {isFormatting ? 'Formatting…' : 'Format Names'}
            </span>
          </Button>
          {duplicateCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDedupeOpen(true)}
              disabled={isDeduping}
              title={`${duplicateCount} duplicate stop(s) found by coordinates`}
            >
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {isDeduping ? 'Removing…' : `Remove ${duplicateCount} Duplicate${duplicateCount > 1 ? 's' : ''}`}
              </span>
            </Button>
          )}
          <Button onClick={handleAddStop} size="sm">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Stop</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search stops by name or route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stop Library */}
        <section>
          <h3 className="text-sm font-semibold mb-3">Stop Library</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add stops here once — reuse them when building routes.
          </p>

          {/* Desktop table */}
          <div className="hidden sm:block glass-card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox
                      checked={selectedCatalogForExport.length === filteredCatalogStops.length && filteredCatalogStops.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCatalogForExport(filteredCatalogStops.map(s => s.id));
                        } else {
                          setSelectedCatalogForExport([]);
                        }
                      }}
                      aria-label="Select all catalog stops"
                    />
                  </th>
                  <th className="w-12 text-center">#</th>
                  <th>Stop Name</th>
                  <th className="hidden sm:table-cell">Description</th>
                  <th className="hidden md:table-cell">Coordinates</th>
                  <th className="hidden lg:table-cell">Map</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogStops.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No stops in library. Click &quot;Add Stop&quot; to create one.
                    </td>
                  </tr>
                ) : filteredCatalogStops.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No stops match your search.
                    </td>
                  </tr>
                ) : (
                  filteredCatalogStops.map((stop, index) => (
                    <tr key={stop.id}>
                      <td>
                        <Checkbox
                          checked={selectedCatalogForExport.includes(stop.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCatalogForExport(prev => [...prev, stop.id]);
                            } else {
                              setSelectedCatalogForExport(prev => prev.filter(id => id !== stop.id));
                            }
                          }}
                          aria-label={`Select ${stop.name}`}
                        />
                      </td>
                      <td className="text-center text-muted-foreground text-sm">{index + 1}</td>
                      <td className="font-medium">{stop.name}</td>
                      <td className="hidden sm:table-cell text-sm text-muted-foreground max-w-xs">
                        {stop.description ? (
                          <span className="line-clamp-2">{stop.description}</span>
                        ) : (
                          <span className="italic opacity-50">—</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell text-sm text-muted-foreground">
                        {stop.latitude != null && stop.longitude != null
                          ? `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="hidden lg:table-cell">
                        {stop.latitude != null && stop.longitude != null ? (
                          <a
                            href={getGoogleMapsUrl(stop.latitude, stop.longitude)}
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

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {catalogStops.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">
                No stops in library. Tap &quot;Add Stop&quot; to create one.
              </div>
            ) : filteredCatalogStops.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">
                No stops match your search.
              </div>
            ) : (
              <>
                {filteredCatalogStops.length > 1 && (
                  <div className="flex items-center gap-2 px-2">
                    <Checkbox
                      checked={selectedCatalogForExport.length === filteredCatalogStops.length && filteredCatalogStops.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCatalogForExport(filteredCatalogStops.map(s => s.id));
                        } else {
                          setSelectedCatalogForExport([]);
                        }
                      }}
                      aria-label="Select all catalog stops"
                    />
                    <span className="text-sm text-muted-foreground">Select all</span>
                  </div>
                )}
                {filteredCatalogStops.map((stop, index) => (
                  <div key={stop.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedCatalogForExport.includes(stop.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCatalogForExport(prev => [...prev, stop.id]);
                          } else {
                            setSelectedCatalogForExport(prev => prev.filter(id => id !== stop.id));
                          }
                        }}
                        aria-label={`Select ${stop.name}`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                          <h3 className="font-medium text-sm truncate">{stop.name}</h3>
                        </div>
                      {stop.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{stop.description}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap mt-1">
                        {stop.latitude != null && stop.longitude != null && (
                          <>
                            <p className="text-xs text-muted-foreground font-mono">
                              {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                            </p>
                            <a
                              href={getGoogleMapsUrl(stop.latitude, stop.longitude)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary"
                            >
                              Map <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

        {/* Stops on routes (existing view) */}
        <section>
          <h3 className="text-sm font-semibold mb-3">Stops on Routes</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Stops currently assigned to routes (manage order in Routes &amp; Stops).
          </p>

          {/* Desktop table */}
          <div className="hidden sm:block glass-card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox
                      checked={selectedRouteStopsForExport.length === filteredRouteStops.length && filteredRouteStops.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRouteStopsForExport(filteredRouteStops.map(s => `${s.routeId}-${s.id}`));
                        } else {
                          setSelectedRouteStopsForExport([]);
                        }
                      }}
                      aria-label="Select all route stops"
                    />
                  </th>
                  <th className="w-12 text-center">#</th>
                  <th>Stop Name</th>
                  <th className="hidden sm:table-cell">Description</th>
                  <th>Route</th>
                  <th className="hidden sm:table-cell">Order</th>
                  <th className="hidden md:table-cell">Coordinates</th>
                  <th className="hidden lg:table-cell">Map</th>
                </tr>
              </thead>
              <tbody>
                {routeStops.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No stops assigned to routes yet
                    </td>
                  </tr>
                ) : filteredRouteStops.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No stops match your search.
                    </td>
                  </tr>
                ) : (
                  filteredRouteStops.map((stop, index) => {
                    const stopKey = `${stop.routeId}-${stop.id}`;
                    return (
                      <tr key={stopKey}>
                        <td>
                          <Checkbox
                            checked={selectedRouteStopsForExport.includes(stopKey)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRouteStopsForExport(prev => [...prev, stopKey]);
                              } else {
                                setSelectedRouteStopsForExport(prev => prev.filter(id => id !== stopKey));
                              }
                            }}
                            aria-label={`Select ${stop.name}`}
                          />
                        </td>
                        <td className="text-center text-muted-foreground text-sm">{index + 1}</td>
                        <td className="font-medium">{stop.name}</td>
                      <td className="hidden sm:table-cell text-sm text-muted-foreground max-w-xs">
                        {stop.description ? (
                          <span className="line-clamp-2">{stop.description}</span>
                        ) : (
                          <span className="italic opacity-50">—</span>
                        )}
                      </td>
                      <td>{stop.routeName}</td>
                      <td className="hidden sm:table-cell">{stop.order}</td>
                      <td className="hidden md:table-cell text-sm text-muted-foreground">
                        {stop.latitude != null && stop.longitude != null
                          ? `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="hidden lg:table-cell">
                        {stop.latitude != null && stop.longitude != null ? (
                          <a
                            href={getGoogleMapsUrl(stop.latitude, stop.longitude)}
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
                  );
                })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {routeStops.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">
                No stops assigned to routes yet.
              </div>
            ) : filteredRouteStops.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">
                No stops match your search.
              </div>
            ) : (
              <>
                {filteredRouteStops.length > 1 && (
                  <div className="flex items-center gap-2 px-2">
                    <Checkbox
                      checked={selectedRouteStopsForExport.length === filteredRouteStops.length && filteredRouteStops.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRouteStopsForExport(filteredRouteStops.map(s => `${s.routeId}-${s.id}`));
                        } else {
                          setSelectedRouteStopsForExport([]);
                        }
                      }}
                      aria-label="Select all route stops"
                    />
                    <span className="text-sm text-muted-foreground">Select all</span>
                  </div>
                )}
                {filteredRouteStops.map((stop, index) => {
                  const stopKey = `${stop.routeId}-${stop.id}`;
                  return (
                    <div key={stopKey} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedRouteStopsForExport.includes(stopKey)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedRouteStopsForExport(prev => [...prev, stopKey]);
                            } else {
                              setSelectedRouteStopsForExport(prev => prev.filter(id => id !== stopKey));
                            }
                          }}
                          aria-label={`Select ${stop.name}`}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground font-mono flex-shrink-0">#{index + 1}</span>
                              <h3 className="font-medium text-sm truncate">{stop.name}</h3>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">Stop #{stop.order}</span>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p><span className="font-medium text-foreground">Route:</span> {stop.routeName}</p>
                            {stop.description && <p className="line-clamp-1">{stop.description}</p>}
                            {stop.latitude != null && stop.longitude != null && (
                              <div className="flex items-center gap-3">
                                <span className="font-mono">{stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}</span>
                                <a
                                  href={getGoogleMapsUrl(stop.latitude, stop.longitude)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary"
                                >
                                  Map <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </>
          )}
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
            onDescriptionChange={(description) => setFormData((prev) => ({ ...prev, description }))}
            onCoordinateChange={handleCoordinateChange}
            onUseCurrentLocation={handleUseCurrentLocation}
            nameInputId="catalogStopName"
            matchedCatalogStop={matchedCatalogStop}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            {!editingStop && matchedCatalogStop ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsUpdateConfirmOpen(true)}
                  disabled={!formData.name.trim()}
                  className="w-full sm:w-auto"
                >
                  Update Existing
                </Button>
                <Button
                  onClick={handleSaveStop}
                  disabled={true}
                  className="w-full sm:w-auto"
                >
                  Stop Already Exists
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSaveStop}
                disabled={!formData.name.trim()}
                className="w-full sm:w-auto"
              >
                {editingStop ? 'Save Changes' : 'Add Stop'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isUpdateConfirmOpen}
        onOpenChange={setIsUpdateConfirmOpen}
        title="Update Existing Stop"
        description={`Are you sure you want to update "${matchedCatalogStop?.name}" with these new details? This will affect all routes using this stop.`}
        confirmLabel="Update"
        onConfirm={confirmUpdateExisting}
      />

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Stop"
        description={`Remove "${stopToDelete?.name}" from the stop library? Routes already using this stop will not be affected.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      <ConfirmDialog
        open={isDedupeOpen}
        onOpenChange={setIsDedupeOpen}
        title="Remove Duplicate Stops"
        description={`This will remove ${duplicateSummary.duplicateCatalogCount} duplicate stop${duplicateSummary.duplicateCatalogCount === 1 ? '' : 's'} from the library and ${duplicateSummary.duplicateRouteStopCount} repeated stop${duplicateSummary.duplicateRouteStopCount === 1 ? '' : 's'} on routes when they are within 50 m of each other. The most-used stop name is kept for each location.`}
        confirmLabel={isDeduping ? 'Removing…' : 'Remove Duplicates'}
        onConfirm={confirmDeduplicate}
        variant="destructive"
      />

      {/* Export Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Export Stops</DialogTitle>
            <DialogDescription>
              Download stop data as CSV
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportCatalog}
              disabled={catalogStops.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Library Stops
              <span className="ml-auto text-xs text-muted-foreground">
                {catalogStops.length} stop(s)
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportSelectedCatalog}
              disabled={selectedCatalogForExport.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Selected Library Stops
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedCatalogForExport.length} selected
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportRouteStops}
              disabled={routeStops.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Route Stops
              <span className="ml-auto text-xs text-muted-foreground">
                {routeStops.length} stop(s)
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportSelectedRouteStops}
              disabled={selectedRouteStopsForExport.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Selected Route Stops
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedRouteStopsForExport.length} selected
              </span>
            </Button>

            <p className="text-xs text-muted-foreground pt-2">
              Use the checkboxes in the tables above to select specific stops for export.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
