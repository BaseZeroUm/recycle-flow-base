import iconAsset from "@/assets/base01-icon.png.asset.json";

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return <img src={iconAsset.url} alt="Base 01" className={`${className} object-contain`} />;
}

export function LogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon className="h-9 w-9" />
      <div className="leading-none">
        <div className="text-lg font-extrabold tracking-tight">Base 01</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Decide Beyond
        </div>
      </div>
    </div>
  );
}
