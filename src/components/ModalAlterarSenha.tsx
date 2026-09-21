import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validatePassword } from "@/lib/password-validator";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff, Loader2, Mail } from "lucide-react";

interface ModalAlterarSenhaProps {
  emailUsuario?: string | undefined;
  trigger?: React.ReactNode | undefined;
}

export function ModalAlterarSenha({ emailUsuario, trigger }: ModalAlterarSenhaProps) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const { isValid: senhaValida } = validatePassword(senha);
  const coincidem = senha.length > 0 && senha === confirmarSenha;

  function resetarCampos() {
    setSenha("");
    setConfirmarSenha("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!senhaValida) {
      toast.error("Senha não atende aos requisitos de segurança", {
        description: "Verifique os requisitos abaixo do campo de senha.",
      });
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("As senhas não coincidem", {
        description: "Certifique-se de que a nova senha e a confirmação sejam iguais.",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        toast.error("Erro ao alterar senha", { description: error.message });
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      resetarCampos();
      setAberto(false);
    } catch (err: any) {
      toast.error("Erro inesperado ao atualizar a senha", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviarEmailRedefinicao() {
    if (enviandoEmail) return;
    if (!emailUsuario) {
      toast.error("E-mail do usuário não identificado.");
      return;
    }

    try {
      setEnviandoEmail(true);
      const { error } = await supabase.auth.resetPasswordForEmail(emailUsuario, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) {
        toast.error("Erro ao enviar link", { description: error.message });
        return;
      }

      toast.success(`Enviamos um link de redefinição para o seu e-mail ${emailUsuario}`);
      setAberto(false);
    } catch (err: any) {
      toast.error("Erro ao solicitar link de redefinição", { description: err?.message });
    } finally {
      setEnviandoEmail(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        setAberto(open);
        if (!open) resetarCampos();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Alterar Senha
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" />
            Alterar Senha
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para sua conta de acesso no Base 01.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova Senha</Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={showPassword ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
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
            <Label htmlFor="confirmar-nova-senha">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="confirmar-nova-senha"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
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

          {senha.length > 0 && <PasswordRequirements password={senha} />}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              variant="brand"
              className="w-full gap-2"
              disabled={loading || !senhaValida || !coincidem}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando nova senha...
                </>
              ) : (
                "Salvar Nova Senha"
              )}
            </Button>

            {emailUsuario && (
              <div className="pt-2 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleEnviarEmailRedefinicao}
                  disabled={enviandoEmail || loading}
                  className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
                >
                  {enviandoEmail ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enviando e-mail...
                    </>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5" />
                      Prefere por e-mail? Enviar link para {emailUsuario}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
