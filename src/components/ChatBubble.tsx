import type { MessageSegment, ChatMessage } from '../data/types';
import { avatarImages } from '@lark-apaas/client-toolkit-lite';
import { cn } from '../lib/utils';
import { Image } from '@/components/ui/image';

interface Props {
  message: ChatMessage;
  characterName?: string;
}

function SpeechSegment({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
}

function ActionSegment({ text }: { text: string }) {
  return (
    <p
      className={cn(
        'whitespace-pre-wrap italic leading-relaxed',
        'text-[#f59e42]', // 暖橙/琥珀色
        'dark:text-[#fbbf64]',
      )}
    >
      {text}
    </p>
  );
}

function ThoughtSegment({ text }: { text: string }) {
  return (
    <p
      className={cn(
        'whitespace-pre-wrap text-sm leading-relaxed',
        'text-muted-foreground/70',
        'font-light',
      )}
    >
      （{text}）
    </p>
  );
}

function renderSegment(seg: MessageSegment, idx: number) {
  const key = `${seg.type}-${idx}`;
  switch (seg.type) {
    case 'action':
      return <ActionSegment key={key} text={seg.text} />;
    case 'thought':
      return <ThoughtSegment key={key} text={seg.text} />;
    case 'speech':
    default:
      return <SpeechSegment key={key} text={seg.text} />;
  }
}

export default function ChatBubble({ message, characterName }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 px-4">
        <div className="max-w-[75%] space-y-1">
          <div
            className={cn(
              'rounded-2xl rounded-tr-sm px-4 py-3',
              'bg-primary/20 border border-primary/30',
              'text-foreground',
            )}
          >
            <div className="space-y-1">
              {message.segments.map((s, i) => renderSegment(s, i))}
            </div>
          </div>
        </div>
        <div
          className={cn(
            'size-9 shrink-0 rounded-full flex items-center justify-center',
            'bg-accent text-accent-foreground text-xs font-medium',
          )}
        >
          我
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-3 px-4">
      <div
        className={cn(
          'size-9 shrink-0 overflow-hidden rounded-full',
          'ring-2 ring-primary/30',
        )}
      >
        <Image
          src={avatarImages.avatarImg3}
          alt={characterName || '角色'}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="max-w-[75%] space-y-1">
        {characterName && (
          <div className="text-xs text-muted-foreground pl-1">{characterName}</div>
        )}
        <div
          className={cn(
            'rounded-2xl rounded-tl-sm px-4 py-3',
            'bg-card/80 border border-border/50 backdrop-blur-sm',
            'text-foreground',
          )}
        >
          <div className="space-y-1.5">
            {message.segments.map((s, i) => renderSegment(s, i))}
          </div>
        </div>
      </div>
    </div>
  );
}
