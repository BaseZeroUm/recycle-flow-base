import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias do módulo Reciclagem: mantém as rotas existentes (/painel, /estoque...) intactas.
export const Route = createFileRoute("/_authenticated/reciclagem")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
});
