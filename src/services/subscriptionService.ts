import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Subscription, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';

const COLLECTION_NAME = 'subscriptions';

export const subscriptionService = {
  async addSubscription(userId: string, sub: Omit<Subscription, 'id' | 'userId' | 'createdAt'>) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...sub,
        userId,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  async updateSubscription(subId: string, updates: Partial<Subscription>) {
    try {
      const docRef = doc(db, COLLECTION_NAME, subId);
      // Clean undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );
      if (Object.keys(cleanUpdates).length > 0) {
        await updateDoc(docRef, cleanUpdates);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${subId}`);
    }
  },

  async deleteSubscription(subId: string) {
    try {
      const docRef = doc(db, COLLECTION_NAME, subId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${subId}`);
    }
  },

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('renewalDate', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Subscription));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      return [];
    }
  },

  async toggleAppLinking(subId: string, linked: boolean) {
    try {
      const docRef = doc(db, COLLECTION_NAME, subId);
      await updateDoc(docRef, { isLinked: linked });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${subId}`);
    }
  },

  async deleteAllUserSubscriptions(userId: string) {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
    }
  }
};
