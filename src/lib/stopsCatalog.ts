import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  areCoordinatesWithinDistance,
  isValidCoordinatePair,
  STOP_DUPLICATE_DISTANCE_METERS,
} from '@/lib/mapUtils';
import { CatalogStop, Route, Stop } from '@/types/admin';

const COLLECTION = 'stops';

interface CoordinatedItem {
  id: string;
  latitude?: number;
  longitude?: number;
}

export function findNearbyCatalogStop(
  catalog: CatalogStop[],
  latitude?: number,
  longitude?: number,
  maxDistanceMeters = STOP_DUPLICATE_DISTANCE_METERS
): CatalogStop | undefined {
  return catalog.find((stop) =>
    areCoordinatesWithinDistance(stop.latitude, stop.longitude, latitude, longitude, maxDistanceMeters)
  );
}

function groupStopsByProximity<T extends CoordinatedItem>(
  items: T[],
  maxDistanceMeters = STOP_DUPLICATE_DISTANCE_METERS
): T[][] {
  const withCoords = items.filter((item) => isValidCoordinatePair(item.latitude, item.longitude));
  const parent = withCoords.map((_, index) => index);

  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  for (let i = 0; i < withCoords.length; i++) {
    for (let j = i + 1; j < withCoords.length; j++) {
      if (
        areCoordinatesWithinDistance(
          withCoords[i].latitude,
          withCoords[i].longitude,
          withCoords[j].latitude,
          withCoords[j].longitude,
          maxDistanceMeters
        )
      ) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, T[]>();
  for (let i = 0; i < withCoords.length; i++) {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(withCoords[i]);
    groups.set(root, group);
  }

  return [...groups.values()];
}

function isNearExistingStop(
  keptStops: Array<{ latitude?: number; longitude?: number }>,
  latitude?: number,
  longitude?: number
): boolean {
  return keptStops.some((kept) =>
    areCoordinatesWithinDistance(kept.latitude, kept.longitude, latitude, longitude)
  );
}

export async function getCatalogStops(): Promise<CatalogStop[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CatalogStop[];
}

export async function addCatalogStop(
  stop: Omit<CatalogStop, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stop,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateCatalogStop(
  id: string,
  updates: Partial<Omit<CatalogStop, 'id'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: Timestamp.now(),
  });

  // Also update this stop in all routes
  const routesSnap = await getDocs(collection(db, 'routes'));
  const batchUpdates: Promise<void>[] = [];
  
  for (const docSnap of routesSnap.docs) {
    const routeData = docSnap.data();
    if (!routeData.stops) continue;
    
    let routeChanged = false;
    const updatedStops = routeData.stops.map((stop: any) => {
      if (stop.catalogStopId === id) {
        routeChanged = true;
        const cascadeUpdate: any = { ...stop };
        if ('name' in updates) cascadeUpdate.name = updates.name;
        if ('latitude' in updates) cascadeUpdate.latitude = updates.latitude;
        if ('longitude' in updates) cascadeUpdate.longitude = updates.longitude;
        if ('description' in updates) cascadeUpdate.description = updates.description;
        return cascadeUpdate;
      }
      return stop;
    });

    if (routeChanged) {
      batchUpdates.push(
        updateDoc(doc(db, 'routes', docSnap.id), {
          stops: updatedStops,
          updatedAt: Timestamp.now(),
        })
      );
    }
  }
  
  if (batchUpdates.length > 0) {
    await Promise.all(batchUpdates);
  }
}

export async function deleteCatalogStop(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export interface DuplicateStopSummary {
  duplicateCatalogCount: number;
  duplicateRouteStopCount: number;
}

export interface StopDeduplicationResult extends DuplicateStopSummary {
  updatedRoutes: number;
}

function countCatalogStopUsage(routes: Route[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const route of routes) {
    for (const stop of route.stops ?? []) {
      if (!stop.catalogStopId) continue;
      usage.set(stop.catalogStopId, (usage.get(stop.catalogStopId) ?? 0) + 1);
    }
  }
  return usage;
}

function pickCanonicalCatalogStop(stops: CatalogStop[], usage: Map<string, number>): CatalogStop {
  return [...stops].sort((a, b) => {
    const usageDiff = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0);
    if (usageDiff !== 0) return usageDiff;
    return a.name.localeCompare(b.name);
  })[0];
}

function dedupeRouteStops(stops: Stop[], catalogStops: CatalogStop[], catalogIdRemap: Map<string, string>): {
  stops: Stop[];
  removedCount: number;
  remappedCount: number;
} {
  const keptStops: Stop[] = [];
  let removedCount = 0;
  let remappedCount = 0;

  for (const stop of stops) {
    let nextStop = stop;
    
    if (stop.catalogStopId && catalogIdRemap.has(stop.catalogStopId)) {
      nextStop = { ...stop, catalogStopId: catalogIdRemap.get(stop.catalogStopId)! };
      remappedCount++;
    }

    // Snap to the closest catalog stop within 50m
    const nearbyCatalog = findNearbyCatalogStop(catalogStops, nextStop.latitude, nextStop.longitude);
    if (nearbyCatalog && nextStop.catalogStopId !== nearbyCatalog.id) {
      nextStop = {
        ...nextStop,
        catalogStopId: nearbyCatalog.id,
        name: nearbyCatalog.name,
        latitude: nearbyCatalog.latitude,
        longitude: nearbyCatalog.longitude,
      };
      remappedCount++;
    }

    // Check if it's too close to a stop already processed on this route
    if (isNearExistingStop(keptStops, nextStop.latitude, nextStop.longitude)) {
      removedCount++;
      continue;
    }

    keptStops.push(nextStop);
  }

  const deduped = keptStops.map((stop, index) => ({ ...stop, order: index + 1 }));
  return { stops: deduped, removedCount, remappedCount };
}

export async function analyzeDuplicateStops(
  preloadedCatalog?: CatalogStop[],
  preloadedRoutes?: Route[]
): Promise<DuplicateStopSummary> {
  let catalog = preloadedCatalog;
  let routes = preloadedRoutes;

  if (!catalog || !routes) {
    const [catalogSnap, routesSnap] = await Promise.all([
      getCatalogStops(),
      getDocs(query(collection(db, 'routes'), orderBy('name'))),
    ]);
    catalog = catalogSnap;
    routes = routesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Route[];
  }

  let duplicateCatalogCount = 0;
  for (const group of groupStopsByProximity(catalog)) {
    if (group.length > 1) duplicateCatalogCount += group.length - 1;
  }

  let duplicateRouteStopCount = 0;
  for (const route of routes) {
    const keptStops: Stop[] = [];
    for (const stop of route.stops ?? []) {
      const nearbyCatalog = findNearbyCatalogStop(catalog, stop.latitude, stop.longitude);
      const effectiveLat = nearbyCatalog ? nearbyCatalog.latitude : stop.latitude;
      const effectiveLng = nearbyCatalog ? nearbyCatalog.longitude : stop.longitude;

      if (isNearExistingStop(keptStops, effectiveLat, effectiveLng)) {
        duplicateRouteStopCount++;
        continue;
      }
      keptStops.push({ ...stop, latitude: effectiveLat, longitude: effectiveLng });
    }
  }

  return { duplicateCatalogCount, duplicateRouteStopCount };
}

export async function deduplicateStopsByCoordinates(): Promise<StopDeduplicationResult> {
  const [catalog, routesSnap] = await Promise.all([
    getCatalogStops(),
    getDocs(query(collection(db, 'routes'), orderBy('name'))),
  ]);
  const routes = routesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Route[];
  const catalogUsage = countCatalogStopUsage(routes);
  const catalogIdRemap = new Map<string, string>();
  let duplicateCatalogCount = 0;

  const canonicalCatalogStops: CatalogStop[] = [];

  for (const group of groupStopsByProximity(catalog)) {
    const canonical = pickCanonicalCatalogStop(group, catalogUsage);
    canonicalCatalogStops.push(canonical);
    
    if (group.length <= 1) continue;
    for (const stop of group) {
      if (stop.id === canonical.id) continue;
      catalogIdRemap.set(stop.id, canonical.id);
      duplicateCatalogCount++;
      await deleteCatalogStop(stop.id);
    }
  }

  let duplicateRouteStopCount = 0;
  let updatedRoutes = 0;

  for (const route of routes) {
    const originalStops = route.stops ?? [];
    const { stops, removedCount, remappedCount } = dedupeRouteStops(originalStops, canonicalCatalogStops, catalogIdRemap);
    duplicateRouteStopCount += removedCount;

    const routeChanged =
      removedCount > 0 ||
      remappedCount > 0 ||
      stops.some((stop, index) => {
        const original = originalStops[index];
        return (
          !original ||
          stop.id !== original.id ||
          stop.order !== original.order ||
          stop.catalogStopId !== original.catalogStopId
        );
      });

    if (!routeChanged) continue;

    await updateDoc(doc(db, 'routes', route.id), {
      stops,
      updatedAt: Timestamp.now(),
    });
    updatedRoutes++;
  }

  return {
    duplicateCatalogCount,
    duplicateRouteStopCount,
    updatedRoutes,
  };
}

export async function formatAllStopNames(): Promise<{ catalogUpdated: number; routesUpdated: number }> {
  const [catalogSnap, routesSnap] = await Promise.all([
    getDocs(collection(db, 'stops')),
    getDocs(collection(db, 'routes')),
  ]);

  const toTitleCase = (str: string) => 
    str.split(' ')
       .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
       .join(' ');

  let catalogUpdated = 0;
  for (const docSnap of catalogSnap.docs) {
    const data = docSnap.data();
    const oldName = data.name || '';
    const newName = toTitleCase(oldName);
    if (oldName !== newName) {
      await updateDoc(doc(db, 'stops', docSnap.id), { name: newName });
      catalogUpdated++;
    }
  }

  let routesUpdated = 0;
  for (const docSnap of routesSnap.docs) {
    const data = docSnap.data();
    let changed = false;
    const newStops = (data.stops || []).map((stop: any) => {
      const oldName = stop.name || '';
      const newName = toTitleCase(oldName);
      if (oldName !== newName) {
        changed = true;
      }
      return { ...stop, name: newName };
    });

    if (changed) {
      await updateDoc(doc(db, 'routes', docSnap.id), { stops: newStops });
      routesUpdated++;
    }
  }

  return { catalogUpdated, routesUpdated };
}

export async function syncOrphanedRouteStopsToCatalog(): Promise<number> {
  const [catalogSnap, routesSnap] = await Promise.all([
    getDocs(collection(db, 'stops')),
    getDocs(collection(db, 'routes')),
  ]);

  const catalog = catalogSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as CatalogStop[];
  const catalogMap = new Map<string, CatalogStop>();
  const catalogNameMap = new Map<string, CatalogStop>();
  
  for (const stop of catalog) {
    catalogMap.set(stop.id, stop);
    catalogNameMap.set(stop.name.toLowerCase().trim(), stop);
  }

  const routes = routesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Route[];
  
  let newlyAdded = 0;
  
  for (const route of routes) {
    let routeChanged = false;
    const updatedStops = [...(route.stops ?? [])];
    
    for (let i = 0; i < updatedStops.length; i++) {
      const stop = updatedStops[i];
      const routeStopNameLower = stop.name.toLowerCase().trim();
      
      let needsFix = false;
      let targetCatalogId = stop.catalogStopId;

      // Check if catalogStopId is missing or invalid
      if (!targetCatalogId || !catalogMap.has(targetCatalogId)) {
        needsFix = true;
      } else {
        // If it exists, check if the name matches. If names are different, it was improperly merged by coordinates
        const linkedCatalog = catalogMap.get(targetCatalogId)!;
        if (linkedCatalog.name.toLowerCase().trim() !== routeStopNameLower) {
          needsFix = true;
        }
      }

      if (needsFix) {
        // Try to find an existing catalog stop by name first
        let matchedCatalog = catalogNameMap.get(routeStopNameLower);
        
        if (!matchedCatalog) {
           // Create a new catalog stop if no exact name match exists
           const newId = await addCatalogStop({
             name: stop.name,
             ...(stop.latitude != null ? { latitude: stop.latitude } : {}),
             ...(stop.longitude != null ? { longitude: stop.longitude } : {}),
             ...(stop.description ? { description: stop.description } : {}),
           });
           
           matchedCatalog = {
             id: newId,
             name: stop.name,
             latitude: stop.latitude,
             longitude: stop.longitude,
             description: stop.description,
           };
           
           catalogMap.set(newId, matchedCatalog);
           catalogNameMap.set(routeStopNameLower, matchedCatalog);
           newlyAdded++;
        }
        
        updatedStops[i] = { ...stop, catalogStopId: matchedCatalog.id };
        routeChanged = true;
      }
    }
    
    if (routeChanged) {
      await updateDoc(doc(db, 'routes', route.id), {
        stops: updatedStops,
        updatedAt: Timestamp.now(),
      });
    }
  }
  
  return newlyAdded;
}
