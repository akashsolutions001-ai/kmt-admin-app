# KMT Admin Portal

Web administration dashboard for **KMT Municipal Transport Tracking System** (Kolhapur Municipal Transport).

## Features

- Fleet management (buses, drivers, depots)
- Route and stop configuration
- Bus schedules and announcements
- Live trip monitoring
- Passenger analytics
- Complaint management
- Operational reports

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Firebase (Firestore, Auth, Storage)
- TanStack Query

## Setup

```sh
npm install
npm run dev
```

## Firebase Collections

- `buses`, `drivers`, `routes`, `liveBuses`
- `passengers`, `complaints`, `schedules`, `depots`, `announcements`, `maintenance`

## Workflow

1. Admin creates buses, routes, schedules, and drivers
2. Drivers start trips via KMT Driver App
3. GPS updates flow to Realtime Database and Firestore
4. Passengers track buses via KMT Bus Tracker
5. Cloud Functions send ETA and service notifications
