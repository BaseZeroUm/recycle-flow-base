import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";
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
      const { error } = await supabase.auth.signInWithPassword({
        email: String(f.get("email")),
        password: String(f.get("senha")),
      });
      if (error) {
        toast.error("Não foi possível entrar", { description: error.message });
        return;
      }
      navigate({ to: "/painel", replace: true });
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
      const { data, error } = await supabase.auth.signUp({
        email: String(f.get("email")),
        password: String(f.get("senha")),
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            nome: String(f.get("nome")),
            empresa_nome: String(f.get("empresa")),
            empresa_cnpj: String(f.get("cnpj") ?? ""),
            telefone: String(f.get("telefone") ?? ""),
          },
        },
      });
      if (error) {
        toast.error("Não foi possível criar a conta", { description: error.message });
        return;
      }
      if (data.session) {
        navigate({ to: "/painel", replace: true });
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

  async function google() {
    if (loading) return;
    try {
      setLoading(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Falha no login com Google");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/painel", replace: true });
    } catch (err: any) {
      toast.error("Falha no login com Google");
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
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete="new-password"
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
                  {loading ? "Criando..." : "Criar conta da empresa"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google} disabled={loading}>
            {loading ? "Conectando..." : "Continuar com Google"}
          </Button>
        </div>
      </div>
    </div>
  );
}
