import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Bus, User, Route, ChevronDown, ChevronUp } from 'lucide-react';
import { StopStatus, LiveBus } from '@/types/admin';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const stopStatusConfig: Record<StopStatus, { icon: string; label: string; className: string }> = {
  reached: { icon: '🟢', label: 'Reached', className: 'text-success' },
  current: { icon: '🔵', label: 'Current', className: 'text-primary' },
  pending: { icon: '⭕', label: 'Pending', className: 'text-muted-foreground' },
};

export default function LiveMonitoring() {
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [showBusList, setShowBusList] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const liveBusesSnapshot = await getDocs(query(collection(db, 'liveBuses'), orderBy('busNumber')));
      const liveBusesData = liveBusesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LiveBus[];
      setLiveBuses(liveBusesData);
      if (liveBusesData.length > 0 && !selectedBusId) {
        setSelectedBusId(liveBusesData[0].id);
      }
    } catch (error) {
      console.error('Error loading live buses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBus = liveBuses.find(b => b.id === selectedBusId);

  // Mobile: Toggle bus list visibility
  const handleBusSelect = (busId: string) => {
    setSelectedBusId(busId);
    setShowBusList(false);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Live Monitoring" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Live Monitoring"
      subtitle="Real-time view of active buses"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Mobile Bus Selector */}
        <div className="lg:hidden">
          <button
            onClick={() => setShowBusList(!showBusList)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <Bus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{selectedBus?.busNumber || 'Select a bus'}</p>
                <p className="text-xs text-muted-foreground">{selectedBus?.routeName || 'No bus selected'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-badge status-running text-xs">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Running
              </span>
              {showBusList ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </button>

          {/* Mobile Bus List Dropdown */}
          {showBusList && (
            <div className="mt-2 rounded-lg border bg-card divide-y max-h-64 overflow-y-auto">
              {liveBuses.map((bus) => {
                const currentStop = bus.stops.find(s => s.status === 'current');
                const reachedCount = bus.stops.filter(s => s.status === 'reached').length;

                return (
                  <button
                    key={bus.id}
                    onClick={() => handleBusSelect(bus.id)}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors',
                      selectedBusId === bus.id ? 'bg-muted' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{bus.busNumber}</p>
                        <p className="text-xs text-muted-foreground">{bus.routeName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {reachedCount}/{bus.stops.length} stops
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop: Left Pane - Active Buses List */}
        <div className="hidden lg:block lg:col-span-4">
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-medium">Active Buses ({liveBuses.length})</h3>
            </div>
            <div className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
              {liveBuses.map((bus) => {
                const currentStop = bus.stops.find(s => s.status === 'current');
                const reachedCount = bus.stops.filter(s => s.status === 'reached').length;

                return (
                  <button
                    key={bus.id}
                    onClick={() => setSelectedBusId(bus.id)}
                    className={cn(
                      'w-full px-4 py-4 text-left transition-colors hover:bg-muted/50',
                      selectedBusId === bus.id && 'bg-muted'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
                        selectedBusId === bus.id ? 'bg-primary text-primary-foreground' : 'bg-success/10 text-success'
                      )}>
                        <Bus className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{bus.busNumber}</p>
                          <span className="status-badge status-running flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            Running
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">{bus.routeName}</p>
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          {currentStop ? `At: ${currentStop.name}` : 'In transit'}
                        </p>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-success transition-all"
                            style={{ width: `${((reachedCount + 0.5) / bus.stops.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {liveBuses.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No active buses at the moment
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane - Bus Details */}
        <div className="lg:col-span-8">
          {selectedBus ? (
            <div className="space-y-4 lg:space-y-6">
              {/* Bus Info Card */}
              <div className="rounded-lg border bg-card p-4 lg:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 lg:h-12 w-10 lg:w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                      <Bus className="h-5 lg:h-6 w-5 lg:w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Bus Number</p>
                      <p className="text-base lg:text-lg font-semibold truncate">{selectedBus.busNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 lg:h-12 w-10 lg:w-12 items-center justify-center rounded-lg bg-success/10 flex-shrink-0">
                      <User className="h-5 lg:h-6 w-5 lg:w-6 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Driver</p>
                      <p className="text-base lg:text-lg font-semibold truncate">{selectedBus.driverName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 lg:h-12 w-10 lg:w-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                      <Route className="h-5 lg:h-6 w-5 lg:w-6 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Route</p>
                      <p className="text-base lg:text-lg font-semibold truncate">{selectedBus.routeName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stops Progress */}
              <div className="rounded-lg border bg-card">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-medium">Route Progress</h3>
                </div>
                <div className="p-4 max-h-[50vh] lg:max-h-none overflow-y-auto">
                  <div className="relative">
                    {/* Progress Line */}
                    <div className="absolute left-[15px] lg:left-[19px] top-0 bottom-0 w-0.5 bg-border" />

                    <div className="space-y-0">
                      {selectedBus.stops.map((stop, index) => {
                        const config = stopStatusConfig[stop.status];
                        return (
                          <div key={stop.id} className="relative flex items-start gap-3 lg:gap-4 pb-4 lg:pb-6 last:pb-0">
                            {/* Status Icon */}
                            <div className={cn(
                              'relative z-10 flex h-8 lg:h-10 w-8 lg:w-10 items-center justify-center rounded-full border-2 bg-card flex-shrink-0',
                              stop.status === 'reached' && 'border-success bg-success/10',
                              stop.status === 'current' && 'border-primary bg-primary/10',
                              stop.status === 'pending' && 'border-muted-foreground/30'
                            )}>
                              {stop.status === 'reached' && (
                                <div className="h-2 lg:h-3 w-2 lg:w-3 rounded-full bg-success" />
                              )}
                              {stop.status === 'current' && (
                                <div className="h-2 lg:h-3 w-2 lg:w-3 rounded-full bg-primary animate-pulse" />
                              )}
                              {stop.status === 'pending' && (
                                <div className="h-2 lg:h-3 w-2 lg:w-3 rounded-full bg-muted-foreground/30" />
                              )}
                            </div>

                            {/* Stop Info */}
                            <div className="flex-1 pt-1 lg:pt-2 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className="text-sm font-medium truncate">{stop.name}</span>
                                  {stop.status === 'current' && (
                                    <span className="status-badge status-current text-xs">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <span className={cn('text-xs lg:text-sm flex-shrink-0', config.className)}>
                                  {config.label}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">Stop #{stop.order}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 lg:gap-6 rounded-lg border bg-muted/30 px-3 lg:px-4 py-2 lg:py-3 flex-wrap">
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <span className="text-base lg:text-lg">🟢</span>
                  <span className="text-xs lg:text-sm text-muted-foreground">Reached</span>
                </div>
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <span className="text-base lg:text-lg">🔵</span>
                  <span className="text-xs lg:text-sm text-muted-foreground">Current</span>
                </div>
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <span className="text-base lg:text-lg">⭕</span>
                  <span className="text-xs lg:text-sm text-muted-foreground">Pending</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-48 lg:h-64 items-center justify-center rounded-lg border bg-card">
              <p className="text-muted-foreground text-sm">Select a bus to view details</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
