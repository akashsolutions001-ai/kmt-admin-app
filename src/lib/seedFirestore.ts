import {
    collection,
    doc,
    setDoc,
    getDocs,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mockBuses, mockDrivers, mockRoutes, mockLiveBuses, mockComplaints, mockPassengers } from '@/data/mockData';

// Seed all mock data to Firestore
export async function seedFirestore() {
    const BATCH_LIMIT = 500; // Firestore batch limit
    let batch = writeBatch(db);
    let operationCount = 0;

    try {
        console.log('Starting Firestore seeding...');

        // Helper function to commit batch if needed
        const commitIfNeeded = async () => {
            if (operationCount >= BATCH_LIMIT) {
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        };

        // Seed Buses
        console.log(`Seeding ${mockBuses.length} buses...`);
        for (const bus of mockBuses) {
            const docRef = doc(db, 'buses', bus.id);
            batch.set(docRef, {
                ...bus,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            operationCount++;
            await commitIfNeeded();
        }

        // Seed Drivers
        console.log(`Seeding ${mockDrivers.length} drivers...`);
        for (const driver of mockDrivers) {
            const docRef = doc(db, 'drivers', driver.id);
            batch.set(docRef, {
                ...driver,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            operationCount++;
            await commitIfNeeded();
        }

        // Seed Routes (with stops embedded)
        console.log(`Seeding ${mockRoutes.length} routes...`);
        for (const route of mockRoutes) {
            const docRef = doc(db, 'routes', route.id);
            batch.set(docRef, {
                ...route,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            operationCount++;
            await commitIfNeeded();
        }

        // Seed Live Buses (active bus tracking sessions)
        console.log(`Seeding ${mockLiveBuses.length} live buses...`);
        for (const liveBus of mockLiveBuses) {
            const docRef = doc(db, 'liveBuses', liveBus.id);
            batch.set(docRef, {
                ...liveBus,
                startedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            operationCount++;
            await commitIfNeeded();
        }

        // Seed Complaints
        console.log(`Seeding ${mockComplaints.length} complaints...`);
        for (const complaint of mockComplaints) {
            const docRef = doc(db, 'complaints', complaint.id);
            batch.set(docRef, {
                ...complaint,
                createdAt: Timestamp.fromDate(new Date(complaint.createdAt)),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            operationCount++;
            await commitIfNeeded();
        }

        // Seed Passengers
        console.log(`Seeding ${mockPassengers.length} passengers...`);
        for (const passenger of mockPassengers) {
            const docRef = doc(db, 'passengers', passenger.id);
            batch.set(docRef, {
                ...passenger,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            operationCount++;
            await commitIfNeeded();
        }

        // Commit any remaining operations
        if (operationCount > 0) {
            await batch.commit();
        }

        console.log('✅ Firestore seeding completed successfully!');
        console.log(`   - ${mockBuses.length} buses`);
        console.log(`   - ${mockDrivers.length} drivers`);
        console.log(`   - ${mockRoutes.length} routes`);
        console.log(`   - ${mockLiveBuses.length} live buses`);
        console.log(`   - ${mockComplaints.length} complaints`);
        console.log(`   - ${mockPassengers.length} passengers`);

        return { success: true };
    } catch (error) {
        console.error('❌ Error seeding Firestore:', error);
        throw error;
    }
}

// Check if data already exists
export async function checkExistingData() {
    try {
        const busesSnapshot = await getDocs(collection(db, 'buses'));
        const driversSnapshot = await getDocs(collection(db, 'drivers'));
        const routesSnapshot = await getDocs(collection(db, 'routes'));

        return {
            buses: busesSnapshot.size,
            drivers: driversSnapshot.size,
            routes: routesSnapshot.size,
            hasData: busesSnapshot.size > 0 || driversSnapshot.size > 0 || routesSnapshot.size > 0,
        };
    } catch (error) {
        console.error('Error checking existing data:', error);
        return { buses: 0, drivers: 0, routes: 0, hasData: false };
    }
}

// Clear all data from Firestore (use with caution!)
export async function clearFirestore() {
    const collections = ['buses', 'drivers', 'routes', 'liveBuses', 'complaints', 'passengers', 'schedules', 'depots', 'announcements', 'maintenance'];

    for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Cleared ${collectionName} collection`);
    }

    console.log('✅ All collections cleared');
}
