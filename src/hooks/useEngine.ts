import { useEffect, useRef, useState, useCallback } from 'react';
import type { CharacterEngine } from '../engine/CharacterEngine';

export function useEngine() {
  const [engine, setEngine] = useState<CharacterEngine | null>(null);
  const [, forceUpdate] = useState(0);

  const rerender = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    // 动态导入，避免 SSR / 模块初始化阶段的问题
    import('../engine/CharacterEngine').then(({ CharacterEngine }) => {
      if (!mounted) return;
      const instance = new CharacterEngine();
      setEngine(instance);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(rerender);
  }, [engine, rerender]);

  return engine;
}
