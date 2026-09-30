import { createFileRoute } from "@tanstack/react-router";
import {
  normalizarEmail,
  validarEmailFormato,
  CODIGO_ERRO_EMAIL_DUPLICADO,
  MSG_EMAIL_DUPLICADO,
  verificarEmailExiste,
} from "@/lib/auth-signup";

export const Route = createFileRoute("/api/verificar-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const emailRaw = String(body?.email ?? "");
          const email = normalizarEmail(emailRaw);

          if (!validarEmailFormato(email)) {
            return new Response(
              JSON.stringify({
                error: "INVALID_EMAIL",
                message: "E-mail inválido ou mal formatado.",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          const existe = await verificarEmailExiste(email);

          if (existe) {
            return new Response(
              JSON.stringify({
                error: CODIGO_ERRO_EMAIL_DUPLICADO,
                message: MSG_EMAIL_DUPLICADO,
              }),
              {
                status: 409,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify({
              disponivel: true,
              email,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              error: "SERVER_ERROR",
              message: err?.message || "Erro interno ao validar e-mail.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
