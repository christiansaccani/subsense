import React, { useState } from 'react';
import { 
  auth, 
  signInWithGoogle, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential
} from '../lib/firebase';
import { userService } from '../services/userService';
import { 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ChevronLeft, 
  Layers,
  ArrowRight,
  User,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

type AuthMode = 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'GOOGLE_PASSWORD_LINK';

interface AuthProps {
  user?: any;
  onComplete?: () => void;
}

export default function Auth({ user: propUser, onComplete }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>(propUser ? 'GOOGLE_PASSWORD_LINK' : 'LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem('pending_google_link', 'true');
      const result = await signInWithGoogle();
      const user = result.user;
      
      // Check if user already has a password provider
      const isPasswordUser = user.providerData.some(p => p.providerId === 'password');
      
      if (isPasswordUser) {
        // Already secure, just clear the flag we just set
        sessionStorage.removeItem('pending_google_link');
      }
    } catch (err: any) {
      console.error('Google Auth error:', err);
      sessionStorage.removeItem('pending_google_link');
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Errore durante l\'accesso con Google.');
      }
      setLoading(false);
    }
  };

  const handleLinkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propUser || password.length < 6) {
      setError('La password deve contenere almeno 6 caratteri.');
      return;
    }
    
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(propUser.email!, password);
      await linkWithCredential(propUser, credential);
      
      // Update profile and ensure Firestore record
      const displayName = propUser.displayName || '';
      const [fName, ...lNames] = displayName.split(' ');
      const isGoogle = propUser.providerData.some((p: any) => p.providerId === 'google.com');
      await userService.ensureUserProfile(
        propUser.uid,
        propUser.email!,
        displayName,
        propUser.emailVerified || isGoogle,
        fName || '',
        lNames.join(' ') || '',
        isGoogle
      );
      
      setResetSent(true);
    } catch (err: any) {
      console.error('Linking error:', err);
      if (err.code === 'auth/credential-already-in-use') {
        setError('Questa email è già associata a un altro account con password.');
        onComplete?.(); // Just let them in if it's already linked? 
                       // Actually, better to just finish if it's already linked
      } else {
        setError('Errore durante l\'impostazione della password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Just notify parent to stop showing the link screen
    onComplete?.();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode !== 'FORGOT_PASSWORD' && password.length < 6) {
        throw { code: 'auth/weak-password' };
      }

      if (mode === 'LOGIN') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'SIGNUP') {
        if (!firstName || !lastName) {
          throw new Error('Inserisci nome e cognome per registrarti.');
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: `${firstName} ${lastName}`
        });
        
        // Initialize user profile in Firestore
        await userService.ensureUserProfile(
          userCredential.user.uid, 
          email, 
          `${firstName} ${lastName}`, 
          false, 
          firstName, 
          lastName,
          false
        );

        await sendEmailVerification(userCredential.user);
        setResetSent(true); 
      } else if (mode === 'FORGOT_PASSWORD') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'Si è verificato un errore durante l\'autenticazione.';
      
      const errorCode = err.code || (err.message && err.message.match(/\((auth\/[^)]+)\)/)?.[1]);

      switch (errorCode || err.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-login-credentials':
          message = 'Email o password non corretti. Riprova.';
          break;
        case 'auth/too-many-requests':
          message = 'Accesso temporaneamente disabilitato per troppi tentativi falliti. Riprova più tardi o reimposta la password.';
          break;
        case 'auth/email-already-in-use':
          message = 'Questa email è già associata a un account. Prova ad accedere o recupera la password.';
          break;
        case 'auth/invalid-email':
          message = 'L\'indirizzo email inserito non è valido.';
          break;
        case 'auth/weak-password':
          message = 'La password deve contenere almeno 6 caratteri.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Metodo di accesso non abilitato. Assicurati che l\'email/password sia abilitata nella console Firebase.';
          break;
        case 'auth/popup-closed-by-user':
          message = 'Accesso annullato.';
          break;
        case 'auth/network-request-failed':
          message = 'Errore di rete. Controlla la tua connessione.';
          break;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 md:p-6 overflow-hidden bg-brand-dark">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] mesh-gradient-red blur-[120px] rounded-full opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] mesh-gradient-purple blur-[120px] rounded-full opacity-50"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="frosted-card max-w-sm w-full p-6 md:p-8 relative z-10"
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-brand-red rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand-red/40">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black mb-1 tracking-tighter">SubSense</h1>
          <p className="text-slate-400 text-xs">
            {mode === 'LOGIN' && 'Accedi al tuo account'}
            {mode === 'SIGNUP' && 'Crea un nuovo account'}
            {mode === 'FORGOT_PASSWORD' && 'Recupera la tua password'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, h: 0 }}
            animate={{ opacity: 1, h: 'auto' }}
            className="mb-3 p-2 bg-brand-red/10 border border-brand-red/20 rounded-lg flex items-center gap-2 text-brand-red text-[10px] font-medium"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={resetSent ? 'reset-sent' : mode}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {resetSent ? (
               <div className="text-center py-4">
                 <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-in zoom-in-50 duration-700">
                   {mode === 'FORGOT_PASSWORD' ? <Lock className="w-8 h-8" /> : <Mail className="w-8 h-8" />}
                 </div>
                 <h3 className="text-2xl font-black mb-3 tracking-tighter text-white">
                   {mode === 'SIGNUP' ? 'Email inviata' : 
                    mode === 'FORGOT_PASSWORD' ? 'Link inviato!' : 'Account Pronto!'}
                 </h3>
                 <p className="text-slate-400 text-xs mb-8 leading-relaxed px-4">
                   {mode === 'SIGNUP' 
                     ? `Ciao ${firstName}, controlla la tua mail per attivare SubSense.` 
                     : mode === 'FORGOT_PASSWORD'
                     ? 'Controlla la tua email per reimpostare la password.'
                     : 'Ora puoi accedere a tutte le funzionalità.'}
                 </p>
                 <div className="pt-2">
                   <button 
                     onClick={() => { setResetSent(false); setMode('LOGIN'); }}
                     className="w-full py-3.5 bg-white text-black font-black rounded-xl hover:bg-slate-200 transition-all shadow-xl flex items-center justify-center gap-2 group text-sm"
                   >
                     Effettua il login
                     <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                   </button>
                 </div>
               </div>
            ) : mode === 'GOOGLE_PASSWORD_LINK' ? (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10 relative overflow-hidden group">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <h3 className="font-bold text-white tracking-tight text-base">Benvenuto!</h3>
                    <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                      Imposta una password per poter accedere <span className="text-brand-red font-bold">anche senza Google</span>.
                    </p>
                  </div>
                  
                  <form onSubmit={handleLinkPassword} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nuova Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-white focus:border-brand-red/50 focus:ring-0 transition-all outline-none text-sm"
                          placeholder="Almeno 6 caratteri"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-brand-red text-white font-black rounded-xl hover:bg-brand-red/90 transition-all shadow-xl shadow-brand-red/20 flex items-center justify-center gap-2 text-sm"
                      >
                        {loading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            Configura Account
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
             ) : (
                <div className="space-y-4">
                  <form onSubmit={handleAuth} className="space-y-4">
                    {mode === 'SIGNUP' && (
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Nome</label>
                         <div className="relative">
                           <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                           <input 
                             type="text"
                             required
                             value={firstName}
                             onChange={(e) => setFirstName(e.target.value)}
                             className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-white focus:border-brand-red/50 focus:ring-0 transition-all outline-none text-xs font-medium"
                             placeholder="Nome"
                           />
                         </div>
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Cognome</label>
                         <div className="relative">
                           <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                           <input 
                             type="text"
                             required
                             value={lastName}
                             onChange={(e) => setLastName(e.target.value)}
                             className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-white focus:border-brand-red/50 focus:ring-0 transition-all outline-none text-xs font-medium"
                             placeholder="Cognome"
                           />
                         </div>
                       </div>
                     </div>
                   )}

                   <div className="space-y-1.5">
                     <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
                     <div className="relative">
                       <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                       <input 
                         type="email"
                         required
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-white focus:border-brand-red/50 focus:ring-0 transition-all outline-none text-xs font-medium"
                         placeholder="email@esempio.it"
                       />
                     </div>
                   </div>

                  {mode !== 'FORGOT_PASSWORD' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Password</label>
                        {mode === 'LOGIN' && (
                          <button 
                            type="button" 
                            onClick={() => setMode('FORGOT_PASSWORD')}
                            className="text-[9px] font-black uppercase tracking-widest text-brand-red hover:text-brand-red/80"
                          >
                            Dimenticata?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-white focus:border-brand-red/50 focus:ring-0 transition-all outline-none text-xs"
                          placeholder="••••••••"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-brand-red text-white font-black rounded-xl hover:bg-brand-red/90 transition-all shadow-xl shadow-brand-red/20 flex items-center justify-center gap-2 text-sm mt-1"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {mode === 'LOGIN' ? 'Accedi' : mode === 'SIGNUP' ? 'Registrati' : 'Invia email'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                 </form>

                <div className="relative pt-1.5">
                  <div className="absolute inset-0 flex items-center pt-1.5">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest pt-1.5">
                    <span className="bg-brand-dark px-3 text-slate-600">Oppure</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 pt-1">
                  <button 
                    onClick={handleGoogleSignIn}
                    className="flex items-center justify-center gap-2 bg-white text-brand-dark font-bold py-3 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                    <span className="text-xs">Continua con Google</span>
                  </button>
                </div>

                <div className="pt-2 text-center">
                  {mode === 'LOGIN' ? (
                    <p className="text-slate-500 text-xs">
                      Senza account?{' '}
                      <button 
                        onClick={() => setMode('SIGNUP')}
                        className="text-brand-red font-bold hover:underline"
                      >
                        Registrati
                      </button>
                    </p>
                  ) : (
                    <button 
                      onClick={() => setMode('LOGIN')}
                      className="flex items-center gap-2 text-slate-500 text-xs font-bold hover:text-white transition-colors mx-auto"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Torna al login
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
