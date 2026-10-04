import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Mode = "signin" | "signup" | "reset";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceder — Personal OS" },
      {
        name: "description",
        content: "Inicia sesión en Personal OS para gestionar tus hábitos y tu día a día.",
      },
      { property: "og:title", content: "Acceder — Personal OS" },
      {
        property: "og:description",
        content: "Inicia sesión en Personal OS para gestionar tus hábitos y tu día a día.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/inicio", replace: true });
  }, [loading, session, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/inicio", replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/inicio`,
            data: { full_name: fullName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Si se requiere confirmación, revisa tu correo.");
        const { data } = await supabase.auth.getSession();
        if (data.session) void navigate({ to: "/inicio", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/nueva-clave`,
        });
        if (error) throw error;
        toast.success("Te enviamos un enlace para restablecer tu contraseña.");
        setMode("signin");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar la operación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs font-semibold tracking-[0.22em] text-muted-foreground">
          PERSONAL OS
        </p>
        <h1 className="mt-3 text-center text-2xl font-semibold">
          {mode === "signin" && "Inicia sesión"}
          {mode === "signup" && "Crea tu cuenta"}
          {mode === "reset" && "Recupera tu contraseña"}
        </h1>

        <form onSubmit={handleSubmit} className="glass mt-6 space-y-4 rounded-2xl p-5">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nombre</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {mode !== "reset" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" && "Entrar"}
            {mode === "signup" && "Crear cuenta"}
            {mode === "reset" && "Enviar enlace"}
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {mode !== "signin" && (
            <button type="button" className="hover:text-foreground" onClick={() => setMode("signin")}>
              Ya tengo cuenta
            </button>
          )}
          {mode !== "signup" && (
            <button type="button" className="hover:text-foreground" onClick={() => setMode("signup")}>
              Crear una cuenta nueva
            </button>
          )}
          {mode !== "reset" && (
            <button type="button" className="hover:text-foreground" onClick={() => setMode("reset")}>
              Olvidé mi contraseña
            </button>
          )}
        </div>
      </div>
    </div>
  );
}