import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CrawlParams, createAdminCrawlEventSource } from './service';

// Admin crawl SSE controller (task 9.1). Ported from useAdminStore.startCrawl:
// opens an EventSource, collects log lines, and on a successful done event
// refreshes every admin query so the anomaly tables reflect the new crawl.
export function useAdminCrawl() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [label, setLabel] = useState('');
  const [progress, setProgress] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const runningRef = useRef(false);

  const start = useCallback(
    (params: CrawlParams, crawlLabel: string) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      setDone(false);
      setLabel(crawlLabel);
      setProgress([]);

      esRef.current?.close();
      const es = createAdminCrawlEventSource(params);
      esRef.current = es;

      es.onmessage = (event: MessageEvent) => {
        try {
          const { data } = JSON.parse(event.data) ?? {};
          if (data?.type === 'log') {
            setProgress(prev => [...prev, data.message]);
          } else if (data?.type === 'done' || data?.type === 'error') {
            if (data.type === 'error' && data.message) {
              setProgress(prev => [...prev, `[error] ${data.message}`]);
            }
            setDone(true);
            setRunning(false);
            runningRef.current = false;
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
        es.close();
      };
    },
    [queryClient],
  );

  const clear = useCallback(() => {
    setProgress([]);
    setDone(false);
    setLabel('');
  }, []);

  useEffect(() => () => esRef.current?.close(), []);

  return { start, clear, running, done, label, progress };
}
