import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Settings,
  PanelRight,
  Users,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { ICharacter } from '../data/types';
import { cn } from '../lib/utils';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';

interface Props {
  currentCharacter: ICharacter;
  availableCharacters: ICharacter[];
  onSwitchCharacter: (id: string) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onClearHistory: () => void;
  onResetEmotion: () => void;
}

const LLM_CONFIG_KEY = 'rp_engine_llm_config';

interface LLMConfig {
  mode: 'mock' | 'api';
  endpoint: string;
  apiKey: string;
  model: string;
}

function loadLLMConfig(): LLMConfig {
  try {
    const raw = scopedStorage.getItem(LLM_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    mode: 'mock',
    endpoint: '',
    apiKey: '',
    model: '',
  };
}

export default function TopBar({
  currentCharacter,
  availableCharacters,
  onSwitchCharacter,
  onToggleSidebar,
  sidebarOpen,
  onClearHistory,
  onResetEmotion,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmMode, setLlmMode] = useState<'mock' | 'api'>(loadLLMConfig().mode);
  const [endpoint, setEndpoint] = useState(loadLLMConfig().endpoint);
  const [apiKey, setApiKey] = useState(loadLLMConfig().apiKey);
  const [model, setModel] = useState(loadLLMConfig().model);

  const saveSettings = () => {
    const config: LLMConfig = { mode: llmMode, endpoint, apiKey, model };
    try {
      scopedStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
      toast.success('设置已保存');
      setSettingsOpen(false);
    } catch {
      toast.error('保存失败');
    }
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40',
          'bg-background/60 backdrop-blur-xl border-b border-border/30',
          'transition-all duration-300',
          sidebarOpen ? 'pr-80' : 'pr-0',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          {/* 左侧：角色信息 + 切换 */}
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
              {currentCharacter.name.charAt(0)}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-9 px-2">
                  <span className="font-semibold">{currentCharacter.name}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>切换角色</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableCharacters.map((char) => (
                  <DropdownMenuItem
                    key={char.character_id}
                    onClick={() => onSwitchCharacter(char.character_id)}
                    className="gap-2"
                  >
                    <div className="size-6 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                      {char.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{char.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        本能：
                        {
                          {
                            attack: '攻击',
                            avoid: '回避',
                            freeze: '冻结',
                            fawn: '讨好',
                            observe: '观察',
                          }[char.core.instinct_base]
                        }
                      </div>
                    </div>
                    {char.character_id === currentCharacter.character_id && (
                      <Check className="size-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 右侧：设置 + 侧边栏 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
            >
              <Settings className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
              className={sidebarOpen ? 'text-primary' : ''}
            >
              <PanelRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 设置对话框 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>设置</DialogTitle>
            <DialogDescription>
              配置 LLM 调用方式和对话参数
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* LLM 模式 */}
            <div className="space-y-3">
              <Label>LLM 调用模式</Label>
              <Select
                value={llmMode}
                onValueChange={(v) => setLlmMode(v as 'mock' | 'api')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock 模式（本地规则生成）</SelectItem>
                  <SelectItem value="api">API 模式（调用真实接口）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Mock 模式使用本地规则引擎生成回复，无需网络，开箱即用。
              </p>
            </div>

            {llmMode === 'api' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint">API 端点</Label>
                  <Input
                    id="endpoint"
                    placeholder="https://api.example.com/v1/chat/completions"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apikey">API Key</Label>
                  <Input
                    id="apikey"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">模型名称</Label>
                  <Input
                    id="model"
                    placeholder="gpt-4o-mini"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  注意：API 模式为占位功能，实际调用需自行适配接口格式。
                </p>
              </div>
            )}

            {/* 操作 */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <Label>对话管理</Label>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onResetEmotion();
                    toast.success('情绪已重置为基线');
                  }}
                >
                  重置情绪
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onClearHistory();
                    toast.success('对话历史已清空');
                  }}
                >
                  清空对话
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
              取消
            </Button>
            <Button onClick={saveSettings}>保存设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
