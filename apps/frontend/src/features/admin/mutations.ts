import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateJobSalary } from './service';

// Manual salary correction for an anomalous job (task 9.1). Refreshes the salary
// anomaly list on success (parity with useAdminStore.saveSalary → loadSalary).
export function useUpdateSalaryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      min,
      max,
      type,
    }: {
      id: string;
      min: number;
      max: number;
      type: 'month' | 'year';
    }) => updateJobSalary(id, min, max, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'salary'] });
    },
  });
}
