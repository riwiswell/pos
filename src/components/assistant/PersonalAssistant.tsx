import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const INTRO: ChatMessage = {
  role: "assistant",
  content: "Hola. Soy el asistente de Personal OS. Puedo consultar tus datos de los distintos módulos y ayudarte a relacionarlos. ¿Qué necesitas saber?",
};

export function PersonalAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, messages, busy, error]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = question.trim();
    if (!current || busy) return;

    setQuestion("");
    setError("");
    setMessages((previous) => [...previous, { role: "user", content: current }]);
    setBusy(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;
      if (sessionError || !session) {
        throw new Error("Tu sesión no está disponible. Inicia sesión de nuevo.");
      }

      const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ message: current, history }),
      });
      const result = (await response.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "No pude consultar Personal OS en este momento.");
      if (!result.answer) throw new Error("El asistente no devolvió una respuesta.");
      setMessages((previous) => [...previous, { role: "assistant", content: result.answer! }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo contactar al asistente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section role="dialog" aria-label="Asistente personal de Personal OS" aria-modal="false" className="fixed bottom-20 right-3 z-50 flex h-[min(72vh,620px)] w-[min(94vw,390px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:bottom-6 md:right-6">
          <header className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Asistente Personal OS</h2><p className="text-xs text-muted-foreground">Consulta tus módulos y relaciona tus datos</p></div>
            <Button type="button" size="icon" variant="ghost" aria-label="Cerrar asistente" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
            {messages.map((message, index) => <div key={index} className={cn("max-w-[91%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2.5 text-sm leading-5",message.role === "user" ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "mr-auto rounded-bl-md bg-muted text-foreground")}>{message.content}</div>)}
            {busy && <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Consultando tus datos…</div>}
            {error && <div className="mr-auto max-w-[95%] rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs" role="alert">{error}<button type="button" className="ml-1 font-semibold underline" onClick={() => setError("")}>Cerrar</button></div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-border px-3 pb-3 pt-2">
            <p className="mb-2 flex items-start gap-1.5 text-[10px] leading-4 text-muted-foreground"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" />Consulta datos privados de tus módulos para responder. No modifica tus registros.</p>
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pregúntale a tu Personal OS…" aria-label="Pregunta para el asistente" autoComplete="off" disabled={busy} maxLength={3500} />
              <Button type="submit" size="icon" aria-label="Enviar pregunta" disabled={busy || !question.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </section>
      )}
      <Button type="button" size="icon" aria-label={open ? "Cerrar asistente" : "Abrir asistente personal"} title="Asistente Personal OS" onClick={() => setOpen((value) => !value)} className="fixed bottom-20 right-3 z-50 h-12 w-12 rounded-full shadow-lg md:bottom-6 md:right-6">
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </>
  );
}
