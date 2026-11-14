import { BUILT_IN_SKINS, type SkinId } from "@/domain/skins";
import { cn } from "@/lib/utils";

interface SkinBrandingProps {
  skin: SkinId;
  collapsed?: boolean;
  compact?: boolean;
}

function SkinMark({ skin }: { skin: SkinId }) {
  if (skin === "lego") return <span className="skin-mark skin-mark--lego"><i /><i /><i /></span>;
  if (skin === "dc-comics") {
    return (
      <span className="skin-mark skin-mark--dc">
        <svg viewBox="0 0 64 36" aria-hidden="true">
          <path d="M3 8 12 3l8 7 7-6 5 8 5-8 7 6 8-7 9 5-5 18-11-8-8 8-5-9-5 9-8-8-11 8z" />
        </svg>
        <b>S</b>
      </span>
    );
  }
  if (skin === "marvel") return <span className="skin-mark skin-mark--marvel">M</span>;
  if (skin === "star-wars") return <span className="skin-mark skin-mark--starwars"><i>✦</i><b>✧</b></span>;
  if (skin === "football") return <span className="skin-mark skin-mark--football">⚽</span>;
  if (skin === "pixel") return <span className="skin-mark skin-mark--pixel">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</span>;
  if (skin === "winamp") return <span className="skin-mark skin-mark--retro">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</span>;
  return <span className="skin-mark skin-mark--classic">◈</span>;
}

export function SkinBranding({ skin, collapsed = false, compact = false }: SkinBrandingProps) {
  const definition = BUILT_IN_SKINS.find((item) => item.id === skin) ?? BUILT_IN_SKINS[0];
  return (
    <div
      className={cn("skin-branding", `skin-branding--${skin}`, collapsed && "skin-branding--collapsed", compact && "skin-branding--compact")}
      title={definition.brandTitle + " · " + definition.brandSubtitle}
      aria-label={definition.brandTitle + ", " + definition.brandSubtitle}
    >
      <span className="skin-branding__symbol" aria-hidden="true"><SkinMark skin={skin} /></span>
      {!collapsed && (
        <span className="skin-branding__copy">
          <strong>{definition.brandTitle}</strong>
          {!compact && <small>{definition.brandSubtitle}</small>}
        </span>
      )}
    </div>
  );
}
