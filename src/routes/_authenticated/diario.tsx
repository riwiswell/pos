import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { JournalEntryDialog } from "@/components/journal/JournalEntryDialog";
import { ShoppingLists } from "@/components/journal/ShoppingLists";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useJournalEntries, useJournalMutations } from "@/hooks/use-journal";
import { formatDayLabel, offsetFromToday } from "@/lib/date";
import {
  JOURNAL_META,
  JOURNAL_TYPES,
  compareEntries,
  entryMatches,
  entrySnippet,
  type JournalEntry,
  type JournalType,
} from "@/domain/journal";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({
    meta: [
      { title: "Diario — Personal OS" },
      { name: "description", content: "Tu diario personal: sueños, pensamientos, gratitud, ideas, recuerdos y listas de compras." },
      { property: "og:title", content: "Diario — Personal OS" },
      { property: "og:description", content: "Captura tu día: sueños, pensamientos, gratitud, ideas y recuerdos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiarioPage,
});

type Filter = "all" | JournalType | "shopping";

function dateLabel(e: JournalEntry) {
  const off = offsetFromToday(e.entry_date);
  const day = off === 0 ? "Hoy" : off === -1 ? "Ayer" : formatDayLabel(e.entry_date);
  return e.entry_time ? `${day} · ${e.entry_time.slice(0, 5)}` : day;
}

function DiarioPage() {
  const { date } = useGlobalDate();
  const entriesQ = useJournalEntries();
  const { remove } = useJournalMutations();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [onlyDate, setOnlyDate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [toDelete, setToDelete] = useState<JournalEntry | null>(null);

  const entries = useMemo(
    () =>
      (entriesQ.data ?? [])
        .filter((e) => filter === "all" || e.type === filter)
        .filter((e) => !onlyDate || e.entry_date === date)
        .filter((e) => entryMatches(e, query))
        .sort(compareEntries),
    [entriesQ.data, filter, onlyDate, date, query],
  );

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "Todo" },
    ...JOURNAL_TYPES.map((t) => ({ key: t as Filter, label: `${JOURNAL_META[t].emoji} ${JOURNAL_META[t].plural}` })),
    { key: "shopping", label: "🛒 Compras" },
  ];

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Diario</h1>
          <p className="text-sm text-muted-foreground">Tu espacio para capturar la vida cotidiana</p>
        </div>
        {filter !== "shopping" && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="hidden sm:inline-flex">
            <Plus className="mr-1 h-4 w-4" /> Nueva entrada
          </Button>
        )}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${filter === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filter === "shopping" ? (
        <ShoppingLists />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en el Diario" className="pl-8" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={onlyDate} onCheckedChange={setOnlyDate} /> Solo la fecha seleccionada
            </label>
          </div>
          {onlyDate && <GlobalDateHeader />}

          {entriesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : entries.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              {query || onlyDate || filter !== "all" ? "No hay entradas con estos filtros." : "Tu Diario está vacío. Escribe tu primera entrada."}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {entries.map((e) => {
                const meta = JOURNAL_META[e.type];
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setEditing(e); setDialogOpen(true); }}
                    className="glass rounded-2xl border-l-4 p-4 text-left transition hover:ring-2 hover:ring-primary"
                    style={{ borderLeftColor: meta.color }}
                  >
                    <p className="text-xs font-medium text-muted-foreground">{meta.emoji} {meta.label}{e.mood ? ` · ${e.mood}` : ""}{e.photos.length ? ` · 📷 ${e.photos.length}` : ""}</p>
                    {e.title && <p className="mt-1 font-semibold">{e.title}</p>}
                    <p className="mt-1 line-clamp-3 text-sm">{entrySnippet(e)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{dateLabel(e)}</p>
                  </button>
                );
              })}
            </div>
          )}

          <Button
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden"
            aria-label="Nueva entrada"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </>
      )}

      <JournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        defaultDate={date}
        onDelete={(e) => setToDelete(e)}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar entrada?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSuccess: () => setDialogOpen(false) });
          setToDelete(null);
        }}
      />
    </div>
  );
}