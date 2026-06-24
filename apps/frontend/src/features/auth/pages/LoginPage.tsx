import { Navigate } from 'react-router';

import { useAuthStore, useIsAuthenticated } from '../authStore';

// Login page (task 2.2, requirements 2.3, 2.6). Already-authenticated users
// are redirected home; otherwise OAuth sign-in buttons are shown.
export function LoginPage() {
  const isLoading = useAuthStore(state => state.isLoading);
  const isAuthenticated = useIsAuthenticated();
  const loginWithGoogle = useAuthStore(state => state.loginWithGoogle);
  const loginWithGithub = useAuthStore(state => state.loginWithGithub);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-115">
        <div className="rounded-[20px] bg-white p-10 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
          <div className="mb-8 text-center">
            <div className="mb-4 text-[28px] font-black tracking-[-0.04em] text-[#001f2a]">
              <span className="text-[#003d92]">碼的</span>，
              <span className="text-[#fd7700]">上岸</span>了
            </div>
            <h1 className="mb-2 text-[28px] font-black tracking-[-0.02em] text-[#001f2a]">
              歡迎回來
            </h1>
            <p className="m-0 text-sm text-[#434653]">
              登入您的帳號，開始加入喜歡的職缺
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              className="flex items-center justify-center gap-2.5 rounded-xl border border-[#c3c6d5] bg-white py-3.5 text-sm font-bold text-[#001f2a] transition-colors hover:border-[#434653] hover:bg-[#f4faff] active:scale-95"
              onClick={() => loginWithGoogle()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285f4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34a853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.97 10.97 0 0 0 12 23z"
                />
                <path
                  fill="#fbbc05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#ea4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              繼續使用 Google
            </button>

            <button
              type="button"
              className="flex items-center justify-center gap-2.5 rounded-xl bg-[#24292f] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#0d1117] active:scale-95"
              onClick={() => loginWithGithub()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-1.95c-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.93 10.93 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.37-5.25 5.65.41.35.78 1.05.78 2.11v3.13c0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
              </svg>
              繼續使用 GitHub
            </button>
          </div>

          <div className="mt-6 rounded-xl bg-[#e6f6ff] p-4 text-xs leading-relaxed text-[#434653]">
            <strong className="text-[#001f2a]">說明 · </strong>
            登入只是為了讓你管理喜歡／不喜歡的職缺。我們不會碰你的履歷、不會代投職缺、也不會把你的資料賣給人力銀行。
            投履歷的動作，永遠在 104 / Cake 上完成。
          </div>
        </div>
      </div>
    </div>
  );
}
