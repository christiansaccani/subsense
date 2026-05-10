import { 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { subscriptionService } from './subscriptionService';

const COLLECTION_NAME = 'users';

export const userService = {
  async ensureUserProfile(uid: string, email: string, displayName: string, emailVerified: boolean, firstName?: string, lastName?: string, googleLinked?: boolean): Promise<UserProfile | null> {
    const docPath = `${COLLECTION_NAME}/${uid}`;
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      const docSnap = await getDoc(docRef).catch(err => {
        // Specifically catch the getDoc error to provide better context
        console.error(`Permission denied on getDoc ${docPath}:`, err);
        throw err;
      });

      if (!docSnap.exists()) {
        const userData: any = {
          uid,
          email: email || '',
          emailVerified: emailVerified || false,
          displayName: displayName || '',
          activityMonitoringEnabled: false,
          googleLinked: googleLinked || false,
          createdAt: serverTimestamp(),
        };

        if (firstName) userData.firstName = firstName;
        if (lastName) userData.lastName = lastName;

        await setDoc(docRef, userData).catch(err => {
          console.error(`Permission denied on setDoc ${docPath}:`, err);
          throw err;
        });
        return userData as UserProfile;
      }

      const existingData = docSnap.data() as UserProfile;
      let needsUpdate = false;
      const updates: any = {};

      if (existingData.emailVerified !== emailVerified) {
        updates.emailVerified = emailVerified;
        needsUpdate = true;
      }

      if (googleLinked !== undefined && existingData.googleLinked !== googleLinked) {
        updates.googleLinked = googleLinked;
        needsUpdate = true;
      }

      if (firstName && !existingData.firstName) {
        updates.firstName = firstName;
        needsUpdate = true;
      }

      if (lastName && !existingData.lastName) {
        updates.lastName = lastName;
        needsUpdate = true;
      }

      if (displayName && existingData.displayName !== displayName) {
        updates.displayName = displayName;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`Updating profile for ${uid} with:`, updates);
        await updateDoc(docRef, updates).catch(err => {
          console.error(`Permission denied on updateDoc ${docPath}:`, err);
          throw err;
        });
        return { ...existingData, ...updates };
      }

      return existingData;
    } catch (error) {
      console.error('Error in ensureUserProfile:', error);
      const isWriteError = error instanceof Error && (
        error.message.includes('setDoc') || 
        error.message.includes('updateDoc') || 
        error.message.includes('Missing or insufficient permissions') && !error.message.includes('getDoc')
      );
      handleFirestoreError(error, isWriteError ? OperationType.WRITE : OperationType.GET, docPath);
      return null;
    }
  },

  async updateMonitoring(uid: string, enabled: boolean) {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, { activityMonitoringEnabled: enabled });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
    }
  },

  async updateGoogleLinked(uid: string, linked: boolean) {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, { googleLinked: linked });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
    }
  },

  async updateLastAnalysis(uid: string) {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await updateDoc(docRef, { lastAnalysisAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
    }
  },

  async deleteAccount(uid: string) {
    try {
      // 1. Delete all subscriptions
      await subscriptionService.deleteAllUserSubscriptions(uid);
      
      // 2. Delete user profile
      const docRef = doc(db, COLLECTION_NAME, uid);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${uid}`);
      throw error;
    }
  }
};
