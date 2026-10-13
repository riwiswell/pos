import { createFileRoute, redirect } from "@tanstack/react-router";

// Las alarmas se configuran en el contexto que las necesita (Medicamentos,
// Citas y otros eventos). Esta ruta se conserva solo para enlaces antiguos.
export const Route = createFileRoute("/_authenticated/alarmas")({
  beforeLoad: () => {
    throw redirect({ to: "/inicio" });
  },
  component: () => null,
});
