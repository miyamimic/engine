import { avatarImages } from '@lark-apaas/client-toolkit-lite';
import { cn } from '../lib/utils';
import { Image } from '@/components/ui/image';

export default function TypingIndicator({ characterName }: { characterName?: string }) {
  return (
    <div className="flex justify-start gap-3 px-4">
      <div className="size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/30">
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
            'rounded-2xl rounded-tl-sm px-5 py-4',
            'bg-card/80 border border-border/50 backdrop-blur-sm',
          )}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block size-2 rounded-full bg-primary/60',
                'animate-bounce',
              )}
              style={{ animationDelay: '0ms' }}
            />
            <span
              className={cn(
                'inline-block size-2 rounded-full bg-primary/60',
                'animate-bounce',
              )}
              style={{ animationDelay: '150ms' }}
            />
            <span
              className={cn(
                'inline-block size-2 rounded-full bg-primary/60',
                'animate-bounce',
              )}
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
