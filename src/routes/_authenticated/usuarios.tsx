import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { ehAdmin, useSessao, type Papel } from "@/hooks/use-sessao";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Base 01" },
      { name: "description", content: "Perfis de acesso da equipe: admin, financeiro e operacional." },
      { property: "og:title", content: "Usuários — Base 01" },
      { property: "og:description", content: "Perfis de acesso da equipe no Base 01." },
    ],
  }),
  component: Usuarios,
});

interface Membro {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

function Usuarios() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const admin = ehAdmin(sessao);

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["membros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, email, ativo").order("nome");
      if (error) throw error;
      return (data ?? []) as Membro[];
    },
  });

  const { data: papeis = [] } = useQuery<{ user_id: string; role: Papel }[]>({
    queryKey: ["papeis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role: Papel }[];
    },
  });

  const alterar = useMutation({
    mutationFn: async ({ userId, papel }: { userId: string; papel: Papel }) => {
      if (!sessao) throw new Error("Sessão inválida");
      const { error: erroDelete } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (erroDelete) throw erroDelete;
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, empresa_id: sessao.empresaId, role: papel });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      queryClient.invalidateQueries({ queryKey: ["papeis"] });
      queryClient.invalidateQueries({ queryKey: ["sessao"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  if (!admin) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Apenas administradores gerenciam usuários.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Usuários"
        descricao="Defina o perfil de acesso de cada pessoa da empresa. Novos usuários entram pela tela de login usando o mesmo e-mail convidado."
      />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-52">Perfil</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {membros.map((m) => {
              const papel = papeis.find((p) => p.user_id === m.id)?.role ?? "operacional";
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={m.ativo ? "secondary" : "outline"}>{m.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={papel}
                      onValueChange={(v) => alterar.mutate({ userId: m.id, papel: v as Papel })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
