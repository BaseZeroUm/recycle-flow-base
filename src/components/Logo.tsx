import iconAsset from "@/assets/base01-icon.png.asset.json";
import logoAsset from "@/assets/base01-logo-full.png.asset.json";

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return <img src={iconAsset.url} alt="Base 01" className={`${className} object-contain`} />;
}

export function LogoFull({ className = "" }: { className?: string }) {
  return <img src={logoAsset.url} alt="Base 01" className={`h-10 w-auto ${className}`} />;
}
