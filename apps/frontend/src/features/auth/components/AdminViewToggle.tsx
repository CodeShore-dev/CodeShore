import { useAuthStore, useIsAdmin } from '../authStore';

// Admin-only debug control (Req 5.1-5.3): renders nothing for non-admins
// regardless of the current viewAsRegularUser value, so the toggle itself
// never leaks the feature's existence to a regular user. For an admin, it
// shows the currently active mode and a button that flips
// `viewAsRegularUser`. Not yet mounted anywhere (task 7).
export function AdminViewToggle() {
  const isAdmin = useIsAdmin();
  const viewAsRegularUser = useAuthStore(state => state.viewAsRegularUser);
  const setViewAsRegularUser = useAuthStore(state => state.setViewAsRegularUser);

  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-[#434653] md:inline">
        {viewAsRegularUser ? '一般使用者視角' : '管理視角'}
      </span>
      <button
        type="button"
        className="rounded-lg bg-[#003d92] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#002a6b] active:scale-95"
        onClick={() => setViewAsRegularUser(!viewAsRegularUser)}
      >
        {viewAsRegularUser ? '切換為管理視角' : '切換為一般使用者視角'}
      </button>
    </div>
  );
}
