import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { supabase } from '../../../lib/supabase';
import { consumeReturnUrl } from '../returnUrl';

// OAuth callback handler (task 2.2, requirement 2.6). Completes the
// client-side session and routes the user home, or shows an error and
// returns to login on failure.
export function AuthCallbackPage() {
  const {
    data,
    error: sessionError,
    isLoading,
  } = useQuery({
    queryKey: ['authSession'],
    queryFn: () => supabase.auth.getSession(),
    retry: false,
  });

  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (sessionError) {
      setError(sessionError.message);
    } else if (data?.data.session) {
      navigate(consumeReturnUrl() ?? '/', { replace: true });
    } else {
      setError('登入失敗，請再試一次。');
      timer = setTimeout(() => navigate('/login', { replace: true }), 2000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, sessionError, isLoading, navigate]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      {error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : (
        <div className="text-center text-[#003d92]">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#003d92] border-t-transparent" />
          正在登入...
        </div>
      )}
    </div>
  );
}

