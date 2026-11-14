import { BUILT_IN_SKINS, type SkinId } from "@/domain/skins";
import { cn } from "@/lib/utils";

interface SkinBrandingProps {
  skin: SkinId;
  collapsed?: boolean;
  compact?: boolean;
  sidebar?: boolean;
}

export function SkinBranding({
  skin,
  collapsed = false,
  compact = false,
  sidebar = false,
}: SkinBrandingProps) {
  const definition = BUILT_IN_SKINS.find((item) => item.id === skin) ?? BUILT_IN_SKINS[0];
  const themeMark =
    skin === "pokemon" ? (
      <span className="skin-mark skin-mark--f1" aria-label="Fórmula 1">F1</span>
    ) : skin === "classic" ? null : (
      <span className={cn("skin-branding__theme-mark", `skin-branding__theme-mark--${skin}`)} aria-hidden="true">
        {definition.glyph}
      </span>
    );

  return (
    <div
      className={cn(
        "skin-branding",
        `skin-branding--${skin}`,
        sidebar && "skin-branding--sidebar",
        collapsed && "skin-branding--collapsed",
        compact && "skin-branding--compact",
      )}
      title={definition.brandTitle + " · " + definition.brandSubtitle}
      aria-label={definition.brandTitle + ", " + definition.brandSubtitle}
    >
      <span className="skin-branding__symbol skin-branding__symbol--personal" aria-hidden="true">
        <img src="/personal-os-logo.png" alt="" draggable={false} />
      </span>
      <div className="skin-branding__identity">
        {themeMark}
        {!collapsed && (
          <span className="skin-branding__copy">
            <strong>{definition.brandTitle}</strong>
            {!compact && <small>{definition.brandSubtitle}</small>}
          </span>
        )}
      </div>
    </div>
  );
}
