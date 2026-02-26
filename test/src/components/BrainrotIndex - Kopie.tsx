import React, { useState, useMemo } from 'react';
import brainrotData from '../data/brainrot_db.json';
// Import der User-Daten (Struktur: { "ID": { "Name": ["Variant"] } })
import userDataRaw from '../data/user_stats.json';

const VARIANTS = [
  'Normal', 'Gold', 'Diamond', 'Rainbow', 'Radioactive', 
  'Cursed', 'Candy', 'Lava', 'Galaxy', 'YinYang'
] as const;
type Variant = typeof VARIANTS[number];
type ViewMode = 'Index' | 'Inventory';

const INDEX_CONFIG: Record<Variant, { goal: number; isLegacy: boolean; color: string; dot: string }> = {
  "Normal": { goal: 0.75, isLegacy: false, color: "bg-zinc-100 text-black", dot: "bg-zinc-100" },
  "Gold": { goal: 0.75, isLegacy: false, color: "bg-yellow-400 text-black shadow-yellow-500/20", dot: "bg-yellow-400" },
  "Diamond": { goal: 0.75, isLegacy: false, color: "bg-cyan-400 text-black shadow-cyan-500/20", dot: "bg-cyan-400" },
  "Rainbow": { goal: 0.75, isLegacy: false, color: "bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white", dot: "bg-red-500" },
  "Radioactive": { goal: 0.75, isLegacy: false, color: "bg-lime-400 text-black shadow-lime-500/40", dot: "bg-lime-400" },
  "Cursed": { goal: 0.60, isLegacy: false, color: "bg-red-600 text-white animate-pulse", dot: "bg-red-600" },
  "Candy": { goal: 62, isLegacy: true, color: "bg-pink-400 text-white", dot: "bg-pink-400" },
  "Lava": { goal: 69, isLegacy: true, color: "bg-orange-600 text-white shadow-orange-600/50", dot: "bg-orange-600" },
  "Galaxy": { goal: 98, isLegacy: true, color: "bg-purple-600 text-white", dot: "bg-purple-600" },
  "YinYang": { goal: 0.75, isLegacy: false, color: "bg-zinc-300 text-black border-r-4 border-black", dot: "bg-zinc-300" },
};

export default function BrainrotDashboard() {
  const [activeTab, setActiveTab] = useState<Variant>('Normal');
  const [viewMode, setViewMode] = useState<ViewMode>('Index');
  const [searchTerm, setSearchTerm] = useState('');

  // Extrahiere User-Statistiken (nimmt die erste ID im JSON)
  const userStats = useMemo(() => {
    const userId = Object.keys(userDataRaw)[0];
    return userDataRaw[userId as keyof typeof userDataRaw] || {};
  }, []);

  // Formatierte Liste aus der Datenbank
  const brainrotList = useMemo(() => {
    return Object.entries(brainrotData)
      .map(([name, info]: [string, any]) => ({ name, ...info }))
      .sort((a, b) => a.wert - b.wert);
  }, []);

  // Formatierung für s, K/s, M/s, B/s
  const formatValue = (val: number) => {
    if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B/s';
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M/s';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K/s';
    return val + '/s';
  };

  // Filter-Logik für Sidebar-Tabs und Legacy-Sets
  const filteredItems = useMemo(() => {
    return brainrotList.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isLegacy = INDEX_CONFIG[activeTab].isLegacy;
      const matchesSet = isLegacy ? item.fixed_sets?.includes(activeTab) : true;
      return matchesSearch && matchesSet;
    });
  }, [searchTerm, activeTab, brainrotList]);

  // Statistik-Berechnung
  const stats = useMemo(() => {
    const relevantItems = brainrotList.filter(i => 
      INDEX_CONFIG[activeTab].isLegacy ? i.fixed_sets?.includes(activeTab) : true
    );
    const count = relevantItems.filter(i => userStats[i.name as keyof typeof userStats]?.includes(activeTab)).length;
    const total = relevantItems.length;
    const goal = INDEX_CONFIG[activeTab].isLegacy ? INDEX_CONFIG[activeTab].goal : Math.ceil(total * INDEX_CONFIG[activeTab].goal);
    return { count, total, goal, percent: Math.min((count / goal) * 100, 100) };
  }, [userStats, activeTab, brainrotList]);

  const globalTotal = useMemo(() => {
    return Object.values(userStats).reduce((acc: number, val: any) => acc + val.length, 0);
  }, [userStats]);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shadow-2xl z-40">
        <div className="p-8">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">Brainrot</h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Collector v4.0</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 space-y-1.5 pb-10">
          <p className="px-4 text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">Select Index</p>
          {VARIANTS.map(v => (
            <button
              key={v}
              onClick={() => setActiveTab(v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all border ${
                activeTab === v 
                ? `${INDEX_CONFIG[v].color.split(' ')[0]} border-white/20 shadow-lg translate-x-1` 
                : 'bg-transparent border-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              <span className="text-[11px] font-black uppercase tracking-tight">{v}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${INDEX_CONFIG[v].dot}`} />
            </button>
          ))}
        </nav>

        <div className="p-6 bg-black/20 border-t border-zinc-800">
          <div className="flex justify-between items-center mb-1">
             <span className="text-[10px] font-bold text-zinc-500 uppercase">Global</span>
             <span className="text-xs font-black text-indigo-400">{globalTotal}</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-500 w-1/3" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <header className="h-20 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 flex items-center justify-between px-10 z-30">
          <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
            {(['Index', 'Inventory'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-6 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${
                  viewMode === mode ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'Index' ? 'Im Index' : 'Besitz'}
              </button>
            ))}
          </div>

          <div className="relative group">
            <input 
              type="text"
              placeholder={`Search ${activeTab} items...`}
              className="w-80 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all group-hover:border-zinc-700"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          
          {/* PROGRESS CARD */}
          <div className="mb-10 p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <h1 className="text-8xl font-black italic uppercase tracking-tighter">{activeTab}</h1>
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">{activeTab} Index</h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                    {stats.count} / {stats.total} collected
                  </p>
                </div>
                <div className="text-right">
                   <p className="text-xs font-black text-zinc-400 mb-1 italic">Goal: {stats.goal}</p>
                   <p className="text-5xl font-black text-white leading-none">{Math.round(stats.percent)}%</p>
                </div>
              </div>
              <div className="h-4 w-full bg-black rounded-full p-1 border border-zinc-800 shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${INDEX_CONFIG[activeTab].color}`}
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* ITEM GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
            {filteredItems.map((item) => {
              const collectedVariants = userStats[item.name as keyof typeof userStats] || [];
              const hasThisVariant = collectedVariants.includes(activeTab);

              return (
                <div 
                  key={item.name}
                  className={`group relative bg-zinc-900 border-2 rounded-[2rem] p-4 transition-all duration-300 flex flex-col ${
                    hasThisVariant ? 'border-white/20' : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="aspect-square mb-4 bg-black/40 rounded-[1.5rem] flex items-center justify-center p-4 relative overflow-hidden">
                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain z-10 transition-transform duration-500 group-hover:scale-110" />
                    {hasThisVariant && (
                      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] flex items-center justify-center z-20">
                         <div className="bg-white/10 border border-white/20 px-3 py-1 rounded-full text-[9px] font-black uppercase text-white shadow-2xl">Index ✓</div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center px-2">
                    <h3 className="font-black text-[11px] uppercase tracking-tighter text-zinc-100 truncate mb-1">{item.name}</h3>
                    <p className="text-green-500 text-[10px] font-bold">{formatValue(item.wert)}</p>
                  </div>

                  {/* DOT TRACKER */}
                  <div className="flex justify-center gap-1.5 mt-4 pt-3 border-t border-zinc-800/50">
                    {VARIANTS.map(v => (
                      <div 
                        key={v}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          collectedVariants.includes(v) ? INDEX_CONFIG[v].dot : 'bg-zinc-800'
                        }`}
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