import { Check } from "lucide-react";
import { validatePassword } from "@/lib/password-validator";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({ password, className = "" }: PasswordRequirementsProps) {
  const result = validatePassword(password);

  const rules = [
    { label: "Mínimo de 8 caracteres", valid: result.hasMinLength },
    { label: "Pelo menos uma letra maiúscula", valid: result.hasUpper },
    { label: "Pelo menos uma letra minúscula", valid: result.hasLower },
    { label: "Pelo menos um número", valid: result.hasNumber },
    { label: "Pelo menos um caractere especial (!@#$...)", valid: result.hasSpecial },
  ];

  return (
    <div className={`rounded-2xl border bg-muted/40 p-3.5 space-y-2 ${className}`}>
      <p className="text-xs font-medium text-foreground">Requisitos da senha:</p>
      <ul className="space-y-1.5 text-xs">
        {rules.map((rule, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 transition-colors ${
              rule.valid ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            {rule.valid ? (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 ml-1 mr-1" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
