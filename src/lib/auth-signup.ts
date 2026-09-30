export const CODIGO_ERRO_EMAIL_DUPLICADO = "EMAIL_ALREADY_EXISTS";
export const MSG_EMAIL_DUPLICADO = "Este e-mail já está em uso. Tente fazer login ou recupere sua senha.";

async function getClient(client?: any) {
  if (client) return client;
  const mod = await import("../integrations/supabase/client.ts");
  return mod.supabase;
}

/**
 * Normaliza um e-mail removendo espaços nas extremidades e convertendo para minúsculas.
 */
export function normalizarEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Validação básica e segura de formato de e-mail.
 */
export function validarEmailFormato(email: string): boolean {
  const norm = normalizarEmail(email);
  if (!norm || norm.length < 5 || norm.length > 255) return false;
  // Regex compatível com padrões web padrão
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm);
}

/**
 * Detecta se uma mensagem, código ou exceção refere-se a e-mail duplicado/já cadastrado.
 */
export function isErroEmailDuplicado(error: any, userIdentities?: any[] | null): boolean {
  // Caso Supabase retorne identities vazio (User Enumeration Protection ativada)
  if (Array.isArray(userIdentities) && userIdentities.length === 0) {
    return true;
  }

  if (!error) return false;

  const msg = String(error.message || error.error_description || error || "").toLowerCase();
  const code = String(error.code || error.status || "").toLowerCase();

  return (
    /(already.*registered|already.*in.*use|already.*exists|user_already_exists|email_already_exists|este e-mail j[aá])/i.test(
      msg
    ) ||
    msg.includes("duplicate key") ||
    msg.includes("unique constraint") ||
    msg.includes("profiles_email_lower_uidx") ||
    code === "23505" ||
    code === "409"
  );
}


/**
 * Consulta prévia no banco se o e-mail normalizado já está cadastrado.
 */
export async function verificarEmailExiste(
  email: string,
  client?: any
): Promise<boolean> {
  const norm = normalizarEmail(email);
  if (!norm || !validarEmailFormato(norm)) return false;

  const supabaseClient = await getClient(client);

  try {
    // 1. Tenta via RPC dedicada (com SECURITY DEFINER no banco)
    const { data, error } = await (supabaseClient.rpc as any)("verificar_email_cadastrado", {
      p_email: norm,
    });

    if (!error && typeof data === "boolean") {
      return data;
    }
  } catch (err) {
    console.warn("[verificarEmailExiste] RPC indisponível, seguindo fallback:", err);
  }

  // 2. Fallback resiliente: consulta na tabela pública profiles
  try {
    const { data: profiles, error: selectError } = await supabaseClient
      .from("profiles")
      .select("id")
      .ilike("email", norm)
      .limit(1);

    if (!selectError && profiles && profiles.length > 0) {
      return true;
    }
  } catch {}

  return false;
}

export interface CadastroPayload {
  email: string;
  password: string;
  nome: string;
  empresaNome: string;
  cnpj?: string;
  telefone?: string;
  categoria?: string;
}

export interface CadastroResultado {
  success: boolean;
  status: number;
  error?: string;
  message?: string;
  data?: any;
  session?: any;
}

/**
 * Executa o fluxo de registro com normalização, pré-checagem e captura de duplicidades.
 */
export async function processarCadastro(
  payload: CadastroPayload,
  client?: any
): Promise<CadastroResultado> {
  const emailNorm = normalizarEmail(payload.email);

  if (!emailNorm || !validarEmailFormato(emailNorm)) {
    return {
      success: false,
      status: 400,
      error: "INVALID_EMAIL",
      message: "Por favor, informe um endereço de e-mail válido.",
    };
  }

  const supabaseClient = await getClient(client);

  // 1. Checagem prévia de duplicidade de e-mail
  const jaExiste = await verificarEmailExiste(emailNorm, supabaseClient);
  if (jaExiste) {
    return {
      success: false,
      status: 409,
      error: CODIGO_ERRO_EMAIL_DUPLICADO,
      message: MSG_EMAIL_DUPLICADO,
    };
  }

  try {
    // 2. Executa signUp no Supabase com o e-mail estritamente normalizado
    const { data, error } = await supabaseClient.auth.signUp({
      email: emailNorm,
      password: payload.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: {
          nome: payload.nome.trim(),
          empresa_nome: payload.empresaNome.trim(),
          empresa_cnpj: (payload.cnpj ?? "").trim(),
          telefone: (payload.telefone ?? "").trim(),
          categoria: payload.categoria ?? "reciclagem",
        },
      },
    });

    if (error) {
      if (isErroEmailDuplicado(error)) {
        return {
          success: false,
          status: 409,
          error: CODIGO_ERRO_EMAIL_DUPLICADO,
          message: MSG_EMAIL_DUPLICADO,
        };
      }
      return {
        success: false,
        status: 400,
        error: "SIGNUP_FAILED",
        message: error.message || "Não foi possível criar a conta.",
      };
    }

    // 3. Caso Supabase retorne identities vazio (User Enumeration Protection)
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        success: false,
        status: 409,
        error: CODIGO_ERRO_EMAIL_DUPLICADO,
        message: MSG_EMAIL_DUPLICADO,
      };
    }

    return {
      success: true,
      status: 200,
      data,
      session: data?.session,
    };
  } catch (err: any) {
    if (isErroEmailDuplicado(err)) {
      return {
        success: false,
        status: 409,
        error: CODIGO_ERRO_EMAIL_DUPLICADO,
        message: MSG_EMAIL_DUPLICADO,
      };
    }
    return {
      success: false,
      status: 500,
      error: "SERVER_ERROR",
      message: err?.message || "Ocorreu um erro inesperado ao criar a conta.",
    };
  }
}
