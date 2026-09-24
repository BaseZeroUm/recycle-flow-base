/**
 * Sanitiza mensagens de erro vindas do banco de dados (PostgreSQL / Supabase / PostgREST)
 * antes de exibi-las na interface ao usuário final via toast ou modal.
 * Impede o vazamento de nomes de tabelas, constraints, colunas, SQL e detalhes de infraestrutura.
 */
export function sanitizarMensagemErro(
  error: unknown,
  fallback = "Ocorreu um erro ao processar a operação. Tente novamente."
): string {
  if (!error) return fallback;

  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (error as { message?: unknown })?.message;

  if (!msg || typeof msg !== "string") return fallback;

  const lower = msg.toLowerCase();

  // 1. Violações de unicidade (unique constraint)
  if (
    lower.includes("duplicate key") ||
    lower.includes("unique constraint") ||
    lower.includes("23505")
  ) {
    return "Já existe um registro com estes dados informados.";
  }

  // 2. Violações de chave estrangeira (foreign key)
  if (
    lower.includes("foreign key") ||
    lower.includes("violates foreign key") ||
    lower.includes("23503")
  ) {
    return "Este registro não pode ser excluído ou alterado pois possui vínculos com outros dados no sistema.";
  }

  // 3. Violações de permissão e Row Level Security (RLS)
  if (
    lower.includes("violates row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("42501")
  ) {
    return "Acesso não autorizado para realizar esta operação.";
  }

  // 4. Violações de campos obrigatórios (not-null)
  if (
    lower.includes("violates not-null") ||
    lower.includes("null value in column") ||
    lower.includes("23502")
  ) {
    return "Por favor, preencha todos os campos obrigatórios.";
  }

  // 5. Violações de validação de campo (check constraint)
  if (lower.includes("check constraint") || lower.includes("23514")) {
    return "Os dados informados não atendem aos critérios de validação do sistema.";
  }

  // 6. Falhas de rede e conectividade
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Falha de conexão com o servidor. Verifique sua conexão com a internet.";
  }

  // 7. Expiração de sessão e tokens
  if (
    lower.includes("jwt expired") ||
    lower.includes("token expired") ||
    lower.includes("invalid refresh token")
  ) {
    return "Sua sessão expirou. Por favor, entre novamente na sua conta.";
  }

  // 8. Mensagens internas do PostgREST / PostgreSQL
  if (
    lower.includes("pgrst") ||
    lower.includes("relation") ||
    lower.includes("does not exist") ||
    lower.includes("column") ||
    lower.includes("syntax error") ||
    lower.includes("sqlstate")
  ) {
    return "Ocorreu uma inconsistência de comunicação com o servidor. Tente novamente mais tarde.";
  }

  // 9. Bloquear qualquer mensagem que contenha palavras-chave SQL
  if (
    lower.includes("select ") ||
    lower.includes("insert ") ||
    lower.includes("update ") ||
    lower.includes("delete ") ||
    lower.includes("table ") ||
    lower.includes("schema ")
  ) {
    return fallback;
  }

  return msg;
}
