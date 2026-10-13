import { createFileRoute, redirect } from "@tanstack/react-router";

// IA Personal now lives in the discreet global assistant button, not as a standalone module.
export const Route = createFileRoute("/_authenticated/ia")({
  beforeLoad: () => {
    throw redirect({ to: "/inicio" });
  },
  component: () => null,
});
