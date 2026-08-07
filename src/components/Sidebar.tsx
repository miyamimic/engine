import { ChevronLeft, ChevronRight, Brain, Sparkles, BookMarked, ScanSearch } from 'lucide-react';
import EmotionRadar from './EmotionRadar';
import type { EmotionVector, BackgroundThread, TriggeredAnchor } from '../data/types';
import type { IntentAnalysis } from '../lib/api';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  emotion: EmotionVector;
  threads: BackgroundThread[];
  anchors: TriggeredAnchor[];
  intent: IntentAnalysis | null;
  fallback: boolean;
  characterName: string;
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: '正向',
  negative: '负向',
  neutral: '中性',
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-yellow-300',
  negative: 'text-red-300',
  neutral: 'text-muted-foreground',
};

const EMOTION_SHORT: Record<string, string> = {
  anger: '怒',
  fear: '惧',
  joy: '喜',
  sadness: '悲',
  desire: '欲',
  warmth: '温',
};

export default function Sidebar({
  isOpen,
  onToggle,
  emotion,
  threads,
  anchors,
  intent,
  fallback,
  characterName,
}: Props) {
  return (
    <>
      {/* 折叠状态下的展开按钮 */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className={cn(
            'fixed right-0 top-1/2 z-30 -translate-y-1/2',
            'bg-card/80 backdrop-blur-md border border-border/50 border-r-0',
            'rounded-l-lg p-2 text-muted-foreground hover:text-foreground',
            'transition-all hover:bg-card',
          )}
          aria-label="展开调试面板"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {/* 侧边栏主体 */}
      <aside
        className={cn(
          'fixed right-0 top-0 z-20 h-full w-80',
          'bg-card/60 backdrop-blur-xl border-l border-border/40',
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">内部状态</h2>
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="收起调试面板"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 p-4">
          {/* 情绪雷达 */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-sm font-medium">六维情绪</h3>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-2">
              <EmotionRadar emotion={emotion} className="h-[240px] w-full" />
            </div>
            {/* 数值条 */}
            <div className="mt-3 space-y-2">
              {(['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'] as const).map(
                (key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-12 text-xs text-muted-foreground">
                      {
                        {
                          anger: '愤怒',
                          fear: '恐惧',
                          joy: '喜悦',
                          sadness: '悲伤',
                          desire: '欲望',
                          warmth: '温情',
                        }[key]
                      }
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                        style={{ width: `${Math.round(emotion[key] * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
                      {Math.round(emotion[key] * 100)}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* NLP 意图分析（后端 spaCy + LLM） */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ScanSearch className="size-4 text-primary" />
              <h3 className="text-sm font-medium">NLP 意图分析</h3>
              {fallback && (
                <span className="ml-auto text-[10px] text-yellow-300/80">LLM 回退</span>
              )}
            </div>
            {!intent ? (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-center text-xs text-muted-foreground">
                发送消息后，这里展示后端对输入的理解
                <div className="mt-1 text-[10px] opacity-70">意图 / 实体 / 情感 / 情绪增量</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-primary">
                      {intent.intentLabel || intent.intent || '中性'}
                    </span>
                    <span className={cn('text-[10px]', SENTIMENT_COLOR[intent.sentiment] || 'text-muted-foreground')}>
                      {SENTIMENT_LABEL[intent.sentiment] || intent.sentiment}
                    </span>
                  </div>
                  {intent.entities.length > 0 && (
                    <div className="mb-1.5 text-[10px] text-muted-foreground">
                      实体：
                      <span className="text-foreground/80">{intent.entities.join('、')}</span>
                    </div>
                  )}
                  {Object.keys(intent.emotionDelta).length > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      情绪增量：
                      {Object.entries(intent.emotionDelta)
                        .filter(([, v]) => v !== undefined && v !== 0)
                        .map(([k, v]) => `${EMOTION_SHORT[k] ?? k}${v! > 0 ? '+' : ''}${v!.toFixed(2)}`)
                        .join(' ')}
                    </div>
                  )}
                  {intent.notes && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground/70 leading-relaxed">
                      {intent.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 后台思绪 */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <h3 className="text-sm font-medium">后台思绪</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {threads.length} 条
              </span>
            </div>
            {threads.length === 0 ? (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-center text-xs text-muted-foreground">
                暂无活跃思绪
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((t, i) => (
                  <div
                    key={`${t.content}-${i}`}
                    className="rounded-lg border border-border/40 bg-background/40 p-3"
                  >
                    <p className="text-sm text-foreground/90">{t.content}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        剩余 {t.remainingTurns} 轮
                      </span>
                      <div className="h-1 w-16 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-foreground/40"
                          style={{ width: `${Math.min(100, t.remainingTurns * 25)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 记忆锚点 */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BookMarked className="size-4 text-primary" />
              <h3 className="text-sm font-medium">记忆锚点</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {anchors.length} 条
              </span>
            </div>
            {anchors.length === 0 ? (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-center text-xs text-muted-foreground">
                对话中触发的记忆会显示在这里
              </div>
            ) : (
              <div className="space-y-2">
                {anchors.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/40 bg-background/40 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-primary">
                        「{a.anchor.trigger}」
                      </span>
                      <span className="text-xs text-muted-foreground">
                        权重 {a.anchor.weight}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {a.anchor.reaction}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(a.triggeredAt, {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 底部角色信息 */}
        <div className="border-t border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
              {characterName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{characterName}</div>
              <div className="text-xs text-muted-foreground">角色扮演中</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
