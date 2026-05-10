import { useState, FormEvent } from 'react';
import { subscriptionService } from '../services/subscriptionService';
import { BillingCycle, Subscription } from '../types';
import { X, Plus, Sparkles } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface AddSubscriptionModalProps {
  userId: string;
  onClose: () => void;
  onAdded: () => void;
  subscriptionToEdit?: Subscription | null;
}

const POPULAR_PLATFORMS = [
  { name: 'Netflix', cost: '12.99', category: 'Streaming', color: 'bg-red-600' },
  { name: 'Spotify', cost: '10.99', category: 'Musica', color: 'bg-green-500' },
  { name: 'Amazon Prime', cost: '4.99', category: 'Servizi', color: 'bg-blue-400' },
  { name: 'Disney+', cost: '8.99', category: 'Streaming', color: 'bg-blue-900' },
  { name: 'YouTube', cost: '11.99', category: 'Streaming', color: 'bg-red-500' },
  { name: 'ChatGPT', cost: '20.00', category: 'Software', color: 'bg-emerald-600' },
  { name: 'iCloud+', cost: '0.99', category: 'Software', color: 'bg-slate-200 text-black' },
  { name: 'DAZN', cost: '34.99', category: 'Streaming', color: 'bg-yellow-400 text-black' },
];

export default function AddSubscriptionModal({ userId, onClose, onAdded, subscriptionToEdit }: AddSubscriptionModalProps) {
  const [name, setName] = useState(subscriptionToEdit?.name || '');
  const [cost, setCost] = useState(subscriptionToEdit?.cost?.toString() || '');
  const [cycle, setCycle] = useState<BillingCycle>(subscriptionToEdit?.cycle || 'monthly');
  const [category, setCategory] = useState(subscriptionToEdit?.category || 'Streaming');
  const [renewalDate, setRenewalDate] = useState(
    subscriptionToEdit?.renewalDate 
      ? format(subscriptionToEdit.renewalDate.toDate(), 'yyyy-MM-dd')
      : ''
  );
  const [loading, setLoading] = useState(false);

  const selectPlatform = (platform: typeof POPULAR_PLATFORMS[0]) => {
    setName(platform.name);
    setCost(platform.cost);
    setCategory(platform.category);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !cost || !renewalDate) return;

    setLoading(true);
    try {
      const subData = {
        name,
        cost: parseFloat(cost),
        currency: 'EUR',
        cycle,
        category,
        renewalDate: Timestamp.fromDate(new Date(renewalDate)),
        remindersEnabled: true
      };

      if (subscriptionToEdit?.id) {
        await subscriptionService.updateSubscription(subscriptionToEdit.id, subData);
      } else {
        await subscriptionService.addSubscription(userId, subData);
      }
      onAdded();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm"
      />

      {/* Bottom Sheet */}
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full bg-slate-900 rounded-t-[32px] border-t border-white/10 p-6 pt-2 overflow-hidden shadow-2xl"
      >
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            {subscriptionToEdit ? (
              <Sparkles className="w-5 h-5 text-brand-red" />
            ) : (
              <Plus className="w-5 h-5 text-brand-red" />
            )}
            {subscriptionToEdit ? 'Modifica Servizio' : 'Nuovo Servizio'}
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!subscriptionToEdit && (
          <div className="mb-6">
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-3 tracking-widest px-1">Seleziona Popolari</label>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {POPULAR_PLATFORMS.map((platform) => (
                <button
                  key={platform.name}
                  type="button"
                  onClick={() => selectPlatform(platform)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all border border-white/5 touch-button flex items-center gap-2",
                    name === platform.name ? "bg-white text-black" : "bg-white/5 text-slate-300"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", platform.color)} />
                  {platform.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 pb-10">
          <div>
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest px-1">Nome Abbonamento</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-red transition-all text-sm font-bold"
              placeholder="es. Spotify, Netflix..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest px-1">Costo (€)</label>
              <input
                type="number"
                step="0.01"
                required
                value={cost}
                onChange={e => setCost(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-red transition-all text-sm font-bold"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest px-1">Frequenza</label>
              <div className="relative">
                <select
                  value={cycle}
                  onChange={e => setCycle(e.target.value as BillingCycle)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-red transition-all appearance-none text-sm font-bold"
                >
                  <option value="monthly" className="bg-slate-900">Mensile</option>
                  <option value="annual" className="bg-slate-900">Annuale</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest px-1">Categoria</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-red transition-all appearance-none text-sm font-bold"
            >
              <option value="Streaming" className="bg-slate-900">Streaming</option>
              <option value="Musica" className="bg-slate-900">Musica</option>
              <option value="Software" className="bg-slate-900">Software</option>
              <option value="Gaming" className="bg-slate-900">Gaming</option>
              <option value="Servizi" className="bg-slate-900">Servizi</option>
              <option value="Produttività" className="bg-slate-900">Produttività</option>
              <option value="Altro" className="bg-slate-900">Altro</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest px-1">Data Prossimo Rinnovo</label>
            <input
              type="date"
              required
              value={renewalDate}
              onChange={e => setRenewalDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-red transition-all text-sm font-bold color-scheme-dark"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="touch-button w-full bg-brand-red text-white font-black py-5 rounded-2xl mt-4 transition-all shadow-xl shadow-brand-red/30 flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
          >
            {loading ? 'Elaborazione...' : (
              <>
                <Sparkles className="w-4 h-4" />
                Salva Abbonamento
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
