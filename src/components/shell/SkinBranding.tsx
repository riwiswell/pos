import { BUILT_IN_SKINS, type SkinId } from "@/domain/skins";
import { cn } from "@/lib/utils";

interface SkinBrandingProps {
  skin: SkinId;
  collapsed?: boolean;
  compact?: boolean;
}

export function SkinBranding({ skin, collapsed = false, compact = false }: SkinBrandingProps) {
  const definition = BUILT_IN_SKINS.find((item) => item.id === skin) ?? BUILT_IN_SKINS[0];
  return (
    <div
      className={cn("skin-branding", `skin-branding--${skin}`, collapsed && "skin-branding--collapsed", compact && "skin-branding--compact")}
      title={definition.brandTitle + " · " + definition.brandSubtitle}
      aria-label={definition.brandTitle + ", " + definition.brandSubtitle}
    >
      <span className="skin-branding__symbol" aria-hidden="true"><img src="/personal-os-logo.png" alt="" draggable={false} /></span>
      {!collapsed && (
        <span className="skin-branding__copy">
          <strong>{definition.brandTitle}</strong>
          {!compact && <small>{definition.brandSubtitle}</small>}
        </span>
      )}
    </div>
  );
}
