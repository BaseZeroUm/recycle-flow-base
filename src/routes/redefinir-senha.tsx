import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Base 01" },
      { name: "description", content: "Defina uma nova senha para acessar o Base 01." },
      { property: "og:title", content: "Redefinir senha — Base 01" },
      { property: "og:description", content: "Defina uma nova senha para acessar o Base 01." },
    ],
  }),
  component: Redefinir,
});

function Redefinir() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) return toast.error("Não foi possível alterar", { description: error.message });
    toast.success("Senha atualizada");
    navigate({ to: "/painel", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <form onSubmit={salvar} className="w-full max-w-sm space-y-5 rounded-3xl border bg-card p-7 shadow-card">
        <LogoFull />
        <div className="space-y-2">
          <Label htmlFor="nova">Nova senha</Label>
          <Input
            id="nova"
            type="password"
            minLength={6}
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" variant="brand" className="w-full" disabled={loading}>
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
