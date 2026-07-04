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
import { CatalogStop } from '@/types/admin';

const COLLECTION = 'stops';

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
}

export async function deleteCatalogStop(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
