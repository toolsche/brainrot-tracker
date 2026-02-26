import BrainrotIndex from './components/BrainrotIndex';

function App({ discordUserId, username, avatar }: { discordUserId?: string; username?: string; avatar?: string }) {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <BrainrotIndex discordUserId={discordUserId} username={username} avatar={avatar} />
    </div>
  );
}

export default App;
