import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { HelpTip } from "@/components/common/HelpTip";
import { useShoppingItems, useShoppingLists, useShoppingMutations } from "@/hooks/use-journal";
import type { ShoppingItem, ShoppingList } from "@/domain/journal";

/** Checkable shopping lists. Lives inside Diario; never becomes Planeador tasks. */
export function ShoppingLists({ query = "" }: { query?: string }) {
  const lists = useShoppingLists();
  const items = useShoppingItems();
  const m = useShoppingMutations();
  const [newList, setNewList] = useState("");
  const [toDelete, setToDelete] = useState<ShoppingList | null>(null);

  const allLists = lists.data ?? [];
  const allItems = items.data ?? [];
  const normalizedQuery = normalizeShoppingSearch(query);
  const filteredLists = allLists
    .map((list) => {
      const listMatches = normalizedQuery.length > 0 && normalizeShoppingSearch(list.name).includes(normalizedQuery);
      const listItems = allItems.filter((item) => item.list_id === list.id);
      const visibleItems = !normalizedQuery || listMatches
        ? listItems
        : listItems.filter((item) =>
            normalizeShoppingSearch([item.name, item.note ?? ""].join(" ")).includes(normalizedQuery),
          );
      return { list, listItems, visibleItems, listMatches };
    })
    .filter((entry) => !normalizedQuery || entry.listMatches || entry.visibleItems.length > 0);

  function addList() {
    if (!newList.trim()) return;
    m.createList.mutate({ name: newList, position: allLists.length }, { onSuccess: () => setNewList("") });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={newList}
          onChange={(e) => setNewList(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addList()}
          placeholder="Nueva lista (ej. Mercado)"
        />
        <Button onClick={addList} disabled={!newList.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Crear
        </Button>
        <HelpTip helpKey="life.shopping" text="Las listas de compras son solo para marcar productos. No crean tareas en el Planeador." />
      </div>

      {items.isError || lists.isError ? (
        <p className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive" role="alert">
          No se pudieron cargar las compras. Revisa la conexión e inténtalo de nuevo.
        </p>
      ) : lists.isLoading || items.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : allLists.length === 0 ? (
        <p className="glass rounded-2xl p-4 text-sm text-muted-foreground">Aún no tienes listas de compras.</p>
      ) : filteredLists.length === 0 ? (
        <p className="glass rounded-2xl p-4 text-sm text-muted-foreground" role="status">
          No hay listas ni productos que coincidan con «{query.trim()}».
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredLists.map(({ list, visibleItems, listItems }) => (
            <ListCard
              key={list.id}
              list={list}
              items={visibleItems}
              totalItems={listItems.length}
              isFiltered={normalizedQuery.length > 0 && visibleItems.length !== listItems.length}
              onDelete={() => setToDelete(list)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar lista?"
        description="Se eliminarán también sus productos."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (toDelete) m.deleteList.mutate(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function ListCard({
  list,
  items,
  totalItems,
  isFiltered,
  onDelete,
}: {
  list: ShoppingList;
  items: ShoppingItem[];
  totalItems: number;
  isFiltered: boolean;
  onDelete: () => void;
}) {
  const m = useShoppingMutations();
  const [name, setName] = useState("");
  const done = items.filter((i) => i.checked).length;

  function add() {
    if (!name.trim()) return;
    m.addItem.mutate({ listId: list.id, name, position: items.length }, { onSuccess: () => setName("") });
  }

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">🛒 {list.name}</h3>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{isFiltered ? items.length + " encontrados" : done + "/" + totalItems}</span>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Eliminar lista">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            <Checkbox
              checked={it.checked}
              onCheckedChange={(c) => m.updateItem.mutate({ id: it.id, checked: c === true })}
              aria-label={it.name}
            />
            <span className={`flex-1 text-sm ${it.checked ? "text-muted-foreground line-through" : ""}`}>{it.name}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => m.deleteItem.mutate(it.id)} aria-label="Quitar producto">
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Agregar producto"
          className="h-9"
        />
        <Button size="sm" onClick={add} disabled={!name.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
function normalizeShoppingSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}
