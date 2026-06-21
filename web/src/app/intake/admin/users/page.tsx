import { AdminUserManagement } from "@/components/admin/admin-user-management";
import { AppShell } from "@/components/app-shell/app-shell";

export default function AdminUsersPage() {
  return (
    <AppShell eyebrow="Administration" title="Users and access">
      <AdminUserManagement />
    </AppShell>
  );
}
