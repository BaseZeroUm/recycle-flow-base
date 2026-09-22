import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";
import { validatePassword } from "@/lib/password-validator";
import { PasswordRequirements } from "@/components/PasswordRequirements";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Base 01" },
      { name: "description", content: "Acesse a conta da sua empresa no Base 01." },
      { property: "og:title", content: "Entrar — Base 01" },
      { property: "og:description", content: "Acesse a conta da sua empresa no Base 01." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState("entrar");
  const [showPassword, setShowPassword] = useState(false);

  // Estados dos campos de senha na aba cadastrar
  const [cadSenha, setCadSenha] = useState("");
  const [cadConfirmarSenha, setCadConfirmarSenha] = useState("");
  const [showCadPassword, setShowCadPassword] = useState(false);
  const [showCadConfirmPassword, setShowCadConfirmPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (hash.includes("type=recovery") || search.includes("type=recovery")) {
        navigate({ to: "/redefinir-senha", replace: true });
        return;
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const f = new FormData(e.currentTarget);
    try {
      setLoading(true);
      const email = String(f.get("email"));
      const password = String(f.get("senha"));

      // 1. Executa o login normalmente
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData?.user) {
        // 2. Busca dados de perfil, status LGPD e dados da empresa (trial, categoria e plano)
        let profileResult = await (supabase.from("profiles") as any)
          .select(`
            id,
            ativo,
            desativado_em,
            empresa:empresas (
              id,
              ativa,
              categoria,
              plano,
              trial_ate,
              assinatura_ativa
            )
          `)
          .eq("id", authData.user.id)
          .single();

        let profile = profileResult.data;

        if (profileResult.error || !profile) {
          // Fallback resiliente se novas colunas ainda não estiverem migradas no banco
          const fallback = await (supabase.from("profiles") as any)
            .select(`
              id,
              ativo,
              empresa:empresas (
                id,
                ativa,
                trial_ate,
                assinatura_ativa
              )
            `)
            .eq("id", authData.user.id)
            .single();

          if (fallback.error || !fallback.data) {
            throw new Error("Não foi possível carregar os dados da sua conta.");
          }
          profile = fallback.data;
        }

        // 3. Validação LGPD (Soft-delete)
        if (!profile.ativo || profile.desativado_em) {
          await supabase.auth.signOut();
          throw new Error("Esta conta foi desativada temporariamente. Entre em contato com o suporte.");
        }

        const empresa: any = Array.isArray(profile.empresa) ? profile.empresa[0] : profile.empresa;

        if (!empresa || !empresa.ativa) {
          await supabase.auth.signOut();
          throw new Error("A empresa vinculada a este usuário está suspensa.");
        }

        // 4. Validação de Trial Expirado
        // Apenas bloqueia se trial_ate estiver explicitamente preenchido e já expirado sem assinatura ativa
        if (empresa?.trial_ate && !empresa.assinatura_ativa) {
          const dataLimite = new Date(empresa.trial_ate);
          const hoje = new Date();
          if (!isNaN(dataLimite.getTime()) && dataLimite < hoje) {
            // Redireciona para a tela de bloqueio/escolha de plano
            navigate({ to: "/trial-expirado", replace: true });
            return;
          }
        }

        // 5. Roteamento Inteligente por Segmento
        const isProdDomain =
          typeof window !== "undefined" &&
          (window.location.hostname.endsWith("basezeroum.com.br") ||
            window.location.hostname === "basezeroum.com.br");

        switch (empresa?.categoria) {
          case "reciclagem":
            navigate({ to: "/painel", replace: true });
            break;

          case "adega":
            if (isProdDomain) {
              window.location.href = "https://adega.basezeroum.com.br";
            } else {
              navigate({ to: "/painel", replace: true });
            }
            break;

          case "admin":
            if (isProdDomain) {
              window.location.href = "https://admin.basezeroum.com.br";
            } else {
              navigate({ to: "/painel", replace: true });
            }
            break;

          case "multi":
            navigate({ to: "/selecao-modulo" as any, replace: true });
            break;

          default:
            navigate({ to: "/painel", replace: true });
            break;
        }
      }
    } catch (err: any) {
      toast.error("Não foi possível entrar", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  async function cadastrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const f = new FormData(e.currentTarget);
    try {
      setLoading(true);
      const email = String(f.get("email"));
      const password = String(f.get("senha"));
      const confirmarSenha = String(f.get("confirmarSenha") ?? "");
      const nome = String(f.get("nome"));
      const nomeEmpresa = String(f.get("empresa"));
      const cnpj = String(f.get("cnpj") ?? "");
      const telefone = String(f.get("telefone") ?? "");
      const segmento = String(f.get("categoria") ?? "reciclagem");

      // 1. Validação de complexidade da senha
      const { isValid } = validatePassword(password);
      if (!isValid) {
        toast.error("Senha não atende aos requisitos", {
          description:
            "A senha deve ter no mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.",
        });
        return;
      }

      // 2. Validação de confirmação de senha
      if (password !== confirmarSenha) {
        toast.error("Senhas não coincidem", {
          description: "Certifique-se de que a senha e a confirmação sejam exatamente iguais.",
        });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            nome,
            empresa_nome: nomeEmpresa,
            empresa_cnpj: cnpj,
            telefone,
            categoria: segmento, // 'reciclagem' ou 'adega'
          },
        },
      });

      if (error) {
        toast.error("Não foi possível criar a conta", { description: error.message });
        return;
      }

      const isProdDomain =
        typeof window !== "undefined" &&
        (window.location.hostname.endsWith("basezeroum.com.br") ||
          window.location.hostname === "basezeroum.com.br");

      // Redirecionamento pós-cadastro imediato
      if (data.session) {
        if (segmento === "reciclagem") {
          navigate({ to: "/painel", replace: true });
        } else if (segmento === "adega") {
          if (isProdDomain) {
            window.location.href = "https://adega.basezeroum.com.br";
          } else {
            navigate({ to: "/painel", replace: true });
          }
        } else {
          navigate({ to: "/painel", replace: true });
        }
      } else {
        toast.success("Conta criada", {
          description: "Confirme o e-mail que enviamos para ativar o acesso.",
        });
        setModo("entrar");
      }
    } catch (err: any) {
      toast.error("Não foi possível criar a conta", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  async function recuperar(email: string) {
    if (loading) return;
    if (!email) {
      toast.error("Informe o e-mail para recuperar a senha");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Enviamos um link de redefinição para o seu e-mail.");
    } catch (err: any) {
      toast.error("Erro ao solicitar recuperação", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <LogoFull />
        </div>

        <div className="rounded-3xl border bg-card p-7 shadow-card">
          <Tabs value={modo} onValueChange={setModo}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="cadastrar">Criar empresa</TabsTrigger>
            </TabsList>

            <TabsContent value="entrar" className="mt-6">
              <form onSubmit={entrar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      name="senha"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <button
                  type="button"
                  disabled={loading}
                  className="w-full text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  onClick={() =>
                    recuperar(
                      (document.getElementById("email") as HTMLInputElement | null)?.value ?? "",
                    )
                  }
                >
                  {loading ? "Enviando link..." : "Esqueci minha senha"}
                </button>
              </form>
            </TabsContent>

            <TabsContent value="cadastrar" className="mt-6">
              <form onSubmit={cadastrar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Segmento</Label>
                  <select
                    id="categoria"
                    name="categoria"
                    defaultValue="reciclagem"
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="reciclagem">Reciclagem</option>
                    <option value="adega">Adega / Bebidas</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empresa">Nome da empresa</Label>
                  <Input id="empresa" name="empresa" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" name="cnpj" placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" name="telefone" placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Seu nome</Label>
                  <Input id="nome" name="nome" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-cad">E-mail</Label>
                  <Input id="email-cad" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-cad">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha-cad"
                      name="senha"
                      type={showCadPassword ? "text" : "password"}
                      required
                      value={cadSenha}
                      onChange={(e) => setCadSenha(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Crie uma senha forte"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCadPassword(!showCadPassword)}
                      aria-label={showCadPassword ? "Ocultar senha" : "Ver senha"}
                    >
                      {showCadPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmar-senha-cad">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmar-senha-cad"
                      name="confirmarSenha"
                      type={showCadConfirmPassword ? "text" : "password"}
                      required
                      value={cadConfirmarSenha}
                      onChange={(e) => setCadConfirmarSenha(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCadConfirmPassword(!showCadConfirmPassword)}
                      aria-label={showCadConfirmPassword ? "Ocultar confirmação" : "Ver confirmação"}
                    >
                      {showCadConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {cadConfirmarSenha && cadSenha !== cadConfirmarSenha && (
                    <p className="text-xs text-destructive">As senhas não coincidem.</p>
                  )}
                </div>

                <PasswordRequirements password={cadSenha} />

                <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar conta da empresa"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
