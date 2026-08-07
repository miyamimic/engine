import { useState } from 'react';
import ParticleBackground from '@/components/ParticleBackground';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import ChatInput from '@/components/ChatInput';
import ChatBubble from '@/components/ChatBubble';
import TypingIndicator from '@/components/TypingIndicator';
import EmotionRadar from '@/components/EmotionRadar';
import { MOCK_CHARACTERS } from '@/data/characters';
import { useEngine } from '@/hooks/useEngine';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const engine = useEngine();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  if (!engine.ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  const character = engine.getCharacter();
  const emotion = engine.getEmotion();
  const threads = engine.getBackgroundThreads();
  const anchors = engine.getTriggeredAnchors();
  const messages = engine.getMessages();
  const intent = engine.getLastIntent();

  const handleSend = async (text: string) => {
    setIsLoading(true);
    try {
      await engine.sendMessage(text);
    } catch (e) {
      console.error('发送失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <ParticleBackground />
      <TopBar
        currentCharacter={character}
        availableCharacters={MOCK_CHARACTERS}
        onSwitchCharacter={(id) => engine.switchCharacter(id)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        onClearHistory={() => engine.clearHistory()}
        onResetEmotion={() => engine.resetEmotion()}
      />
      <div className={cn('flex h-full flex-col pt-14 transition-all duration-300', sidebarOpen ? 'pr-80' : 'pr-0')}>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto py-6 space-y-4">
            {messages.length === 0 && (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto mb-4 size-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-xl shadow-primary/30">
                  {character.name.charAt(0)}
                </div>
                <h1 className="text-xl font-semibold text-foreground mb-2">正在与 {character.name} 对话</h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed mb-6">
                  角色扮演叙事引擎：Python 后端负责 NLP 意图理解、六维情绪惯性、记忆锚点与 LLM 生成，前端只做 UI。
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['我真的破防了emo', '不行，我做不到', '想你', '你胸肌练得不错'].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className={cn(
                        'rounded-full border border-border/50 bg-card/50',
                        'px-4 py-1.5 text-sm text-muted-foreground',
                        'hover:border-primary/40 hover:text-foreground hover:bg-primary/10',
                        'transition-all',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} characterName={m.role === 'character' ? character.name : undefined} />
            ))}
            {isLoading && <TypingIndicator characterName={character.name} />}
          </div>
        </div>
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        emotion={emotion}
        threads={threads}
        anchors={anchors}
        intent={intent}
        fallback={engine.getLastFallback()}
        characterName={character.name}
      />
    </div>
  );
}
