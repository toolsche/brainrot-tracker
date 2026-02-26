import { useState, useMemo, useEffect } from 'react';
import brainrotData from '../data/brainrot_db.json';

// Build name→id lookup once at module level for localStorage migration
const nameToId: Record<string, number> = Object.fromEntries(
  Object.entries(brainrotData).map(([name, info]) => [name, (info as any).id as number])
);

function migrateStorage(key: string): Record<string, string[]> {
  const raw = localStorage.getItem(key);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as Record<string, string[]>;
  // If any key is non-numeric, migrate from name-keys to id-keys
  const needsMigration = Object.keys(parsed).some(k => !/^\d+$/.test(k));
  if (!needsMigration) return parsed;
  const migrated: Record<string, string[]> = {};
  for (const [name, variants] of Object.entries(parsed)) {
    const id = nameToId[name];
    if (id !== undefined) migrated[String(id)] = variants;
  }
  localStorage.setItem(key, JSON.stringify(migrated));
  return migrated;
}

const VARIANTS = ['Normal', 'Gold', 'Diamond', 'Rainbow', 'Radioactive', 'Cursed', 'Candy', 'Lava', 'Galaxy', 'YinYang', 'Divine'] as const;
type Variant = typeof VARIANTS[number];
type AppMode = 'INDEX' | 'TRADING'; // Neuer Modus

const VARIANT_STYLES: Record<Variant, { text: string; active: string }> = {
  Normal:      { text: 'text-white',           active: 'bg-zinc-700 border-white/40' },
  Gold:        { text: 'text-yellow-400',       active: 'bg-yellow-900/60 border-yellow-400/60' },
  Diamond:     { text: 'text-cyan-300',         active: 'bg-cyan-900/50 border-cyan-400/60' },
  Rainbow:     { text: 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400', active: 'bg-purple-900/40 border-purple-400/40' },
  Radioactive: { text: 'text-green-400',        active: 'bg-green-900/50 border-green-400/60' },
  Cursed:      { text: 'text-red-500',           active: 'bg-red-900/50 border-red-600/60' },
  Candy:       { text: 'text-pink-400',         active: 'bg-pink-900/40 border-pink-400/50' },
  Lava:        { text: 'text-orange-400',       active: 'bg-orange-900/40 border-orange-500/50' },
  Galaxy:      { text: 'text-purple-400',       active: 'bg-purple-900/50 border-purple-500/60' },
  YinYang:     { text: 'text-gray-200',         active: 'bg-gray-800/60 border-gray-400/50' },
  Divine:      { text: 'text-amber-300',        active: 'bg-amber-900/50 border-amber-400/60' },
};

const TIER_STYLES: Record<string, string> = {
  "Common": "text-[#3be364]",
  "Rare": "text-blue-400",
  "Epic": "text-purple-400",
  "Legendary": "text-yellow-400",
  "Mythical": "text-red-500 font-bold",
  "Brainrot God": "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500 font-black animate-pulse",
  "Secret": "text-white italic brightness-150"
};

export default function BrainrotDashboard({ discordUserId }: { discordUserId?: string }) {
  const lsIndex   = discordUserId ? `brainrot_index_${discordUserId}`   : 'brainrot_index';
  const lsTrading = discordUserId ? `brainrot_trading_${discordUserId}` : 'brainrot_trading';

  const [activeTab, setActiveTab] = useState<Variant>('Normal');
  const [appMode, setAppMode] = useState<AppMode>('INDEX');
  const [searchTerm, setSearchTerm] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // States für Index und Trading (mit LocalStorage) — keys are numeric IDs as strings
  const [userStats, setUserStats] = useState<Record<string, string[]>>(() => migrateStorage(lsIndex));
  const [tradingStats, setTradingStats] = useState<Record<string, string[]>>(() => migrateStorage(lsTrading));

  useEffect(() => {
    localStorage.setItem(lsIndex, JSON.stringify(userStats));
    localStorage.setItem(lsTrading, JSON.stringify(tradingStats));
  }, [userStats, tradingStats, lsIndex, lsTrading]);

  // --- EXPORT FUNKTION ---
  const handleExport = (type: 'fehlend' | 'index' | 'besitz') => {
    const tab = activeTab.toUpperCase();
    const titles = {
      fehlend: `🚀 **BRAUCHE ICH FÜR ${tab}-INDEX** 🚀`,
      index:   `✅ **IM ${tab}-INDEX HABE ICH** ✅`,
      besitz:  `💰 **KANN ICH FÜR ${tab}-INDEX GEBEN** 💰`,
    };

    let itemListText = "";
    let hasItems = false;

    filteredItems.forEach((item) => {
      const key = String(item.id);
      const isCollected = userStats[key]?.includes(activeTab);
      const isTradingItem = tradingStats[key]?.includes(activeTab);

      const include =
        type === 'fehlend' ? !isCollected :
        type === 'index'   ? isCollected :
        isTradingItem;

      if (include) {
        hasItems = true;
        itemListText += `• **${item.name}** (${item.rarity || "Common"})\n`;
      }
    });

    const finalDocument = `${titles[type]}\n\n${hasItems ? itemListText : "Keine Items gefunden."}`;
    navigator.clipboard.writeText(finalDocument);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const brainrotList = useMemo(() => {
    return Object.entries(brainrotData)
      .map(([name, info]: [string, any]) => ({ name, id: info.id as number, ...info }))
      .sort((a, b) => a.wert - b.wert || a.name.localeCompare(b.name));
  }, []);

  const toggleItem = (id: number) => {
    const key = String(id);
    const setter = appMode === 'INDEX' ? setUserStats : setTradingStats;
    setter(prev => {
      const current = prev[key] || [];
      const updated = current.includes(activeTab) ? current.filter(v => v !== activeTab) : [...current, activeTab];
      return { ...prev, [key]: updated };
    });
  };

  // Cumulative set logic: Galaxy ⊃ Lava ⊃ Candy
  const isItemInTab = (item: any, tab: Variant): boolean => {
    if (tab === 'Candy') return item.fixed_sets?.includes('Candy') ?? false;
    if (tab === 'Lava')  return item.fixed_sets?.includes('Candy') || item.fixed_sets?.includes('Lava');
    if (tab === 'Galaxy') return item.fixed_sets?.includes('Candy') || item.fixed_sets?.includes('Lava') || item.fixed_sets?.includes('Galaxy');
    return true; // Normal, Gold, Diamond, Rainbow, Radioactive, Cursed, YinYang, Divine: alle Items
  };

  const filteredItems = useMemo(() => {
    return brainrotList.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch && isItemInTab(item, activeTab);
    });
  }, [searchTerm, activeTab, brainrotList]);

  // All items for current tab (unfiltered by search) for count display
  const tabItems = useMemo(() => {
    return brainrotList.filter(item => isItemInTab(item, activeTab));
  }, [activeTab, brainrotList]);

  const collectedCount = useMemo(() => {
    const stats = appMode === 'INDEX' ? userStats : tradingStats;
    return tabItems.filter(item => stats[String(item.id)]?.includes(activeTab)).length;
  }, [tabItems, activeTab, appMode, userStats, tradingStats]);

  return (
    <div className="flex h-screen bg-[#08090a] text-white font-sans overflow-hidden">
      
      {/* SIDEBAR (unverändert) */}
      <aside className="w-52 bg-[#0c0d0f] border-r border-white/5 flex flex-col p-4 gap-2">
        <div className="mb-6 px-2 border-b border-white/5 pb-4">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">Brainrot OS</h1>
        </div>
        {VARIANTS.map(v => (
          <button key={v} onClick={() => setActiveTab(v)} className={`py-2 px-4 rounded font-black uppercase text-[10px] tracking-widest transition-all border-b-4 ${activeTab === v ? `${VARIANT_STYLES[v].active} scale-105` : 'bg-black/40 border-black/60 opacity-50 hover:opacity-100'}`}>
            <span className={activeTab === v ? VARIANT_STYLES[v].text : ''}>{v}</span>
          </button>
        ))}
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 flex flex-col bg-[#141617]">
        
        {/* HEADER MIT EXPORT BUTTON */}
        <header className="h-16 flex items-center justify-between px-8 bg-[#0c0d0f]/50 border-b border-white/5">
          <div className="flex items-center gap-4">
            <h2 className={`text-2xl font-black uppercase italic ${VARIANT_STYLES[activeTab].text}`}>{activeTab}</h2>

            <span className="text-lg font-black text-white/70 ml-2">
              {collectedCount}<span className="text-white/30">/{tabItems.length}</span>
            </span>

            <div className="flex bg-black/60 rounded-lg p-1 border border-white/10 ml-4">
              <button onClick={() => setAppMode('INDEX')} className={`px-4 py-1 text-[9px] font-black uppercase rounded ${appMode === 'INDEX' ? 'bg-[#3be364] text-black' : 'text-zinc-500'}`}>Im Index</button>
              <button onClick={() => setAppMode('TRADING')} className={`px-4 py-1 text-[9px] font-black uppercase rounded ${appMode === 'TRADING' ? 'bg-indigo-600 text-white' : 'text-zinc-500'}`}>Im Besitz</button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {([
              { type: 'fehlend', label: 'Fehlende Export',   active: 'bg-red-700' },
              { type: 'index',   label: 'Im Index Export',   active: 'bg-green-700' },
              { type: 'besitz',  label: 'Im Besitz Export',  active: 'bg-indigo-700' },
            ] as const).map(({ type, label, active }) => (
              <button
                key={type}
                onClick={() => handleExport(type)}
                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all border border-white/10 shadow-lg ${
                  copyFeedback === type
                    ? `${active} text-white animate-bounce`
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {copyFeedback === type ? '✓ Kopiert!' : `📋 ${label}`}
              </button>
            ))}
            
            <input 
              type="text" placeholder="FILTER..." 
              className="bg-black/40 border border-white/10 rounded px-4 py-1 text-xs outline-none focus:border-white/30"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        {/* GRID (unverändert kompakt) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-[repeat(auto-fill,minmax(150px,200px))] gap-3 justify-center custom-scrollbar">
          {filteredItems.map(item => {
            const key = String(item.id);
            const isActive = appMode === 'INDEX' ? userStats[key]?.includes(activeTab) : tradingStats[key]?.includes(activeTab);
            const displayTier = item.rarity || "Common";

            return (
              <div key={item.id} onClick={() => toggleItem(item.id)} className={`relative bg-[#1e2321] border-2 rounded-lg p-2 flex flex-col cursor-pointer transition-all ${isActive ? 'border-white/10 opacity-100 shadow-lg' : 'border-white/5 opacity-40 grayscale'}`} style={{ maxWidth: '200px' }}>
                <h3 className="font-black text-[11px] text-white mb-1 text-center leading-tight min-h-[2em] line-clamp-2">{item.name}</h3>
                <div className="aspect-square bg-black/30 rounded flex items-center justify-center p-2 relative overflow-hidden mb-1">
                  <img src={item.image.replace('https://www.steal-a-brainrot.de', '/img-proxy')} alt={item.name} className={`max-h-full object-contain ${!isActive ? 'brightness-0' : ''}`} />
                </div>
                <div className={`text-center font-black text-[10px] uppercase tracking-wider ${TIER_STYLES[displayTier] || TIER_STYLES["Common"]}`}>{displayTier}</div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}