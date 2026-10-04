import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      {message ?? "No se pudo cargar la información."}
    </div>
  );
}