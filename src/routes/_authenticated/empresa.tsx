import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { ehAdmin, useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/empresa")({
  head: () => ({
    meta: [
      { title: "Empresa — Base 01" },
      { name: "description", content: "Dados cadastrais da empresa no Base 01." },
      { property: "og:title", content: "Empresa — Base 01" },
      { property: "og:description", content: "Dados cadastrais da empresa no Base 01." },
    ],
  }),
  component: Empresa,
});

interface Dados {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
}

function Empresa() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const admin = ehAdmin(sessao);
  const [form, setForm] = useState<Dados>({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
  });

  const { data } = useQuery<Dados | null>({
    queryKey: ["empresa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("razao_social, nome_fantasia, cnpj, telefone, email, endereco")
        .maybeSingle();
      if (error) throw error;
      return data as Dados | null;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      const { error } = await supabase.from("empresas").update(form).eq("id", sessao.empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      queryClient.invalidateQueries({ queryKey: ["empresa"] });
      queryClient.invalidateQueries({ queryKey: ["sessao"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  if (!admin) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Apenas administradores editam a empresa.</p>
      </div>
    );
  }

  const campo = (label: string, key: keyof Dados, tipo = "text") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={tipo}
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div>
      <PageHeader titulo="Empresa" descricao="Dados cadastrais usados nos relatórios." />
      <div className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        {campo("Razão social", "razao_social")}
        {campo("Nome fantasia", "nome_fantasia")}
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("CNPJ", "cnpj")}
          {campo("Telefone", "telefone")}
        </div>
        {campo("E-mail", "email", "email")}
        {campo("Endereço", "endereco")}
        <Button variant="brand" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
