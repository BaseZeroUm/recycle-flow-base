import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { ehAdmin, useSessao } from "@/hooks/use-sessao";
import { sanitizarMensagemErro } from "@/lib/tratamento-erro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ModalAlterarSenha } from "@/components/ModalAlterarSenha";
import { ModalDesativarConta } from "@/components/ModalDesativarConta";
import {
  Building2,
  User,
  AlertTriangle,
  Loader2,
  Lock,
  Save,
  Mail,
  Phone,
  FileText,
  MapPin,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa")({
  head: () => ({
    meta: [
      { title: "Empresa e Perfil — Base 01" },
      { name: "description", content: "Dados cadastrais da empresa e gerenciamento da conta no Base 01." },
      { property: "og:title", content: "Empresa e Perfil — Base 01" },
      { property: "og:description", content: "Dados cadastrais da empresa e gerenciamento da conta no Base 01." },
    ],
  }),
  component: Empresa,
});

interface DadosEmpresa {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
}

function Empresa() {
  const queryClient = useQueryClient();
  const { data: sessao, isLoading: carregandoSessao } = useSessao();
  const admin = ehAdmin(sessao);

  const [form, setForm] = useState<DadosEmpresa>({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
  });

  const { data: empresa, isLoading: carregandoEmpresa } = useQuery<DadosEmpresa | null>({
    queryKey: ["empresa", sessao?.empresaId],
    enabled: !!sessao?.empresaId,
    queryFn: async () => {
      if (!sessao?.empresaId) return null;
      const { data, error } = await supabase
        .from("empresas")
        .select("razao_social, nome_fantasia, cnpj, telefone, email, endereco")
        .eq("id", sessao.empresaId)
        .maybeSingle();

      if (error) throw error;
      return data as DadosEmpresa | null;
    },
  });

  useEffect(() => {
    if (empresa) {
      setForm({
        razao_social: empresa.razao_social ?? "",
        nome_fantasia: empresa.nome_fantasia ?? "",
        cnpj: empresa.cnpj ?? "",
        telefone: empresa.telefone ?? "",
        email: empresa.email ?? "",
        endereco: empresa.endereco ?? "",
      });
    }
  }, [empresa]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!sessao?.empresaId) throw new Error("Sessão ou empresa não identificada");
      const { error } = await supabase
        .from("empresas")
        .update({
          razao_social: form.razao_social.trim(),
          nome_fantasia: form.nome_fantasia?.trim() || null,
          cnpj: form.cnpj?.trim() || null,
          telefone: form.telefone?.trim() || null,
          email: form.email?.trim() || null,
          endereco: form.endereco?.trim() || null,
        })
        .eq("id", sessao.empresaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados cadastrais atualizados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["empresa"] });
      queryClient.invalidateQueries({ queryKey: ["sessao"] });
    },
    onError: (e: Error) =>
      toast.error("Erro ao salvar alterações", {
        description: sanitizarMensagemErro(e),
      }),
  });

  if (carregandoSessao || carregandoEmpresa) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Carregando dados da empresa e perfil...</span>
        </div>
      </div>
    );
  }

  const papeisLegiveis: Record<string, string> = {
    admin: "Administrador",
    financeiro: "Financeiro",
    operacional: "Operacional",
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <PageHeader
        titulo="Empresa e Perfil"
        descricao="Visualize e gerencie os dados cadastrais da sua empresa e as credenciais da sua conta."
      />

      {/* 1. Card: Dados Cadastrais da Empresa */}
      <div className="rounded-2xl border bg-card p-6 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Dados Cadastrais da Organização</h2>
              <p className="text-xs text-muted-foreground">
                Informações preenchidas no cadastro inicial e exibidas em tickets e relatórios.
              </p>
            </div>
          </div>
          {!admin && (
            <Badge variant="secondary" className="gap-1.5 self-start sm:self-auto text-xs font-normal">
              <Lock className="h-3 w-3" />
              Modo somente leitura (Apenas administradores editam)
            </Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="razao_social" className="text-xs flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Razão Social / Nome Oficial <span className="text-destructive">*</span>
            </Label>
            <Input
              id="razao_social"
              disabled={!admin}
              value={form.razao_social}
              onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
              placeholder="Razão Social completa"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome_fantasia" className="text-xs flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Nome Fantasia
            </Label>
            <Input
              id="nome_fantasia"
              disabled={!admin}
              value={form.nome_fantasia ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, nome_fantasia: e.target.value }))}
              placeholder="Nome comercial ou fantasia"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cnpj" className="text-xs flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              CNPJ / CPF
            </Label>
            <Input
              id="cnpj"
              disabled={!admin}
              value={form.cnpj ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefone" className="text-xs flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Telefone / WhatsApp
            </Label>
            <Input
              id="telefone"
              disabled={!admin}
              value={form.telefone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              E-mail de Contato
            </Label>
            <Input
              id="email"
              type="email"
              disabled={!admin}
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="contato@empresa.com.br"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="endereco" className="text-xs flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Endereço Completo
            </Label>
            <Input
              id="endereco"
              disabled={!admin}
              value={form.endereco ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
              placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
            />
          </div>
        </div>

        {admin && (
          <div className="pt-2 flex justify-end">
            <Button
              variant="brand"
              onClick={() => !salvar.isPending && salvar.mutate()}
              disabled={salvar.isPending || !form.razao_social.trim()}
              className="gap-2"
            >
              {salvar.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando alterações...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* 2. Card: Meu Perfil de Usuário Logado */}
      <div className="rounded-2xl border bg-card p-6 shadow-card space-y-6">
        <div className="flex items-center gap-2.5 border-b pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Meu Perfil de Acesso</h2>
            <p className="text-xs text-muted-foreground">
              Suas credenciais de login e permissões de acesso na plataforma.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 rounded-xl bg-muted/40 p-3.5">
            <span className="text-xs font-medium text-muted-foreground">Nome</span>
            <p className="text-sm font-semibold text-foreground">{sessao?.nome || "Não informado"}</p>
          </div>

          <div className="space-y-1 rounded-xl bg-muted/40 p-3.5">
            <span className="text-xs font-medium text-muted-foreground">E-mail de Login</span>
            <p className="text-sm font-semibold text-foreground">{sessao?.email || "Não informado"}</p>
          </div>

          <div className="space-y-1.5 rounded-xl bg-muted/40 p-3.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Perfis de Permissão</span>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {sessao?.papeis && sessao.papeis.length > 0 ? (
                sessao.papeis.map((papel) => (
                  <Badge key={papel} variant="outline" className="text-xs capitalize font-medium">
                    {papeisLegiveis[papel] ?? papel}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary" className="text-xs font-normal">
                  Sem perfil atribuído
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="text-sm font-medium text-foreground">Segurança da Conta</p>
            <p className="text-xs text-muted-foreground">
              Atualize sua senha de acesso periodicamente para manter sua conta protegida.
            </p>
          </div>
          <ModalAlterarSenha emailUsuario={sessao?.email} />
        </div>
      </div>

      {/* 3. Card: Zona de Perigo (Desativação de Conta) */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 text-destructive">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-destructive">Zona de Perigo</h2>
            <p className="text-xs text-muted-foreground">
              Ações sensíveis relacionadas à sua conta de acesso.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Desativar Conta de Acesso</p>
            <p className="text-xs text-muted-foreground max-w-xl">
              Ao desativar sua conta, seu acesso ao dashboard será encerrado imediatamente. Seus dados cadastrais
              serão preservados exclusivamente pelo período previsto pela LGPD e exigências fiscais.
            </p>
          </div>

          {sessao?.userId && <ModalDesativarConta userId={sessao.userId} />}
        </div>
      </div>
    </div>
  );
}
