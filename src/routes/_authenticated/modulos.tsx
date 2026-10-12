import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy route retained so saved links do not break.
 * The old all-domains CRUD screen duplicated the canonical pages and included
 * a client-side XP writer that is no longer part of the security model.
 */
export const Route = createFileRoute("/_authenticated/modulos")({
  beforeLoad: () => {
    throw redirect({ to: "/inicio" });
  },
});
