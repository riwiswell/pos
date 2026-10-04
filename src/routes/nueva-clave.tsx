import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/nueva-clave")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Personal OS" },
      { name: "description", content: "Define una nueva contraseña para tu cuenta de Personal OS." },
      { property: "og:title", content: "Nueva contraseña — Personal OS" },
      {
        property: "og:description",
        content: "Define una nueva contraseña para tu cuenta de Personal OS.",
      },
    ],
  }),
  component: NewPasswordPage,
});

function NewPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      void navigate({ to: "/inicio", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass w-full max-w-sm space-y-4 rounded-2xl p-5">
        <h1 className="text-lg font-semibold">Nueva contraseña</h1>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Contraseña</Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          Guardar
        </Button>
      </form>
    </div>
  );
}