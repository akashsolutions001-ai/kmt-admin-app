export type BusStatus = 'idle' | 'running';
export type DriverStatus = 'active' | 'inactive';
export type StopStatus = 'reached' | 'current' | 'pending';
export type ComplaintStatus = 'pending' | 'in_review' | 'resolved' | 'rejected';

export interface Bus {
  id: string;
  busNumber: string;
  assignedDriverId: string | null;
  assignedRouteId: string | null;
  status: BusStatus;
}

export interface Driver {
  id: string;
  name: string;
  driverId: string;
  assignedBusId: string | null;
  status: DriverStatus;
  phone?: string;
  password?: string;
}

export interface Stop {
  id: string;
  name: string;
  order: number;
  latitude?: number;
  longitude?: number;
  mapLink?: string;
  catalogStopId?: string;
  routeId?: string;
  routeName?: string;
}

/** Standalone bus stop in the `stops` Firestore collection */
export interface CatalogStop {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  mapLink?: string;
  address?: string;
}

export interface Route {
  id: string;
  name: string;
  startingPoint: string;
  stops: Stop[];
}

export interface LiveBus {
  id: string;
  busNumber: string;
  driverName: string;
  routeName: string;
  stops: Array<Stop & { status: StopStatus }>;
  isDelayed?: boolean;
}

export interface Complaint {
  id: string;
  passengerName: string;
  passengerId: string;
  subject: string;
  description: string;
  category: string;
  routeName?: string;
  busNumber?: string;
  status: ComplaintStatus;
  createdAt: string;
}

export type PassengerStatus = 'active' | 'inactive';

export interface Passenger {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  passengerId?: string;
  routeId?: string | null;
  stopId?: string | null;
  routeName?: string | null;
  stopName?: string | null;
  favouriteRoutes?: string[];
  favouriteStops?: string[];
  status: PassengerStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Depot {
  id: string;
  name: string;
  address: string;
  contactPhone?: string;
  busCount?: number;
}

export interface Schedule {
  id: string;
  routeId: string;
  routeName: string;
  busNumber: string;
  departureTime: string;
  frequency?: string;
  days?: string[];
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  active: boolean;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  busNumber: string;
  type: 'breakdown' | 'accident' | 'maintenance' | 'sos';
  description: string;
  reportedBy: string;
  status: 'open' | 'resolved';
  createdAt: string;
}
