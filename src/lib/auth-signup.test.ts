import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarEmail,
  validarEmailFormato,
  isErroEmailDuplicado,
  processarCadastro,
  CODIGO_ERRO_EMAIL_DUPLICADO,
  MSG_EMAIL_DUPLICADO,
} from "./auth-signup.ts";

test("normalizarEmail deve converter para minúsculas e remover espaços", () => {
  assert.equal(normalizarEmail("Exemplo@Email.com"), "exemplo@email.com");
  assert.equal(normalizarEmail("  exemplo@email.com  "), "exemplo@email.com");
  assert.equal(normalizarEmail("  USUARIO.TESTE@EMPRESA.COM.BR  "), "usuario.teste@empresa.com.br");
  assert.equal(normalizarEmail(null as any), "");
  assert.equal(normalizarEmail(undefined as any), "");
});

test("validarEmailFormato deve checar integridade do e-mail", () => {
  assert.equal(validarEmailFormato("teste@empresa.com"), true);
  assert.equal(validarEmailFormato("usuario+tag@dominio.com.br"), true);
  assert.equal(validarEmailFormato(""), false);
  assert.equal(validarEmailFormato("invalido"), false);
  assert.equal(validarEmailFormato("sem-arroba.com"), false);
  assert.equal(validarEmailFormato("@sem-usuario.com"), false);
});

test("isErroEmailDuplicado deve detectar corretamente erros de e-mail já existente", () => {
  // Mensagens do Supabase Gotrue
  assert.equal(isErroEmailDuplicado({ message: "User already registered" }), true);
  assert.equal(isErroEmailDuplicado({ message: "user already exists" }), true);
  assert.equal(isErroEmailDuplicado({ message: "A user with this email address has already been registered" }), true);

  // Erro do Postgres (unique constraint violation 23505)
  assert.equal(isErroEmailDuplicado({ code: "23505", message: "duplicate key value violates unique constraint" }), true);
  assert.equal(isErroEmailDuplicado({ message: "duplicate key value violates unique constraint 'profiles_email_lower_uidx'" }), true);

  // Exceção do trigger de banco
  assert.equal(isErroEmailDuplicado({ message: "EMAIL_ALREADY_EXISTS: Este e-mail já está cadastrado." }), true);

  // Proteção contra enumeração (identities vazio no retorno do signUp)
  assert.equal(isErroEmailDuplicado(null, []), true);

  // Erros não relacionados
  assert.equal(isErroEmailDuplicado({ message: "Password should be at least 6 characters" }), false);
  assert.equal(isErroEmailDuplicado(null, [{ id: "123" }]), false);
});

test("processarCadastro deve bloquear e-mail inválido com status 400", async () => {
  const mockClient: any = {
    rpc: async () => ({ data: false, error: null }),
    auth: { signUp: async () => ({ data: null, error: null }) },
  };

  const resultado = await processarCadastro(
    {
      email: "email-invalido",
      password: "Password123!",
      nome: "Fulano",
      empresaNome: "Empresa Teste",
    },
    mockClient
  );

  assert.equal(resultado.success, false);
  assert.equal(resultado.status, 400);
  assert.equal(resultado.error, "INVALID_EMAIL");
});

test("processarCadastro deve abortar e retornar 409 quando o e-mail já existir na pré-checagem", async () => {
  const mockClient: any = {
    rpc: async (func: string, params: { p_email: string }) => {
      // Simula que 'jaexiste@empresa.com' já está cadastrado
      if (params.p_email === "jaexiste@empresa.com") {
        return { data: true, error: null };
      }
      return { data: false, error: null };
    },
    auth: {
      signUp: async () => {
        throw new Error("Não deve chamar signUp se já existir previamente");
      },
    },
  };

  // Testa com variações de maiúsculas e espaços
  const resultado = await processarCadastro(
    {
      email: "  JaExiste@Empresa.COM  ",
      password: "Password123!",
      nome: "Fulano",
      empresaNome: "Empresa Teste",
    },
    mockClient
  );

  assert.equal(resultado.success, false);
  assert.equal(resultado.status, 409);
  assert.equal(resultado.error, CODIGO_ERRO_EMAIL_DUPLICADO);
  assert.equal(resultado.message, MSG_EMAIL_DUPLICADO);
});

test("processarCadastro deve capturar erro de signUp e retornar 409 se o Supabase indicar duplicidade", async () => {
  const mockClient: any = {
    rpc: async () => ({ data: false, error: null }),
    auth: {
      signUp: async () => ({
        data: null,
        error: { message: "User already registered", status: 400 },
      }),
    },
  };

  const resultado = await processarCadastro(
    {
      email: "teste@empresa.com",
      password: "Password123!",
      nome: "Fulano",
      empresaNome: "Empresa Teste",
    },
    mockClient
  );

  assert.equal(resultado.success, false);
  assert.equal(resultado.status, 409);
  assert.equal(resultado.error, CODIGO_ERRO_EMAIL_DUPLICADO);
  assert.equal(resultado.message, MSG_EMAIL_DUPLICADO);
});

test("processarCadastro deve detectar identities vazio (User Enumeration Protection) e retornar 409", async () => {
  const mockClient: any = {
    rpc: async () => ({ data: false, error: null }),
    auth: {
      signUp: async () => ({
        data: {
          user: {
            id: "user-123",
            email: "teste@empresa.com",
            identities: [], // identities vazio = já existe conta
          },
          session: null,
        },
        error: null,
      }),
    },
  };

  const resultado = await processarCadastro(
    {
      email: "teste@empresa.com",
      password: "Password123!",
      nome: "Fulano",
      empresaNome: "Empresa Teste",
    },
    mockClient
  );

  assert.equal(resultado.success, false);
  assert.equal(resultado.status, 409);
  assert.equal(resultado.error, CODIGO_ERRO_EMAIL_DUPLICADO);
  assert.equal(resultado.message, MSG_EMAIL_DUPLICADO);
});

test("processarCadastro deve registrar com sucesso quando for e-mail novo e normalizado", async () => {
  let emailEnviadoAoAuth = "";
  const mockClient: any = {
    rpc: async () => ({ data: false, error: null }),
    auth: {
      signUp: async (options: any) => {
        emailEnviadoAoAuth = options.email;
        return {
          data: {
            user: { id: "novo-user-123", email: options.email, identities: [{ id: "identity-1" }] },
            session: { access_token: "fake-jwt-token" },
          },
          error: null,
        };
      },
    },
  };

  const resultado = await processarCadastro(
    {
      email: "  NovoUsuario@Empresa.Com  ",
      password: "Password123!",
      nome: "Novo Usuário",
      empresaNome: "Empresa Sustentável",
    },
    mockClient
  );

  assert.equal(resultado.success, true);
  assert.equal(resultado.status, 200);
  assert.equal(emailEnviadoAoAuth, "novousuario@empresa.com");
  assert.ok(resultado.data?.user?.id);
  assert.ok(resultado.session?.access_token);
});
