import { Route, Stop, CatalogStop } from '@/types/admin';

/**
 * Export utility functions for converting data to CSV and JSON formats
 */

// Convert JSON to CSV
function jsonToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = value == null ? '' : String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ];
  return csvRows.join('\n');
}

// Download file helper
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export a single route with its stops
 */
export function exportRoute(route: Route, format: 'csv' | 'json') {
  const timestamp = new Date().toISOString().split('T')[0];
  const safeRouteName = route.name.replace(/[^a-zA-Z0-9-]/g, '_');
  
  if (format === 'json') {
    const content = JSON.stringify(route, null, 2);
    downloadFile(content, `route_${safeRouteName}_${timestamp}.json`, 'application/json');
  } else {
    // CSV: one row per stop
    const rows = route.stops.map(stop => ({
      route_name: route.name,
      route_starting_point: route.startingPoint,
      stop_order: stop.order,
      stop_name: stop.name,
      stop_description: stop.description || '',
      latitude: stop.latitude ?? '',
      longitude: stop.longitude ?? '',
      catalog_stop_id: stop.catalogStopId || '',
    }));
    const csv = jsonToCSV(rows);
    downloadFile(csv, `route_${safeRouteName}_${timestamp}.csv`, 'text/csv');
  }
}

/**
 * Export all routes with their stops
 */
export function exportAllRoutes(routes: Route[], format: 'csv' | 'json') {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'json') {
    const content = JSON.stringify(routes, null, 2);
    downloadFile(content, `all_routes_${timestamp}.json`, 'application/json');
  } else {
    // CSV: one row per stop across all routes
    const rows: Record<string, unknown>[] = [];
    routes.forEach(route => {
      route.stops.forEach(stop => {
        rows.push({
          route_name: route.name,
          route_starting_point: route.startingPoint,
          stop_order: stop.order,
          stop_name: stop.name,
          stop_description: stop.description || '',
          latitude: stop.latitude ?? '',
          longitude: stop.longitude ?? '',
          catalog_stop_id: stop.catalogStopId || '',
        });
      });
    });
    const csv = jsonToCSV(rows);
    downloadFile(csv, `all_routes_${timestamp}.csv`, 'text/csv');
  }
}

/**
 * Export catalog stops (library)
 */
export function exportCatalogStops(stops: CatalogStop[], format: 'csv' | 'json') {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'json') {
    const content = JSON.stringify(stops, null, 2);
    downloadFile(content, `stop_library_${timestamp}.json`, 'application/json');
  } else {
    const rows = stops.map(stop => ({
      stop_name: stop.name,
      description: stop.description || '',
      latitude: stop.latitude ?? '',
      longitude: stop.longitude ?? '',
      catalog_id: stop.id,
    }));
    const csv = jsonToCSV(rows);
    downloadFile(csv, `stop_library_${timestamp}.csv`, 'text/csv');
  }
}

/**
 * Export stops on routes (with route context)
 */
export function exportRouteStops(stops: Stop[], format: 'csv' | 'json') {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'json') {
    const content = JSON.stringify(stops, null, 2);
    downloadFile(content, `stops_on_routes_${timestamp}.json`, 'application/json');
  } else {
    const rows = stops.map(stop => ({
      route_name: stop.routeName || '',
      stop_order: stop.order,
      stop_name: stop.name,
      description: stop.description || '',
      latitude: stop.latitude ?? '',
      longitude: stop.longitude ?? '',
      catalog_stop_id: stop.catalogStopId || '',
    }));
    const csv = jsonToCSV(rows);
    downloadFile(csv, `stops_on_routes_${timestamp}.csv`, 'text/csv');
  }
}
