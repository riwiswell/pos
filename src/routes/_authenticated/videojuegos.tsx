import { createFileRoute } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { HelpTip } from "@/components/common/HelpTip";
import { VideoGamesLibrary } from "./aprendizaje";

export const Route = createFileRoute("/_authenticated/videojuegos")({ component: VideoGamesPage });

function VideoGamesPage() {
  return (
    <div className="space-y-5 pb-24">
      <GlobalDateHeader />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Gamepad2 className="h-5 w-5" /> Videojuegos <HelpTip helpKey="learning" /></h1>
        <p className="text-sm text-muted-foreground">Tu biblioteca, tiempo jugado, plataforma, género y objetivos.</p>
      </div>
      <VideoGamesLibrary />
    </div>
  );
}
