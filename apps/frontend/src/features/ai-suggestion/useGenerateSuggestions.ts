import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AiSuggestionWorkflow } from '@codeshore/data-types';

import {
  AiSuggestionGenerateEvent,
  createGenerateEventSource,
} from './service';

// SSE controller for "產生建議" (requirement 1.2), following `useMvRefresh.ts`'s
// exact EventSource/onmessage/onerror pattern. Per task 4.2's documented
// deviation (see `AiSuggestionGenerateEvent`'s doc comment in service.ts),
// there is no per-suggestion `created` event to append incrementally -- the
// only actionable signal is the overall `done` event (`workflow: 'all'`),
// which is when the suggestion list query is invalidated so the review page
// picks up whatever was actually created via a normal refetch.
export function useGenerateSuggestions() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [createdTotal, setCreatedTotal] = useState<number | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const runningRef = useRef(false);

  const start = useCallback(
    (workflow?: AiSuggestionWorkflow | 'all', model?: string) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      setDone(false);
      setCreatedTotal(null);
      setProgress([]);

      esRef.current?.close();
      const es = createGenerateEventSource(workflow, model);
      esRef.current = es;

      es.onmessage = (event: MessageEvent) => {
        try {
          const { data } = JSON.parse(event.data) ?? {};
          const generateEvent = data as AiSuggestionGenerateEvent | undefined;
          if (!generateEvent) return;

          if (generateEvent.type === 'log') {
            setProgress(prev => [
              ...prev,
              `[${generateEvent.workflow}] ${generateEvent.message}`,
            ]);
          } else if (generateEvent.type === 'error') {
            setProgress(prev => [
              ...prev,
              `[${generateEvent.workflow}] 錯誤：${generateEvent.message}`,
            ]);
          } else if (generateEvent.type === 'done') {
            if (generateEvent.workflow === 'all') {
              setProgress(prev => [
                ...prev,
                `完成，共產生 ${generateEvent.created} 筆建議`,
              ]);
              setCreatedTotal(generateEvent.created);
              setDone(true);
              setRunning(false);
              runningRef.current = false;
              es.close();
              // No per-suggestion incremental data to append (see doc comment
              // above) -- refetch the list instead.
              queryClient.invalidateQueries({
                queryKey: ['ai-suggestion', 'list'],
              });
            } else {
              setProgress(prev => [
                ...prev,
                `[${generateEvent.workflow}] ${generateEvent.message}`,
              ]);
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
        es.close();
      };
    },
    [queryClient],
  );

  const clear = useCallback(() => {
    setProgress([]);
    setDone(false);
    setCreatedTotal(null);
  }, []);

  useEffect(() => () => esRef.current?.close(), []);

  return { start, clear, running, done, createdTotal, progress };
}
