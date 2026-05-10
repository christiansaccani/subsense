import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Activity, ChevronRight, Zap, ImagePlus } from 'lucide-react';

interface PermissionRequestProps {
  onAccept: () => void;
}

export default function PermissionRequest({ onAccept }: PermissionRequestProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-brand-dark/95 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-md w-full frosted-card p-8 text-center"
      >
        <div className="w-20 h-20 bg-brand-red/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Activity className="w-10 h-10 text-brand-red animate-pulse" />
        </div>

        <h2 className="text-2xl font-black tracking-tight mb-2">Ottimizzazione Smart</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          SubSense può monitorare le tue attività digitali per identificare abbonamenti inutilizzati e suggerirti dove risparmiare.
        </p>

        <div className="space-y-4 mb-8 text-left">
          <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 font-mono">
            <div className="w-10 h-10 bg-brand-red/20 rounded-xl flex items-center justify-center shrink-0">
              <ImagePlus className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-brand-red mb-0.5">Analisi Screenshot</p>
              <p className="text-[10px] text-slate-500 font-medium">Carica lo screenshot di "Tempo di utilizzo" per aggiornare i tuoi dati istantaneamente via AI.</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-0.5">Privacy Totale</p>
              <p className="text-[11px] text-slate-500 font-medium">L'AI analizza l'immagine per estrarre solo i tempi d'uso, senza salvare dati personali.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onAccept}
          className="touch-button w-full bg-brand-red text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-2xl shadow-brand-red/30"
        >
          Attiva Monitoraggio
          <ChevronRight className="w-5 h-5" />
        </button>
        
        <button 
          onClick={onAccept}
          className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest hover:text-slate-300 transition-colors"
        >
          Forse più tardi
        </button>
      </motion.div>
    </motion.div>
  );
}
