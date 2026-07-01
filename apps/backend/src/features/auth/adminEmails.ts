// Shared admin-email allowlist check, used by both AdminGuard and
// PermissionGuard (previously duplicated verbatim in each file).
export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env['ADMIN_EMAILS'] ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  // If no list is configured, allow all authenticated users.
  if (!adminEmails.length) return true;

  return adminEmails.includes(email);
}
