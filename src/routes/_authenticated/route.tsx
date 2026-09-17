import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TrialGate } from "@/components/TrialGate";
import { useUserHeartbeat } from "@/hooks/use-user-heartbeat";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useUserHeartbeat();

  return (
    <AppShell>
      <TrialGate>
        <Outlet />
      </TrialGate>
    </AppShell>
  );
}

