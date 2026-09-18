export interface PasswordValidationResult {
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

/**
 * Valida os requisitos rigorosos de complexidade de senha:
 * - Mínimo de 8 caracteres
 * - Pelo menos 1 letra maiúscula ([A-Z])
 * - Pelo menos 1 letra minúscula ([a-z])
 * - Pelo menos 1 número ([0-9])
 * - Pelo menos 1 caractere especial ([^A-Za-z0-9])
 */
export function validatePassword(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return {
    hasMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid: hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial,
  };
}

export const PASSWORD_RULES = [
  { id: "hasMinLength", label: "Mínimo de 8 caracteres" },
  { id: "hasUpper", label: "Pelo menos uma letra maiúscula" },
  { id: "hasLower", label: "Pelo menos uma letra minúscula" },
  { id: "hasNumber", label: "Pelo menos um número" },
  { id: "hasSpecial", label: "Pelo menos um caractere especial (!@#$...)" },
] as const;
