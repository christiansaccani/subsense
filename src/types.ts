export type BillingCycle = 'monthly' | 'annual';

export type UsageFrequency = 'never' | 'rarely' | 'often' | 'always';

export interface Subscription {
  id?: string;
  userId: string;
  name: string;
  cost: number;
  currency: string;
  cycle: BillingCycle;
  category: string;
  renewalDate: any; // Firestore Timestamp
  remindersEnabled: boolean;
  usageFrequency?: UsageFrequency;
  usageTimeLabel?: string;
  isLinked?: boolean;
  logoUrl?: string;
  createdAt: any; // Firestore Timestamp
  lastUsedAt?: any; // Firestore Timestamp
}

export interface UserProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  firstName?: string;
  lastName?: string;
  activityMonitoringEnabled?: boolean;
  googleLinked?: boolean;
  lastAnalysisAt?: any; // Firestore Timestamp
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
