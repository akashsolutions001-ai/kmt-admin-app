import { useState, useEffect } from 'react';
import {
    collection,
    query,
    onSnapshot,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    QueryConstraint,
    DocumentData,
    orderBy,
    where,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Generic hook to fetch and subscribe to a Firestore collection
export function useFirestoreCollection<T extends DocumentData>(
    collectionName: string,
    ...queryConstraints: QueryConstraint[]
) {
    const [data, setData] = useState<(T & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const collectionRef = collection(db, collectionName);
        const q = queryConstraints.length > 0
            ? query(collectionRef, ...queryConstraints)
            : query(collectionRef);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const documents = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as (T & { id: string })[];
                setData(documents);
                setLoading(false);
            },
            (err) => {
                console.error(`Error fetching ${collectionName}:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [collectionName]);

    return { data, loading, error };
}

// Generic hook to fetch a single document
export function useFirestoreDocument<T extends DocumentData>(
    collectionName: string,
    documentId: string | null
) {
    const [data, setData] = useState<(T & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!documentId) {
            setData(null);
            setLoading(false);
            return;
        }

        const docRef = doc(db, collectionName, documentId);

        const unsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setData({ id: snapshot.id, ...snapshot.data() } as T & { id: string });
                } else {
                    setData(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error(`Error fetching document ${documentId}:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [collectionName, documentId]);

    return { data, loading, error };
}

// Firestore CRUD operations
export async function addDocument<T extends DocumentData>(
    collectionName: string,
    data: T
) {
    try {
        const collectionRef = collection(db, collectionName);
        const docRef = await addDoc(collectionRef, {
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        return { id: docRef.id, success: true };
    } catch (error) {
        console.error('Error adding document:', error);
        throw error;
    }
}

export async function updateDocument<T extends Partial<DocumentData>>(
    collectionName: string,
    documentId: string,
    data: T
) {
    try {
        const docRef = doc(db, collectionName, documentId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating document:', error);
        throw error;
    }
}

export async function deleteDocument(
    collectionName: string,
    documentId: string
) {
    try {
        const docRef = doc(db, collectionName, documentId);
        await deleteDoc(docRef);
        return { success: true };
    } catch (error) {
        console.error('Error deleting document:', error);
        throw error;
    }
}

// Fetch all documents once (no real-time updates)
export async function fetchCollection<T extends DocumentData>(
    collectionName: string,
    ...queryConstraints: QueryConstraint[]
) {
    try {
        const collectionRef = collection(db, collectionName);
        const q = queryConstraints.length > 0
            ? query(collectionRef, ...queryConstraints)
            : query(collectionRef);

        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as (T & { id: string })[];
    } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        throw error;
    }
}

// Export query helpers for convenience
export { orderBy, where, Timestamp };
