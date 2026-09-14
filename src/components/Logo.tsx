export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return <img src="/base01-icon.png" alt="Base 01" className={`${className} object-contain`} />;
}

export function LogoFull({ className = "" }: { className?: string }) {
  return <img src="/base01-logo-full.png" alt="Base 01" className={`h-10 w-auto ${className}`} />;
}
