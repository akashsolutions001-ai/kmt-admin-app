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
import { Depot } from '@/types/admin';

const COLLECTION = 'depots';

export async function getDepots(): Promise<Depot[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Depot[];
}

export async function addDepot(
  depot: Omit<Depot, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...depot,
    busCount: depot.busCount ?? 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateDepot(
  id: string,
  updates: Partial<Omit<Depot, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteDepot(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
