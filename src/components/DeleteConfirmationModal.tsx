import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  subscriptionName: string;
}

export default function DeleteConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  subscriptionName 
}: DeleteConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm frosted-card p-6 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-brand-red" />
            
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-brand-red/10 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-brand-red" />
              </div>
              
              <h3 className="text-xl font-black tracking-tight mb-2">Elimina Sottoscrizione</h3>
              <p className="text-slate-400 text-sm mb-8">
                Sei sicuro di voler eliminare <span className="text-white font-bold">{subscriptionName}</span>? Questa azione non può essere annullata.
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={onClose}
                  className="py-3 px-4 rounded-xl bg-white/5 text-slate-300 font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Annulla
                </button>
                <button 
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="py-3 px-4 rounded-xl bg-brand-red text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-brand-red/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Elimina
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
