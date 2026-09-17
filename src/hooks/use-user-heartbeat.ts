import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserHeartbeat() {
  useEffect(() => {
    const ping = () => {
      Promise.resolve(supabase.rpc("registrar_ping_atividade")).catch(() => {});
    };

    // Registra imediatamente ao carregar a tela
    ping();

    // Dispara a cada 60 segundos enquanto o usuário mantiver a aba aberta
    const interval = setInterval(ping, 60000);

    return () => clearInterval(interval);
  }, []);
}

