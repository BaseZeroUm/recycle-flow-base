import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, Loader2, AlertCircle } from "lucide-react";

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
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [checandoSessao, setChecandoSessao] = useState(true);
  const [sessaoValida, setSessaoValida] = useState(false);

  useEffect(() => {
    let montado = true;

    // Se houver parâmetros de recuperação na URL (#access_token ou ?code), aguardamos o Supabase processar
    const hasAuthParams =
      typeof window !== "undefined" &&
      (window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=recovery") ||
        window.location.search.includes("code="));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!montado) return;

      if (event === "PASSWORD_RECOVERY" || Boolean(session)) {
        setSessaoValida(true);
      }
      setChecandoSessao(false);
    });

    async function verificarSessaoInicial() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!montado) return;

      if (session) {
        setSessaoValida(true);
        setChecandoSessao(false);
      } else if (!hasAuthParams) {
        // Se não há parâmetros de autenticação na URL, encerramos a checagem
        setChecandoSessao(false);
      }
    }

    verificarSessaoInicial();

    // Fallback de segurança para encerrar o loading caso o Supabase demore a responder
    const timer = setTimeout(() => {
      if (montado) setChecandoSessao(false);
    }, 3000);

    return () => {
      montado = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const regras = [
    { label: "Mínimo de 8 caracteres", valida: senha.length >= 8 },
    { label: "Pelo menos uma letra maiúscula", valida: /[A-Z]/.test(senha) },
    { label: "Pelo menos uma letra minúscula", valida: /[a-z]/.test(senha) },
    { label: "Pelo menos um número", valida: /[0-9]/.test(senha) },
    { label: "Pelo menos um caractere especial (!@#$...)", valida: /[^A-Za-z0-9]/.test(senha) },
  ];

  const senhaValida = regras.every((r) => r.valida);
  const coincidem = senha.length > 0 && senha === confirmarSenha;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!senhaValida) {
      toast.error("Senha não atende aos requisitos", {
        description: "A senha deve ter no mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.",
      });
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("Senhas não coincidem", {
        description: "Certifique-se de que a nova senha e a confirmação sejam iguais.",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        toast.error("Não foi possível alterar", { description: error.message });
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      navigate({ to: "/painel", replace: true });
    } catch (err: any) {
      toast.error("Não foi possível alterar", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  if (checandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Validando link de acesso...</span>
        </div>
      </div>
    );
  }

  if (!sessaoValida) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border bg-card p-7 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Link expirado ou inválido</h1>
            <p className="text-xs text-muted-foreground">
              Não encontramos uma sessão de recuperação ativa. Solicite um novo link para prosseguir.
            </p>
          </div>
          <Button
            variant="brand"
            className="w-full"
            onClick={() => navigate({ to: "/auth" })}
          >
            Solicitar novo link no login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <form onSubmit={salvar} className="w-full max-w-sm space-y-5 rounded-3xl border bg-card p-7 shadow-card">
        <LogoFull />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Redefinir sua senha</h1>
          <p className="text-xs text-muted-foreground">Defina uma nova senha forte para acessar a sua conta.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nova">Nova senha</Label>
          <div className="relative">
            <Input
              id="nova"
              type={showPassword ? "text" : "password"}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              placeholder="Digite a nova senha"
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmar">Confirmar nova senha</Label>
          <div className="relative">
            <Input
              id="confirmar"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ocultar confirmação" : "Ver confirmação"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmarSenha && !coincidem && (
            <p className="text-xs text-destructive">As senhas não coincidem.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-muted/40 p-3.5 space-y-2">
          <p className="text-xs font-medium text-foreground">Requisitos da senha:</p>
          <ul className="space-y-1.5 text-xs">
            {regras.map((regra, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 transition-colors ${
                  regra.valida ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {regra.valida ? (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 ml-1 mr-1" />
                )}
                <span>{regra.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button
          type="submit"
          variant="brand"
          className="w-full"
          disabled={loading || !senhaValida || !coincidem}
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}