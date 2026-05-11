import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, logout, reload, deleteUser, EmailAuthProvider, reauthenticateWithCredential, linkWithPopup, googleProvider, db } from './lib/firebase';
import { onAuthStateChanged, User, sendEmailVerification } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { Subscription, UserProfile } from './types';
import { subscriptionService } from './services/subscriptionService';
import { userService } from './services/userService';
import Dashboard from './components/Dashboard';
import UsageAnalysis from './components/UsageAnalysis';
import Auth from './components/Auth';
import AddSubscriptionModal from './components/AddSubscriptionModal';
import PermissionRequest from './components/PermissionRequest';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import AccountDeleteModal from './components/AccountDeleteModal';
import { 
  LogOut, 
  Plus, 
  Bell, 
  Trash2, 
  Info,
  Layers,
  BarChart3,
  Search,
  LayoutDashboard,
  CreditCard,
  Zap,
  Settings,
  Edit2,
  User as UserIcon,
  Mail,
  ArrowRight,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, parseFirestoreDate } from './lib/utils';
import { getServiceLogo } from './constants';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [subscriptionToEdit, setSubscriptionToEdit] = useState<Subscription | null>(null);
  const [view, setView] = useState<'dashboard' | 'list' | 'analysis' | 'settings'>('dashboard');
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<Subscription | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isAccountDeleteModalOpen, setIsAccountDeleteModalOpen] = useState(false);
  const [isVerifiedNow, setIsVerifiedNow] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isLinkingGoogleInSettings, setIsLinkingGoogleInSettings] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);

  const checkVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    setIsVerifying(true);
    try {
      await reload(auth.currentUser);
      // Force token refresh to update custom claims like email_verified in security rules
      await auth.currentUser.getIdToken(true);
      setUser({ ...auth.currentUser });
    } catch (err) {
      console.error('Error reloading user:', err);
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationError('Email di verifica reinviata!');
      setTimeout(() => setVerificationError(null), 5000);
    } catch (err: any) {
      setVerificationError('Errore nell\'invio della mail. Riprova più tardi.');
    }
  };

  const fetchSubscriptions = useCallback(async (userId: string) => {
    const data = await subscriptionService.getUserSubscriptions(userId);
    setSubscriptions(data);
    setLoading(false);
  }, []);

  const fetchProfile = useCallback(async (u: User) => {
    // If we have displayName from Auth, it's likely "FirstName LastName"
    let firstName = '';
    let lastName = '';
    if (u.displayName) {
      const parts = u.displayName.split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
    const isGoogle = u.providerData.some(p => p.providerId === 'google.com');
    const p = await userService.ensureUserProfile(u.uid, u.email || '', u.displayName || '', u.emailVerified || isGoogle, firstName, lastName, isGoogle);
    setProfile(p);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Real-time profile listener
        const docRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Ensure profile exists
            fetchProfile(currentUser);
          }
        }, (error) => {
          console.error("Error listening to profile:", error);
          if (error.message.includes('insufficient permissions')) {
            // Retry fetch once
            fetchProfile(currentUser);
          }
        });
        
        // Check if this is a Google user who needs to set a password
        const hasPassword = currentUser.providerData.some(p => p.providerId === 'password');
        const isGoogle = currentUser.providerData.some(p => p.providerId === 'google.com');
        
        // Forced password setting for Google users - truly mandatory
        if (isGoogle && !hasPassword) {
          setIsLinkingGoogle(true);
        } else {
          setIsLinkingGoogle(false);
          sessionStorage.removeItem('pending_google_link');
        }

        if (currentUser.emailVerified || isGoogle) {
          fetchSubscriptions(currentUser.uid);
        } else {
          setLoading(false);
        }
      } else {
        setSubscriptions([]);
        setProfile(null);
        setLoading(false);
        setIsLinkingGoogle(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = undefined;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [fetchSubscriptions, fetchProfile]);

  const handleDelete = async () => {
    if (subscriptionToDelete?.id) {
      await subscriptionService.deleteSubscription(subscriptionToDelete.id);
      if (user) fetchSubscriptions(user.uid);
      setSubscriptionToDelete(null);
    }
  };

  const handleToggleLink = async (sub: Subscription) => {
    if (!sub.id) return;
    await subscriptionService.toggleAppLinking(sub.id, !sub.isLinked);
    if (user) fetchSubscriptions(user.uid);
  };

  const handleDeleteAccount = () => {
    setIsAccountDeleteModalOpen(true);
  };

  const confirmDeleteAccount = async (password?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('Errore: Utente non autenticato.');
      return;
    }
    
    setIsDeletingAccount(true);
    try {
      // 1. Re-authenticate if password is provided
      if (password && currentUser.email) {
        console.log('Riautenticazione in corso...');
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // 2. Delete Firestore data
      console.log('Inizio eliminazione dati Firestore...');
      await userService.deleteAccount(currentUser.uid);
      
      // 3. Delete Auth account
      console.log('Inizio eliminazione account utente...');
      await deleteUser(currentUser);
      
      alert('Tutti i dati e l\'account sono stati eliminati correttamente.');
    } catch (err: any) {
      console.error('Errore durante l\'eliminazione dell\'account:', err);
      
      let errorMessage = 'Si è verificato un errore durante l\'eliminazione.';
      
      if (err.code === 'auth/requires-recent-login' || 
          err.code === 'auth/credential-too-old' ||
          err.message?.includes('requires-recent-login') ||
          err.message?.includes('credential-too-old')) {
        errorMessage = 'Per sicurezza, questa operazione richiede un accesso recente. Poiché la password non è bastata o non è supportata, fai Logout, rientra e riprova.';
      } else if (err.code === 'auth/wrong-password' || err.message?.includes('wrong-password')) {
        errorMessage = 'Password errata. Riprova.';
      } else if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        errorMessage = 'Operazione non consentita. Assicurati che l\'eliminazione degli utenti e il provider utilizzato siano abilitati nella Console di Firebase.';
      } else if (err.message?.includes('permission-denied') || err.message?.includes('insufficient permissions')) {
        errorMessage = 'Errore di permessi. Assicurati di essere connesso correttamente.';
      } else if (err.message) {
        // Try to parse JSON error from handleFirestoreError
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) errorMessage = `Errore data: ${parsed.error}`;
        } catch {
          errorMessage = `Dettagli errore: ${err.message}`;
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsDeletingAccount(false);
      setIsAccountDeleteModalOpen(false);
    }
  };

  const handleAcceptMonitoring = async () => {
    if (!user) return;
    await userService.updateMonitoring(user.uid, true);
    fetchProfile(user);
  };

  const handleLinkGoogle = async () => {
    if (!user) return;
    setIsLinkingGoogleInSettings(true);
    try {
      await linkWithPopup(user, googleProvider);
      // Update DB record
      await userService.updateGoogleLinked(user.uid, true);
      // Refresh user and profile
      await reload(auth.currentUser!);
      setUser({ ...auth.currentUser! });
      if (auth.currentUser) fetchProfile(auth.currentUser);
      alert('Account Google collegato con successo!');
    } catch (err: any) {
      console.error('Error linking Google account:', err);
      if (err.code === 'auth/credential-already-in-use') {
        alert('Questo account Google è già collegato a un altro utente.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        alert('Errore durante il collegamento dell\'account Google.');
      }
    } finally {
      setIsLinkingGoogleInSettings(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;

    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true);
      setStartY(e.pageY - node.offsetTop);
      setScrollTop(node.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const y = e.pageY - node.offsetTop;
      const walk = (y - startY) * 1.5; // Scroll speed
      node.scrollTop = scrollTop - walk;
    };

    node.addEventListener('mousedown', handleMouseDown);
    node.addEventListener('mouseleave', handleMouseLeave);
    node.addEventListener('mouseup', handleMouseUp);
    node.addEventListener('mousemove', handleMouseMove);

    return () => {
      node.removeEventListener('mousedown', handleMouseDown);
      node.removeEventListener('mouseleave', handleMouseLeave);
      node.removeEventListener('mouseup', handleMouseUp);
      node.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging, startY, scrollTop]);

  useEffect(() => {
    let interval: any;
    const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');
    
    const checkStatus = async () => {
      if (user && !user.emailVerified && !isGoogleUser) {
        try {
          await reload(auth.currentUser!);
          if (auth.currentUser?.emailVerified) {
            setIsVerifiedNow(true);
            if (interval) clearInterval(interval);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }
    };

    if (user && !user.emailVerified && !isGoogleUser) {
      // Initial check
      checkStatus();
      
      // Polling
      interval = setInterval(checkStatus, 3000);
      
      // Visibility check (faster update when user returns to tab)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkStatus();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        if (interval) clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user]);

  const handleUpdate = useCallback(() => user && fetchSubscriptions(user.uid), [user, fetchSubscriptions]);
  const handleProfileUpdate = useCallback(() => user && fetchProfile(user), [user, fetchProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');

  if (!user || isLinkingGoogle) {
    return (
      <Auth 
        user={user} 
        onComplete={() => {
          setIsLinkingGoogle(false);
          sessionStorage.removeItem('pending_google_link');
        }} 
      />
    );
  }

  if (!user.emailVerified && !isGoogleUser && !isVerifiedNow) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-brand-dark">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] mesh-gradient-red blur-[120px] rounded-full opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] mesh-gradient-purple blur-[120px] rounded-full opacity-50"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="frosted-card max-w-md w-full p-10 text-center relative z-10"
        >
          <div className="w-20 h-20 bg-brand-red/10 border border-brand-red/20 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-pulse text-brand-red">
            <Mail className="w-10 h-10" />
          </div>
          
          <h1 className="text-3xl font-black mb-4 tracking-tighter">
            {profile?.firstName ? `Ciao, ${profile.firstName}!` : 'Verifica la tua email'}
          </h1>
          
          <p className="text-slate-400 mb-10 leading-relaxed text-sm px-4">
            Abbiamo inviato un link di conferma a <span className="text-white font-bold">{user.email}</span>. 
            Clicca sul link per attivare il tuo account SubSense e iniziare a risparmiare.
          </p>
          
          <div className="space-y-6">
            <button
              onClick={resendVerification}
              className="w-full py-4 bg-brand-red text-white font-black rounded-xl hover:bg-brand-red/90 transition-all shadow-xl shadow-brand-red/20 flex items-center justify-center gap-2"
            >
              Non hai ricevuto nulla? Reinvia
              <ArrowRight className="w-5 h-5 opacity-50" />
            </button>
            
            <div className="h-4">
              {verificationError && (
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-red animate-pulse">
                  {verificationError}
                </p>
              )}
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
              <button
                onClick={logout}
                className="flex items-center gap-2 text-slate-500 text-sm font-bold hover:text-white transition-colors mx-auto"
              >
                <ChevronLeft className="w-4 h-4" />
                Torna al login
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isVerifiedNow) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-brand-dark">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] mesh-gradient-red blur-[120px] rounded-full opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] mesh-gradient-purple blur-[120px] rounded-full opacity-50"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="frosted-card max-w-md w-full p-10 text-center relative z-10"
        >
          <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 animate-in zoom-in-50 duration-700">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          
          <h1 className="text-4xl font-black mb-4 tracking-tighter text-white">
            Email Confermata!
          </h1>
          
          <p className="text-slate-400 mb-12 leading-relaxed text-sm px-6">
            Fantastico! Hai confermato la mail con successo. Il tuo account SubSense è ora attivo e pronto all'uso.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => {
                setIsVerifiedNow(false);
                if (user) fetchSubscriptions(user.uid);
              }}
              className="w-full py-4 bg-brand-red text-white font-black rounded-xl hover:bg-brand-red/90 transition-all shadow-xl shadow-brand-red/20 flex items-center justify-center gap-2 group"
            >
              Entra nella Dashboard
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
            
            <button
              onClick={logout}
              className="w-full py-4 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all text-sm text-slate-400"
            >
              Torna al login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark text-white relative flex flex-col h-screen overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-full h-[50%] mesh-gradient-red pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-full h-[50%] mesh-gradient-purple pointer-events-none"></div>

      {/* Header Mobile */}
      <header className="h-16 flex items-center justify-between px-6 frosted-nav shrink-0 z-40 bg-brand-dark/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center shadow-lg shadow-brand-red/30">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter leading-none">SubSense</span>
            {profile?.activityMonitoringEnabled && (
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[7px] font-black tracking-[0.1em] uppercase text-emerald-500">Live Guard</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={logout} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main 
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto no-scrollbar relative z-10 px-5 pt-6 pb-32",
          isDragging ? "cursor-grabbing" : "cursor-default"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none mb-1">
              {view === 'dashboard' && 'Dashboard'}
              {view === 'list' && 'Abbonamenti'}
              {view === 'analysis' && 'Analisi AI'}
            </h1>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              {view === 'dashboard' && 'Riepilogo spese'}
              {view === 'list' && `${subscriptions.length} servizi attivi`}
              {view === 'analysis' && 'Ottimizzazione'}
            </p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="touch-button w-10 h-10 bg-brand-red rounded-full flex items-center justify-center shadow-lg shadow-brand-red/40"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>

        {view === 'dashboard' && <Dashboard subscriptions={subscriptions} />}
        
        {view === 'list' && (
          <div className="space-y-3">
            {subscriptions.map(sub => (
              <div 
                key={sub.id} 
                className="frosted-card p-4 active:bg-white/10 transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-xl font-black border border-white/10 shrink-0 overflow-hidden">
                  {sub.logoUrl || getServiceLogo(sub.name) ? (
                    <img 
                      src={sub.logoUrl || getServiceLogo(sub.name)!} 
                      alt={sub.name} 
                      className="w-full h-full object-contain p-2"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    sub.name[0]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold truncate text-sm">{sub.name}</h4>
                    <p className="font-mono font-black text-brand-red text-sm">€{sub.cost.toFixed(2)}</p>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                      {sub.category} • {sub.cycle === 'monthly' ? 'Mese' : 'Anno'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Rinnovo: {sub.renewalDate ? format(sub.renewalDate.toDate(), 'dd MMM', { locale: it }) : 'N/D'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSubscriptionToEdit(sub)}
                    className="p-2 bg-white/5 text-slate-400 rounded-lg hover:text-white transition-all"
                    title="Modifica"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setSubscriptionToDelete(sub)}
                    className="p-2 text-slate-600 hover:text-brand-red transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {subscriptions.length === 0 && (
              <div className="py-20 text-center text-slate-600">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold">Nessun servizio attivo</p>
                <p className="text-xs opacity-60">Aggiungi i tuoi abbonamenti per iniziare.</p>
              </div>
            )}
          </div>
        )}

        {view === 'analysis' && (
          <UsageAnalysis 
            user={user}
            profile={profile}
            subscriptions={subscriptions} 
            onUpdate={handleUpdate} 
            onProfileUpdate={handleProfileUpdate}
            onAnalyzingStateChange={setIsAnalyzingAI}
          />
        )}

        {view === 'settings' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="frosted-card p-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-red mb-4">Profilo</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'Utente'} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-slate-500" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-lg">
                    {profile?.firstName && profile?.lastName 
                      ? `${profile.firstName} ${profile.lastName}` 
                      : user.displayName || 'Utente SubSense'}
                  </h4>
                  <p className="text-slate-400 text-sm">{user.email}</p>
                </div>
              </div>

              {!isGoogleUser && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collegamenti</h3>
                    <p className="text-slate-400 text-xs mb-4">Collega il tuo account Google per accedere più velocemente e sincronizzare il tuo profilo.</p>
                    <button 
                      onClick={handleLinkGoogle}
                      disabled={isLinkingGoogleInSettings}
                      className="w-full h-14 bg-white text-brand-dark rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-200 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    >
                      {isLinkingGoogleInSettings ? (
                        <div className="w-5 h-5 border-2 border-brand-dark/30 border-t-brand-dark rounded-full animate-spin" />
                      ) : (
                        <>
                          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                          Collega Account Google
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="frosted-card p-6 border-brand-red/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-red mb-4">Zona Pericolo</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                L'eliminazione dell'account è un'operazione irreversibile. Perderai l'accesso a tutti i tuoi dati e cronologia degli abbonamenti.
              </p>
              <button 
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="w-full py-4 border border-brand-red/20 text-brand-red font-bold rounded-xl hover:bg-brand-red hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {isDeletingAccount ? (
                  <div className="w-5 h-5 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Elimina Account
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Mobile */}
      <nav className="bottom-nav">
        <button 
          onClick={() => setView('dashboard')}
          className={cn("nav-item touch-button", view === 'dashboard' ? "nav-item-active" : "nav-item-inactive")}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span>Home</span>
        </button>
        <button 
          onClick={() => setView('list')}
          className={cn("nav-item touch-button", view === 'list' ? "nav-item-active" : "nav-item-inactive")}
        >
          <CreditCard className="w-6 h-6" />
          <span>Servizi</span>
        </button>
        <button 
          onClick={() => setView('analysis')}
          className={cn("nav-item touch-button relative", view === 'analysis' ? "nav-item-active" : "nav-item-inactive")}
        >
          <Zap className="w-6 h-6" />
          <span>Analisi</span>
          {(() => {
            const lastDate = parseFirestoreDate(profile?.lastAnalysisAt);
            return lastDate && differenceInDays(new Date(), lastDate) >= 7 ? (
              <span className="absolute top-2 right-6 w-2 h-2 bg-brand-red rounded-full border border-brand-dark animate-pulse" />
            ) : null;
          })()}
        </button>
        <button 
          onClick={() => setView('settings')}
          className={cn("nav-item touch-button", view === 'settings' ? "nav-item-active" : "nav-item-inactive")}
        >
          <Settings className="w-6 h-6" />
          <span>Profilo</span>
        </button>
      </nav>

      {(isAddModalOpen || subscriptionToEdit) && (
        <AddSubscriptionModal 
          userId={user.uid}
          onClose={() => {
            setIsAddModalOpen(false);
            setSubscriptionToEdit(null);
          }}
          onAdded={() => user && fetchSubscriptions(user.uid)}
          subscriptionToEdit={subscriptionToEdit}
        />
      )}

      {profile && !profile.activityMonitoringEnabled && (
        <PermissionRequest onAccept={handleAcceptMonitoring} />
      )}

      <DeleteConfirmationModal 
        isOpen={!!subscriptionToDelete}
        onClose={() => setSubscriptionToDelete(null)}
        onConfirm={handleDelete}
        subscriptionName={subscriptionToDelete?.name || ''}
      />

      <AccountDeleteModal 
        isOpen={isAccountDeleteModalOpen}
        onClose={() => setIsAccountDeleteModalOpen(false)}
        onConfirm={confirmDeleteAccount}
        isLoading={isDeletingAccount}
        requiresPassword={user?.providerData?.some(p => p.providerId === 'password')}
      />

      <AnimatePresence>
        {isAnalyzingAI && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center p-6 bg-brand-dark/95 backdrop-blur-2xl pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="text-center px-8 py-10 frosted-card border-brand-red/30 max-w-xs w-full shadow-2xl shadow-brand-red/40 relative z-[1000000]"
            >
              <div className="relative w-24 h-24 mx-auto mb-8">
                {/* Outer spinning ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-0 border-2 border-brand-red/20 border-t-brand-red rounded-full"
                />
                {/* Inner icon (static) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="w-10 h-10 text-brand-red" />
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 bg-brand-red/20 blur-2xl rounded-full scale-75 animate-pulse" />
              </div>

              <h3 className="text-2xl font-black tracking-tighter text-white mb-2">Analisi AI...</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                SubSense sta elaborando i dati
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
