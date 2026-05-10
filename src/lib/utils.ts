import { auth } from './firebase';
import { FirestoreErrorInfo, OperationType } from '../types';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function parseFirestoreDate(date: any): Date | null {
  if (!date) return null;
  
  // Handle Firestore Timestamp
  if (typeof date.toDate === 'function') return date.toDate();
  if (date.seconds !== undefined) return new Date(date.seconds * 1000);
  
  // Handle Javascript Date
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  
  // Handle String (ISO or other formats)
  // Some locales might use different names for months, we try to handle common italian/english ones
  // but standard Date(string) usually only likes ISO or English dates.
  // If the user set "1 maggio", it might fail.
  let cleanDate = date;
  if (typeof date === 'string') {
    // Basic substitution for common Italian months if users manually entered them
    const months: Record<string, string> = {
      'gennaio': 'January', 'febbraio': 'February', 'marzo': 'March', 'aprile': 'April',
      'maggio': 'May', 'giugno': 'June', 'luglio': 'July', 'agosto': 'August',
      'settembre': 'September', 'ottobre': 'October', 'novembre': 'November', 'dicembre': 'December'
    };
    Object.entries(months).forEach(([ita, eng]) => {
      cleanDate = cleanDate.replace(ita, eng);
    });
  }

  const d = new Date(cleanDate);
  return isNaN(d.getTime()) ? null : d;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'EUR') {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
