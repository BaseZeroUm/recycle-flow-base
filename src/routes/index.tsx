import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("type=recovery") ||
        search.includes("type=recovery")
      ) {
        throw redirect({ to: "/redefinir-senha" });
      }
    }

    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      throw redirect({ to: "/painel" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
