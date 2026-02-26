import React, { useState, useMemo } from 'react';
import brainrotData from '../data/brainrot_db.json';
import userDataRaw from '../data/user_stats.json';

const VARIANTS = ['Normal', 'Gold', 'Diamond', 'Rainbow', 'Radioactive', 'Cursed', 'Candy', 'Lava', 'Galaxy', 'YinYang'] as const;
type Variant = typeof VARIANTS[number];
type ViewMode = 'Index' | 'Inventory';

const INDEX_CONFIG: Record<Variant, { goal: number; isLegacy: boolean; color: string; glow: string }> = {
  "Normal": { goal: 0.75, isLegacy: false, color: "from-zinc-400 to-zinc-600", glow: "shadow-zinc-500/20" },
  "Gold": { goal: 0.75, isLegacy: false, color: "from-yellow-400 to-amber-600", glow: "shadow-yellow-500/40" },
  "Diamond": { goal: 0.75, isLegacy: false, color: "from-cyan-400 to-blue-500", glow: "shadow-cyan-500/40" },
  "Rainbow": { goal: 0.75, isLegacy: false, color: "from-red-500 via-green-500 to-blue-500", glow: "shadow-indigo-500/40" },
  "Radioactive": { goal: 0.75, isLegacy: false, color: "from-lime-400 to-green-600", glow: "shadow-lime-500/40" },
  "Cursed": { goal: 0.60, isLegacy: false, color: "from-red-600 to-red-900", glow: "shadow-red-500/50" },
  "Candy": { goal: 62, isLegacy: true, color: "from-pink-400 to-rose-500", glow: "shadow-pink-500/30" },
  "Lava": { goal: 69, isLegacy: true, color: "from-orange-500 to-red-700", glow: "shadow-orange-500/40" },
  "Galaxy": { goal: 98, isLegacy: true, color: "from-purple-500 to-indigo-800", glow: "shadow-purple-500/40" },
  "YinYang": { goal: 0.75, isLegacy: false, color: "from-zinc-100 to-zinc-900", glow: "shadow-white/10" },
};

export default function BrainrotDashboard() {
  const [activeTab, setActiveTab] = useState<Variant>('Normal');
  const [viewMode, setViewMode] = useState<ViewMode>('Index');
  const [searchTerm, setSearchTerm] = useState('');

  const userStats = useMemo(() => {
    const userId = Object.keys(userDataRaw)[0];
    return userDataRaw[userId as keyof typeof userDataRaw] || {};
  }, []);

  const brainrotList = useMemo(() => {
    return Object.entries(brainrotData)
      .map(([name, info]: [string, any]) => ({ name, ...info }))
      .sort((a, b) => a.wert - b.wert);
  }, []);

  const filteredItems = useMemo(() => {
    return brainrotList.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isLegacy = INDEX_CONFIG[activeTab].isLegacy;
      const matchesSet = isLegacy ? item.fixed_sets?.includes(activeTab) : true;
      return matchesSearch && matchesSet;
    });
  }, [searchTerm, activeTab, brainrotList]);

  const stats = useMemo(() => {
    const relevant = brainrotList.filter(i => 
      INDEX_CONFIG[activeTab].isLegacy ? i.fixed_sets?.includes(activeTab) : true
    );
    const count = relevant.filter(i => userStats[i.name as keyof typeof userStats]?.includes(activeTab)).length;
    const goal = INDEX_CONFIG[activeTab].isLegacy ? INDEX_CONFIG[activeTab].goal : Math.ceil(relevant.length * INDEX_CONFIG[activeTab].goal);
    return { count, total: relevant.length, goal, percent: Math.min((count / goal) * 100, 100) };
  }, [userStats, activeTab, brainrotList]);

  return (
    <div className="flex h-screen bg-[#08090a] text-zinc-100 font-sans overflow-hidden select-none">
      
      {/* LEFT SIDEBAR - GAMER STYLE */}
      <aside className="w-72 bg-[#0c0d0f] border-r border-white/5 flex flex-col z-50 shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
            <h1 className="text-xl font-black tracking-tighter italic uppercase">Brainrot OS</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold tracking-[0.3em] uppercase opacity-50">Database Access</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-2 pb-10 custom-scrollbar">
          {VARIANTS.map(v => (
            <button
              key={v}
              onClick={() => setActiveTab(v)}
              className={`w-full group relative flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 border ${
                activeTab === v 
                ? `bg-white/5 border-white/10 ${INDEX_CONFIG[v].glow} translate-x-2` 
                : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-1 h-6 rounded-full bg-gradient-to-b ${INDEX_CONFIG[v].color} ${activeTab === v ? 'opacity-100' : 'opacity-0 group-hover:opacity-50 transition-opacity'}`} />
                <span className={`text-xs font-black uppercase tracking-widest ${activeTab === v ? 'text-white' : ''}`}>{v}</span>
              </div>
              {INDEX_CONFIG[v].isLegacy && <span className="text-[8px] font-bold opacity-30 italic">SET</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 flex flex-col relative">
        
        {/* TOP INTERFACE */}
        <header className="h-24 bg-[#08090a]/80 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-10">
          <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
            {(['Index', 'Inventory'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === mode ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {mode === 'Index' ? 'Collected' : 'In Hand'}
              </button>
            ))}
          </div>

          <div className="relative">
            <input 
              type="text"
              placeholder="SCAN DATABASE..."
              className="w-96 bg-black/40 border border-white/10 rounded-2xl px-6 py-3 text-xs font-bold tracking-widest focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:opacity-30"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 animate-ping opacity-50" />
          </div>
        </header>

        {/* CONTENT PANEL */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          
          {/* MODERN PROGRESS CARD */}
          <div className="mb-10 relative group">
            <div className={`absolute -inset-1 bg-gradient-to-r ${INDEX_CONFIG[activeTab].color} opacity-10 blur-2xl transition duration-1000 group-hover:opacity-20`} />
            <div className="relative bg-[#0c0d0f] rounded-[2.5rem] border border-white/10 p-8 overflow-hidden shadow-2xl">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded text-zinc-400 uppercase tracking-[0.2em]">Active Index</span>
                    {INDEX_CONFIG[activeTab].isLegacy && <span className="text-[10px] font-black bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-400 uppercase tracking-[0.2em]">Legacy Archive</span>}
                  </div>
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-2xl">{activeTab}</h2>
                </div>
                <div className="text-right">
                   <p className="text-4xl font-black text-white leading-none">{Math.round(stats.percent)}%</p>
                   <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">{stats.count} / {stats.total} TOTAL</p>
                </div>
              </div>
              
              <div className="h-6 w-full bg-black/50 rounded-2xl p-1.5 border border-white/5 shadow-inner">
                <div 
                  className={`h-full rounded-xl transition-all duration-1000 ease-out bg-gradient-to-r ${INDEX_CONFIG[activeTab].color} shadow-[0_0_20px_rgba(255,255,255,0.1)]`}
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
              <p className="mt-4 text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center italic">
                MILESTONE: COLLECT {activeTab === 'Cursed' ? '60%' : '75%'} FOR BASE MULTIPLIER
              </p>
            </div>
          </div>

          {/* ITEM GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6 pb-20">
            {filteredItems.map((item) => {
              const collectedVariants = userStats[item.name as keyof typeof userStats] || [];
              const hasThisVariant = collectedVariants.includes(activeTab);

              return (
                <div 
                  key={item.name}
                  className={`group relative bg-[#0c0d0f] border rounded-[2rem] p-5 transition-all duration-500 flex flex-col ${
                    hasThisVariant 
                    ? 'border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.02)]' 
                    : 'border-white/5 hover:border-white/20 opacity-60 hover:opacity-100 grayscale hover:grayscale-0'
                  }`}
                >
                  {/* CARD IMAGE AREA */}
                  <div className="aspect-square mb-5 bg-black/40 rounded-[1.5rem] flex items-center justify-center p-6 relative overflow-hidden group-hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] transition-all">
                    <img src={item.image} alt={item.name} className={`max-h-full max-w-full object-contain z-10 transition-transform duration-700 group-hover:scale-110 ${!hasThisVariant ? 'opacity-20' : ''}`} />
                    
                    {/* IN-GAME RARITY TEXT */}
                    <div className="absolute top-4 left-4">
                      <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest px-2 py-0.5 bg-white/5 rounded-full">{item.tier || 'Common'}</span>
                    </div>

                    {hasThisVariant && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${INDEX_CONFIG[activeTab].color} opacity-5 group-hover:opacity-10 transition-opacity`} />
                    )}
                  </div>

                  {/* INFO */}
                  <div className="flex-1 text-center">
                    <h3 className="font-black text-[11px] uppercase tracking-tighter text-zinc-100 mb-1 group-hover:text-white transition-colors">{item.name}</h3>
                    <div className="flex items-center justify-center gap-2">
                       <span className={`text-[9px] font-black uppercase italic ${hasThisVariant ? 'text-indigo-400' : 'text-zinc-700'}`}>
                         {hasThisVariant ? activeTab : 'Locked'}
                       </span>
                    </div>
                  </div>

                  {/* DOT PROGRESS TRACKER */}
                  <div className="flex justify-center gap-1.5 mt-5 pt-4 border-t border-white/5">
                    {VARIANTS.map(v => (
                      <div 
                        key={v}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          collectedVariants.includes(v) 
                          ? `bg-gradient-to-br ${INDEX_CONFIG[v].color} scale-110 shadow-[0_0_5px_rgba(255,255,255,0.2)]` 
                          : 'bg-zinc-800'
                        }`}
                        title={v}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}