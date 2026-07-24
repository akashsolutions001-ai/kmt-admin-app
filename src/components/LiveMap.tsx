import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CatalogStop, LiveBus } from '@/types/admin';

// ── Custom marker icons ──────────────────────────────────────────────

const STOP_ICON = new L.DivIcon({
  className: 'live-map-stop-icon',
  html: `<div style="
    width: 24px; height: 24px; border-radius: 50%;
    background: #ef4444; border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/>
      <path d="M16 6v6"/>
      <path d="M2 12h19.6"/>
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H6C4.9 6 3.9 6.8 3.6 7.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2C2.5 16.3 3 18 3 18h3"/>
      <circle cx="7" cy="18" r="2"/>
      <circle cx="17" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  tooltipAnchor: [0, -14],
});

const BUS_ICON = new L.DivIcon({
  className: 'live-map-bus-icon',
  html: `<div style="
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#22c55e,#16a34a);
    border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/>
      <path d="M16 6v6"/>
      <path d="M2 12h19.6"/>
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H6C4.9 6 3.9 6.8 3.6 7.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2C2.5 16.3 3 18 3 18h3"/>
      <circle cx="7" cy="18" r="2"/>
      <circle cx="17" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  tooltipAnchor: [18, -10],
});

const BUS_ICON_SELECTED = new L.DivIcon({
  className: 'live-map-bus-icon-selected',
  html: `<div style="
    width:42px;height:42px;border-radius:50%;
    background:linear-gradient(135deg,#f59e0b,#d97706);
    border:3px solid white;box-shadow:0 2px 12px rgba(245,158,11,0.55);
    display:flex;align-items:center;justify-content:center;
    animation:pulse-glow 1.5s ease-in-out infinite;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/>
      <path d="M16 6v6"/>
      <path d="M2 12h19.6"/>
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H6C4.9 6 3.9 6.8 3.6 7.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2C2.5 16.3 3 18 3 18h3"/>
      <circle cx="7" cy="18" r="2"/>
      <circle cx="17" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  tooltipAnchor: [21, -12],
});

// ── Default center (Kolhapur, India) ─────────────────────────────────

const DEFAULT_CENTER: L.LatLngTuple = [16.705, 74.243];
const DEFAULT_ZOOM = 13;

// ── Helper: compute bounds from an array of lat/lng points ───────────

function computeBounds(
  points: Array<{ lat: number; lng: number }>
): L.LatLngBounds | null {
  if (points.length === 0) return null;
  const bounds = L.latLngBounds(points.map((p) => L.latLng(p.lat, p.lng)));
  return bounds;
}

// ── Sub-component: auto-fit the map to given bounds ──────────────────

function MapAutoFit({
  bounds,
  triggerKey,
}: {
  bounds: L.LatLngBounds | null;
  triggerKey: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [bounds, triggerKey, map]);

  return null;
}

// ── Props ────────────────────────────────────────────────────────────

interface LiveMapProps {
  catalogStops: CatalogStop[];
  liveBuses: LiveBus[];
  selectedBusId: string | null;
  onBusSelect?: (busId: string) => void;
  className?: string;
}

// ── Main component ───────────────────────────────────────────────────

export function LiveMap({
  catalogStops,
  liveBuses,
  selectedBusId,
  onBusSelect,
  className = '',
}: LiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Stop markers with valid coordinates
  const validStops = useMemo(
    () =>
      catalogStops.filter(
        (s) =>
          s.latitude != null &&
          s.longitude != null &&
          !isNaN(s.latitude) &&
          !isNaN(s.longitude)
      ),
    [catalogStops]
  );

  // Bus positions: derive from current stop's lat/lng
  const busPositions = useMemo(() => {
    return liveBuses
      .map((bus) => {
        const currentStop = bus.stops.find((s) => s.status === 'current');
        if (
          !currentStop ||
          currentStop.latitude == null ||
          currentStop.longitude == null
        )
          return null;
        return {
          bus,
          lat: currentStop.latitude,
          lng: currentStop.longitude,
          stopName: currentStop.name,
        };
      })
      .filter(Boolean) as Array<{
      bus: LiveBus;
      lat: number;
      lng: number;
      stopName: string;
    }>;
  }, [liveBuses]);

  // Selected bus data
  const selectedBus = liveBuses.find((b) => b.id === selectedBusId);

  // Route polyline for the selected bus
  const selectedRouteCoords = useMemo(() => {
    if (!selectedBus) return [];
    return selectedBus.stops
      .filter(
        (s) =>
          s.latitude != null &&
          s.longitude != null &&
          !isNaN(s.latitude!) &&
          !isNaN(s.longitude!)
      )
      .sort((a, b) => a.order - b.order)
      .map((s) => [s.latitude!, s.longitude!] as L.LatLngTuple);
  }, [selectedBus]);

  // Compute bounds for fitting
  const fitBounds = useMemo(() => {
    if (selectedBus && selectedRouteCoords.length > 0) {
      // Fit to the selected bus's route
      return computeBounds(
        selectedRouteCoords.map(([lat, lng]) => ({ lat, lng }))
      );
    }
    // Return null so map stays at DEFAULT_CENTER on Kolhapur when no bus is selected
    return null;
  }, [selectedBus, selectedRouteCoords]);

  // Trigger key to force re-fit when selection changes
  const fitTrigger = selectedBusId ?? 'none';

  return (
    <div className={`live-map-container ${className}`}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="live-map"
        ref={mapRef}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAutoFit bounds={fitBounds} triggerKey={fitTrigger} />

        {/* All catalog stop markers */}
        {validStops.map((stop) => (
          <Marker
            key={`stop-${stop.id}`}
            position={[stop.latitude!, stop.longitude!]}
            icon={STOP_ICON}
          >
            <Tooltip
              direction="top"
              offset={[0, 0]}
              permanent={true}
              className="stop-name-tooltip"
            >
              <span className="live-map-tooltip">{stop.name}</span>
            </Tooltip>
          </Marker>
        ))}

        {/* Bus markers */}
        {busPositions.map(({ bus, lat, lng, stopName }) => (
          <Marker
            key={`bus-${bus.id}`}
            position={[lat, lng]}
            icon={
              bus.id === selectedBusId ? BUS_ICON_SELECTED : BUS_ICON
            }
            eventHandlers={{
              click: () => onBusSelect?.(bus.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div className="live-map-bus-tooltip">
                <strong>{bus.busNumber}</strong>
                <br />
                <span style={{ fontSize: '11px', opacity: 0.8 }}>
                  {bus.routeName}
                </span>
                <br />
                <span style={{ fontSize: '11px', opacity: 0.7 }}>
                  At: {stopName}
                </span>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Selected bus route polyline */}
        {selectedRouteCoords.length > 1 && (
          <Polyline
            positions={selectedRouteCoords}
            pathOptions={{
              color: '#6366f1',
              weight: 4,
              opacity: 0.8,
              dashArray: '8 6',
            }}
          />
        )}
      </MapContainer>

      {/* Map overlay legend */}
      <div className="live-map-legend">
        <div className="live-map-legend-item">
          <span className="live-map-legend-dot" style={{ background: '#6366f1' }} />
          <span>Stop</span>
        </div>
        {liveBuses.length > 0 && (
          <div className="live-map-legend-item">
            <span className="live-map-legend-dot" style={{ background: '#22c55e' }} />
            <span>Bus</span>
          </div>
        )}
      </div>
    </div>
  );
}
