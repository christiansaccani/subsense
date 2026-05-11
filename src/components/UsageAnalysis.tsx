import React, { useState, useRef, useEffect } from 'react';
import { Subscription, UsageFrequency, UserProfile } from '../types';
import { User } from 'firebase/auth';
import { AlertCircle, Trash2, CheckCircle, Zap, ImagePlus, Loader2, Sparkles, Calendar, BellRing } from 'lucide-react';
import { subscriptionService } from '../services/subscriptionService';
import { geminiService } from '../services/geminiService';
import { userService } from '../services/userService';
import { motion, AnimatePresence } from 'motion/react';
import { cn, parseFirestoreDate } from '../lib/utils';
import { deleteField } from 'firebase/firestore';
import { format, differenceInDays, formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface UsageAnalysisProps {
  user: User | null;
  profile: UserProfile | null;
  subscriptions: Subscription[];
  onUpdate: () => void;
  onProfileUpdate: () => void;
  onAnalyzingStateChange: (analyzing: boolean) => void;
}

const FREQUENCY_OPTIONS: { label: string; value: UsageFrequency }[] = [
  { label: 'Mai', value: 'never' },
  { label: 'Raro', value: 'rarely' },
  { label: 'Spesso', value: 'often' },
  { label: 'Sempre', value: 'always' },
];

export default function UsageAnalysis({ user, profile, subscriptions, onUpdate, onProfileUpdate, onAnalyzingStateChange }: UsageAnalysisProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onAnalyzingStateChange(analyzing);
    if (analyzing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [analyzing, onAnalyzingStateChange]);

  useEffect(() => {
    // Force a fresh read of the profile when opening this section as requested
    onProfileUpdate();
  }, [onProfileUpdate]);

  const lastAnalysis = parseFirestoreDate(profile?.lastAnalysisAt);
  console.log('Profile Last Analysis Raw:', profile?.lastAnalysisAt);
  console.log('Parsed Last Analysis:', lastAnalysis);
  const isValidAnalysisDate = lastAnalysis instanceof Date && !isNaN(lastAnalysis.getTime());
  const daysSinceLastAnalysis = isValidAnalysisDate ? differenceInDays(new Date(), lastAnalysis!) : null;
  const showReminder = daysSinceLastAnalysis !== null && daysSinceLastAnalysis >= 7;

  const handleUpdateUsage = async (subId: string, frequency: UsageFrequency, current: UsageFrequency | undefined) => {
    // If clicking already selected, clear it
    const isDeselecting = current === frequency;
    await subscriptionService.updateSubscription(subId, { 
      usageFrequency: isDeselecting ? deleteField() : frequency,
      usageTimeLabel: isDeselecting ? deleteField() : undefined 
    } as any);
    onUpdate();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result?.toString().split(',')[1];
          if (!base64) {
            setAnalyzing(false);
            return;
          }

          const results = await geminiService.analyzeScreenTime(base64, file.type);
          
          let updatedCount = 0;
          const matchedSubIds = new Set<string>();

          for (const result of results) {
            // Find the best matching subscription
            const sub = subscriptions.find(s => {
              const sName = s.name.toLowerCase();
              const rName = result.name.toLowerCase();
              
              // Exact match
              if (sName === rName) return true;
              
              // Contains match (only for long identifiers to avoid false positives like "Go" matching "Google")
              if (rName.length > 3 && sName.includes(rName)) return true;
              if (sName.length > 3 && rName.includes(sName)) return true;
              
              return false;
            });
            
            if (sub && sub.id && !matchedSubIds.has(sub.id)) {
              await subscriptionService.updateSubscription(sub.id, { 
                usageFrequency: result.frequency as UsageFrequency,
                usageTimeLabel: result.usageTimeLabel
              });
              matchedSubIds.add(sub.id);
              updatedCount++;
            }
          }
          onUpdate();
          if (user?.uid) {
            await userService.updateLastAnalysis(user.uid);
            onProfileUpdate();
          }
          setAnalyzing(false);
          alert(`Analisi completata! Trovate ${results.length} app, aggiornate ${updatedCount} sottoscrizioni.`);
        } catch (err) {
          console.error(err);
          setAnalyzing(false);
          alert("Errore durante l'analisi dello screenshot.");
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setAnalyzing(false);
      alert("Errore nel caricamento del file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const suggestions = subscriptions.filter(sub => 
    sub.usageFrequency === 'never' || sub.usageFrequency === 'rarely'
  );

  return (
    <div className="space-y-6">
      <div className="frosted-card p-6 border-brand-red/20 bg-brand-red/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-brand-red">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-bold">Analisi Utilizzo</h3>
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="flex items-center gap-2 bg-brand-red text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-red/20 disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
          >
            {analyzing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Loader2 className="w-3 h-3" />
              </motion.div>
            ) : (
              <ImagePlus className="w-3 h-3" />
            )}
            {analyzing ? 'Analisi...' : 'Scan Screen Time'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {isValidAnalysisDate && lastAnalysis && (
          <div className="mb-6 pb-4 border-b border-white/5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
              <Calendar className="w-3 h-3 text-brand-red" />
              Cronologia Analisi
            </p>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] text-white font-medium">
                Ultima scansione: <span className="text-brand-red font-black uppercase text-[10px] ml-1">{formatDistanceToNow(lastAnalysis, { addSuffix: true, locale: it })}</span>
              </p>
              <p className="text-[9px] text-slate-500 font-mono">
                Eseguita il {format(lastAnalysis, 'dd MMMM yyyy HH:mm', { locale: it })}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            <Sparkles className="w-3 h-3 inline mr-1 text-brand-red" />
            Carica uno screenshot dell'<span className="text-white font-bold">Attività Settimanale</span> (iOS/Android) per analizzare automaticamente i consumi reali.
          </p>
        </div>

        {showReminder && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-brand-red/10 border border-brand-red/20 rounded-2xl flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-brand-red/20 rounded-xl flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">È ora di un nuovo controllo!</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Sono passati <span className="text-brand-red font-black">{daysSinceLastAnalysis} giorni</span> dall'ultima analisi. Aggiorna i dati per ottimizzare i costi.
              </p>
            </div>
          </motion.div>
        )}

        {/* Simple Loading Indicator removed and moved to App.tsx */}

        <div className="space-y-4">
          {subscriptions.map(sub => (
            <div key={sub.id} className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm tracking-tight">{sub.name}</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{sub.category}</p>
                      {sub.usageTimeLabel && (
                        <span className="text-[9px] text-emerald-500 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded tracking-tighter">
                          {sub.usageTimeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {sub.isLinked && (
                    <div className="flex flex-col items-end">
                      <span className="bg-brand-red/10 text-brand-red text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-brand-red/20 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        Live Analysis
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-1 bg-white/5 rounded text-[9px] font-mono font-bold text-slate-400">
                  €{sub.cost.toFixed(2)}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-black/20 rounded-xl">
                {FREQUENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleUpdateUsage(sub.id!, opt.value, sub.usageFrequency)}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                      sub.usageFrequency === opt.value
                        ? 'bg-brand-red text-white shadow-lg'
                        : 'text-slate-500 active:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!analyzing && suggestions.length > 0 && (
        <div className="frosted-card p-5 border-brand-red/20 bg-brand-red/5">
          <h3 className="font-black text-brand-red mb-4 flex items-center gap-2 text-[11px] uppercase tracking-widest">
            <Trash2 className="w-4 h-4" />
            Alert Risparmio
          </h3>
          <div className="space-y-3">
            {suggestions.map(sub => (
              <div key={sub.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs leading-relaxed">
                    Risparmia <span className="font-black text-brand-red">€{sub.cost.toFixed(2)}</span> eliminando <span className="font-black">{sub.name}</span>.
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Frequenza d'uso: {FREQUENCY_OPTIONS.find(o => o.value === sub.usageFrequency)?.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!analyzing && suggestions.length === 0 && subscriptions.length > 0 && (
        <div className="frosted-card p-6 border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <p className="text-sm font-medium">Grande! Stai utilizzando al meglio tutti i tuoi abbonamenti.</p>
        </div>
      )}
    </div>
  );
}
