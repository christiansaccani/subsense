import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Subscription } from '../types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CreditCard, Calendar, TrendingDown } from 'lucide-react';
import { getServiceLogo } from '../constants';

interface DashboardProps {
  subscriptions: Subscription[];
}

const COLORS = ['#ff3b30', '#ff6b6b', '#ff9999', '#ffcccc', '#0a0a0a'];

export default function Dashboard({ subscriptions }: DashboardProps) {
  const stats = useMemo(() => {
    let monthly = 0;
    let annual = 0;
    const categories: Record<string, number> = {};

    subscriptions.forEach(sub => {
      const cost = sub.cost;
      if (sub.cycle === 'monthly') {
        monthly += cost;
        annual += cost * 12;
      } else {
        monthly += cost / 12;
        annual += cost;
      }

      const cat = sub.category || 'Altro';
      categories[cat] = (categories[cat] || 0) + (sub.cycle === 'monthly' ? cost : cost / 12);
    });

    const chartData = Object.entries(categories).map(([name, value]) => ({ name, value }));

    const nextRenewals = [...subscriptions]
      .filter(s => s.renewalDate)
      .sort((a, b) => a.renewalDate.seconds - b.renewalDate.seconds)
      .slice(0, 3);

    return { monthly, annual, chartData, nextRenewals };
  }, [subscriptions]);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Monthly Cost */}
        <div className="frosted-card p-4">
          <div className="flex items-center gap-1.5 mb-1 text-slate-500 uppercase text-[9px] font-black tracking-widest">
            <CreditCard className="w-3 h-3" />
            <span>Mensile</span>
          </div>
          <div className="text-xl font-black text-brand-red">€{stats.monthly.toFixed(2)}</div>
        </div>

        {/* Annual Cost */}
        <div className="frosted-card p-4">
          <div className="flex items-center gap-1.5 mb-1 text-slate-500 uppercase text-[9px] font-black tracking-widest">
            <TrendingDown className="w-3 h-3" />
            <span>Annuale</span>
          </div>
          <div className="text-xl font-black">€{stats.annual.toFixed(2)}</div>
        </div>
      </div>

      {/* Next Renewals */}
      <div className="frosted-card p-5">
        <div className="flex items-center gap-2 mb-4 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-white/5 pb-2">
          <Calendar className="w-3.5 h-3.5 text-brand-red" />
          <span>Prossimi Scadenze</span>
        </div>
        <div className="space-y-4">
          {stats.nextRenewals.length > 0 ? stats.nextRenewals.map((sub, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-xs font-black overflow-hidden border border-white/5">
                  {sub.logoUrl || getServiceLogo(sub.name) ? (
                    <img 
                      src={sub.logoUrl || getServiceLogo(sub.name)!} 
                      alt={sub.name} 
                      className="w-full h-full object-contain p-1"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    sub.name[0]
                  )}
                </div>
                <span className="font-bold text-sm">{sub.name}</span>
              </div>
              <span className="bg-white/5 px-2 py-1 rounded text-[10px] font-mono font-bold text-slate-400">
                {format(sub.renewalDate.toDate(), 'dd MMM', { locale: it })}
              </span>
            </div>
          )) : <div className="text-slate-500 text-xs italic py-2">Nessun rinnovo imminente</div>}
        </div>
      </div>

      {/* Pie Chart */}
      <div className="frosted-card p-5 h-[320px] flex flex-col">
        <h3 className="text-[10px] uppercase font-black text-slate-500 mb-6 tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse"></div>
          Mix Categorie
        </h3>
        <div className="flex-1 flex items-center justify-center">
          {stats.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  stroke="none"
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-xs font-bold uppercase tracking-tighter">Nessun dato analizzabile</div>
          )}
        </div>
      </div>
    </div>
  );
}
