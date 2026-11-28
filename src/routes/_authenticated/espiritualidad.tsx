import { createFileRoute } from "@tanstack/react-router";
import { SpiritualityHubPage } from "@/components/common/SpiritualityHubPage";

export const Route = createFileRoute("/_authenticated/espiritualidad")({
  component: SpiritualityHubPage,
});
