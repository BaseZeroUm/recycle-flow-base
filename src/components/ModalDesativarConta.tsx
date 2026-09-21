import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";

interface ModalDesativarContaProps {
  userId: string;
  trigger?: React.ReactNode | undefined;
}

export function ModalDesativarConta({ userId, trigger }: ModalDesativarContaProps) {
  const [aberto, setAberto] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleConfirmarDesativacao() {
    if (desativando) return;
    try {
      setDesativando(true);

      // 1. Soft-delete: atualiza o perfil para inativo com registro de data
      const agora = new Date().toISOString();
      const { error: erroUpdate } = await (supabase.from("profiles") as any)
        .update({
          ativo: false,
          desativado_em: agora,
        })
        .eq("id", userId);

      if (erroUpdate) {
        // Fallback caso a coluna desativado_em não exista na tabela profiles
        const { error: erroFallback } = await supabase
          .from("profiles")
          .update({ ativo: false })
          .eq("id", userId);

        if (erroFallback) {
          throw erroFallback;
        }
      }

      // 2. Limpeza de cache de queries ativas
      await queryClient.cancelQueries();
      queryClient.clear();

      // 3. Encerramento da sessão (logout)
      await supabase.auth.signOut();

      // 4. Fechar modal e redirecionar para /auth
      setAberto(false);
      navigate({ to: "/auth", replace: true });

      // 5. Toast informativo sobre a desativação
      toast.info("Sua conta foi desativada com sucesso. Para reativá-la, entre em contato com o suporte.");
    } catch (err: any) {
      toast.error("Não foi possível desativar a conta", {
        description: err?.message || "Ocorreu um erro inesperado. Tente novamente ou contate o suporte.",
      });
      setDesativando(false);
    }
  }

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive" size="sm" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Desativar Conta
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-lg border-destructive/30">
        <AlertDialogHeader>
          <div className="mx-auto sm:mx-0 mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-destructive">
            Deseja realmente desativar sua conta?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2 text-sm text-foreground text-left leading-relaxed">
            <p>
              Ao confirmar, seu acesso ao sistema será interrompido imediatamente e sua sessão será encerrada.
            </p>
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5 space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Regras e diretrizes da desativação:</p>
              <ol className="list-decimal pl-4 space-y-2">
                <li>
                  <strong className="text-foreground">Retenção de dados:</strong> Seus dados cadastrais e registros
                  permanecerão armazenados no sistema exclusivamente pelo período de retenção previsto pela LGPD e
                  obrigações fiscais/legais.
                </li>
                <li>
                  <strong className="text-foreground">Reativação:</strong> Para uma futura reativação ou recuperação do
                  acesso à conta, será necessário entrar em contato diretamente com o nosso suporte.
                </li>
              </ol>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
          <AlertDialogCancel disabled={desativando}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmarDesativacao}
            disabled={desativando}
            className="gap-2"
          >
            {desativando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Desativando conta...
              </>
            ) : (
              "Confirmar Desativação"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
