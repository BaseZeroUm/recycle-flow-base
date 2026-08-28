import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { brl } from "@/lib/format";
import { useCategorias, useMateriais, useParceiros } from "@/lib/dados";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros — Base 01" },
      { name: "description", content: "Materiais, fornecedores, clientes e categorias de despesa." },
      { property: "og:title", content: "Cadastros — Base 01" },
      { property: "og:description", content: "Materiais, fornecedores, clientes e categorias de despesa." },
    ],
  }),
  component: Cadastros,
});

function Cadastros() {
  return (
    <div>
      <PageHeader titulo="Cadastros" descricao="Base de materiais, parceiros e categorias." />
      <Tabs defaultValue="materiais">
        <TabsList>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="cat-material">Categorias de material</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="categorias">Categorias de despesa</TabsTrigger>
        </TabsList>
        <TabsContent value="materiais" className="mt-4">
          <Materiais />
        </TabsContent>
        <TabsContent value="cat-material" className="mt-4">
          <CategoriasMaterial />
        </TabsContent>
        <TabsContent value="fornecedores" className="mt-4">
          <Parceiros tabela="fornecedores" titulo="Fornecedor" />
        </TabsContent>
        <TabsContent value="clientes" className="mt-4">
          <Parceiros tabela="clientes" titulo="Cliente" />
        </TabsContent>
        <TabsContent value="categorias" className="mt-4">
          <Categorias />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriasMaterial() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: categorias = [] } = useCategoriasMaterial();
  const { data: materiais = [] } = useMateriais(true);
  const [nome, setNome] = useState("");

  const criar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      if (!nome.trim()) throw new Error("Informe o nome");
      const { error } = await supabase
        .from("categorias_material")
        .insert({ empresa_id: sessao.empresaId, nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria de material criada");
      queryClient.invalidateQueries({ queryKey: ["categorias_material"] });
      setNome("");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias_material").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria removida");
      queryClient.invalidateQueries({ queryKey: ["categorias_material"] });
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  return (
    <Bloco
      acao={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            className="sm:w-64"
            placeholder="Nova categoria (ex.: Plástico)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar.mutate()}
          />
          <Button variant="brand" size="sm" onClick={() => criar.mutate()} disabled={criar.isPending}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Materiais</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categorias.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma categoria de material.
              </TableCell>
            </TableRow>
          )}
          {categorias.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell className="text-right">
                {materiais.filter((m) => m.categoria_material_id === c.id).length}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => remover.mutate(c.id)}>
                  <Trash2 className="h-4 w-4" /> Remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Bloco>
  );
}

function Materiais() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: materiais = [] } = useMateriais(true);
  const { data: catMateriais = [] } = useCategoriasMaterial();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [unidade, setUnidade] = useState("kg");
  const [compra, setCompra] = useState("");
  const [venda, setVenda] = useState("");

  const criar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      const { error } = await supabase.from("materiais").insert({
        empresa_id: sessao.empresaId,
        nome,
        categoria_material_id: categoriaId || null,
        unidade: unidade as "kg" | "ton",
        preco_compra: Number(compra) || 0,
        preco_venda: Number(venda) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material cadastrado");
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      setAberto(false);
      setNome("");
      setCompra("");
      setVenda("");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("materiais").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materiais"] }),
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const nomeCategoria = (id: string | null) => catMateriais.find((c) => c.id === id)?.nome ?? "—";

  return (
    <Bloco
      acao={
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm">
              <Plus className="h-4 w-4" /> Novo material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo material</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="PET" />
                </div>
                <div className="space-y-2">
                  <Label>Categoria do material</Label>
                  <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {catMateriais.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="ton">ton</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preço compra</Label>
                  <Input type="number" step="0.01" value={compra} onChange={(e) => setCompra(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Preço venda</Label>
                  <Input type="number" step="0.01" value={venda} onChange={(e) => setVenda(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="brand" onClick={() => criar.mutate()} disabled={criar.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Preço compra</TableHead>
            <TableHead className="text-right">Preço venda</TableHead>
            <TableHead className="text-right">Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materiais.map((m) => (
            <TableRow key={m.id} className={m.ativo ? undefined : "opacity-60"}>
              <TableCell className="font-medium">{m.nome}</TableCell>
              <TableCell>{nomeCategoria(m.categoria_material_id)}</TableCell>
              <TableCell>{m.unidade}</TableCell>
              <TableCell className="text-right">{brl(m.preco_compra)}</TableCell>
              <TableCell className="text-right">{brl(m.preco_venda)}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => alternarAtivo.mutate({ id: m.id, ativo: !m.ativo })}
                >
                  {m.ativo ? (
                    <>
                      <Trash2 className="h-4 w-4" /> Remover
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" /> Reativar
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Bloco>
  );
}

function Parceiros({ tabela, titulo }: { tabela: "fornecedores" | "clientes"; titulo: string }) {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: lista = [] } = useParceiros(tabela);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const criar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      const { error } = await supabase.from(tabela).insert({
        empresa_id: sessao.empresaId,
        nome,
        documento: documento || null,
        telefone: telefone || null,
        email: email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${titulo} cadastrado`);
      queryClient.invalidateQueries({ queryKey: [tabela] });
      setAberto(false);
      setNome("");
      setDocumento("");
      setTelefone("");
      setEmail("");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <Bloco
      acao={
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm">
              <Plus className="h-4 w-4" /> Novo {titulo.toLowerCase()}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo {titulo.toLowerCase()}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>CPF / CNPJ</Label>
                  <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="brand" onClick={() => criar.mutate()} disabled={criar.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>E-mail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                Nenhum registro.
              </TableCell>
            </TableRow>
          )}
          {lista.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.nome}</TableCell>
              <TableCell>{p.documento ?? "—"}</TableCell>
              <TableCell>{p.telefone ?? "—"}</TableCell>
              <TableCell>{p.email ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Bloco>
  );
}

function Categorias() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: categorias = [] } = useCategorias();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("operacional");

  const criar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      const { error } = await supabase.from("categorias_despesa").insert({
        empresa_id: sessao.empresaId,
        nome,
        grupo: grupo as "operacional",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria cadastrada");
      queryClient.invalidateQueries({ queryKey: ["categorias_despesa"] });
      setAberto(false);
      setNome("");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <Bloco
      acao={
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm">
              <Plus className="h-4 w-4" /> Nova categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova categoria de despesa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={grupo} onValueChange={setGrupo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="administrativa">Administrativa</SelectItem>
                    <SelectItem value="frota">Frota</SelectItem>
                    <SelectItem value="folha">Folha de pagamento</SelectItem>
                    <SelectItem value="impostos">Impostos</SelectItem>
                    <SelectItem value="financeira">Financeira</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="brand" onClick={() => criar.mutate()} disabled={criar.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead>Grupo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categorias.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell className="capitalize">{c.grupo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Bloco>
  );
}

function Bloco({ acao, children }: { acao: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex justify-end border-b p-3">{acao}</div>
      {children}
    </div>
  );
}
