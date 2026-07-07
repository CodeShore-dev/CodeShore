import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createMvRefreshEventSource } from './service';

// SSE controller for "refresh all materialized views" (依 mv 依賴關係逐一 REFRESH，
// 並在 mv_tech 之後插入 keyword group reset)。同 useAdminCrawl 的 EventSource 模式，
// 額外追蹤目前執行到哪一支、以及是哪一支失敗（errorStep），供監控頁即時顯示。
export function useMvRefresh() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const runningRef = useRef(false);

  // fromStep（=上次失敗的 step id）：不重跑前面已成功的步驟，只從失敗處接續。
  // 省略則從頭開始整條 pipeline。
  const start = useCallback((fromStep?: string) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setDone(false);
    setSuccess(null);
    setCurrentStep(null);
    setErrorStep(null);
    setProgress(prev => (fromStep ? prev : []));

    esRef.current?.close();
    const es = createMvRefreshEventSource(fromStep);
    esRef.current = es;

    es.onmessage = (event: MessageEvent) => {
      try {
        const { data } = JSON.parse(event.data) ?? {};
        if (data?.type === 'log') {
          setCurrentStep(data.step ?? null);
          setProgress(prev => [...prev, data.message]);
        } else if (data?.type === 'error') {
          setErrorStep(data.step ?? null);
          setProgress(prev => [...prev, `[錯誤] ${data.message}`]);
        } else if (data?.type === 'done') {
          setDone(true);
          setRunning(false);
          runningRef.current = false;
          setSuccess(!!data.success);
          es.close();
          if (data.success) {
            queryClient.invalidateQueries({ queryKey: ['admin'] });
          }
        }
      } catch (error) {
        console.error(error);
      }
    };

    es.onerror = () => {
      setDone(true);
      setRunning(false);
      runningRef.current = false;
      setSuccess(prev => prev ?? false);
      es.close();
    };
  }, [queryClient]);

  const clear = useCallback(() => {
    setProgress([]);
    setDone(false);
    setSuccess(null);
    setCurrentStep(null);
    setErrorStep(null);
  }, []);

  useEffect(() => () => esRef.current?.close(), []);

  return {
    start,
    clear,
    running,
    done,
    success,
    currentStep,
    errorStep,
    progress,
  };
}
