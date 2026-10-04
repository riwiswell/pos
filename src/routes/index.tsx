import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Personal OS — Tu sistema operativo personal" },
      {
        name: "description",
        content:
          "Personal OS reúne tus hábitos y tu día a día en un solo sistema, con registro rápido y datos reales.",
      },
      { property: "og:title", content: "Personal OS — Tu sistema operativo personal" },
      {
        property: "og:description",
        content:
          "Personal OS reúne tus hábitos y tu día a día en un solo sistema, con registro rápido y datos reales.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/inicio", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground">PERSONAL OS</p>
      <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
        Un solo sistema para tu vida, no una colección de apps.
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Registro rápido, historial real por fecha y una base preparada para crecer dominio a
        dominio.
      </p>
      <Button className="mt-8" onClick={() => void navigate({ to: "/auth" })}>
        Entrar
      </Button>
    </div>
  );
}