import BrainrotIndex from './components/BrainrotIndex';

function App({ discordUserId }: { discordUserId?: string }) {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <BrainrotIndex discordUserId={discordUserId} />
    </div>
  );
}

export default App;
