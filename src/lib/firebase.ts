import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  deleteUser,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  linkWithCredential,
  linkWithPopup,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { initializeApp } from 'firebase/app';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Imposta la persistenza esplicitamente
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
// Rimuovo select_account per rendere il flow più rapido se l'utente è già loggato in Google
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  deleteUser,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  linkWithCredential,
  linkWithPopup
};

export const logout = () => signOut(auth);
