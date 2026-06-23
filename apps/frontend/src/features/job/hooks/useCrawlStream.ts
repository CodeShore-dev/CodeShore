import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createCrawlEventSource } from '../service';

// Streams crawl progress over SSE and refreshes the job list on success
// (task 7.4). Ported from useJobStore.clickToCrawlJob.
export function useCrawlStream() {
  const queryClient = useQueryClient();
  const [crawlJobId, setCrawlJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(
    (jobId: string) => {
      esRef.current?.close();
      setCrawlJobId(jobId);
      setProgress([]);
      setDone(false);

      const es = createCrawlEventSource(jobId);
      esRef.current = es;

      es.onmessage = (event: MessageEvent) => {
        try {
          const { data } = JSON.parse(event.data) ?? {};
          if (data?.type === 'log') {
            setProgress(prev => [...prev, data.message]);
          } else if (data?.type === 'done' || data?.type === 'error') {
            setDone(true);
            es.close();
            if (data.success) {
              queryClient.invalidateQueries({ queryKey: ['job', 'list'] });
            }
          }
        } catch (error) {
          console.error(error);
        }
      };

      es.onerror = () => {
        setDone(true);
        es.close();
      };
    },
    [queryClient],
  );

  useEffect(() => () => esRef.current?.close(), []);

  return { start, progress, done, crawlJobId };
}
