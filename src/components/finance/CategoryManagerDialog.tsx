import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CategoryDialog } from "@/components/finance/CategoryDialog";
import { getIcon } from "@/lib/finance-icons";
import { cn } from "@/lib/utils";
import { useFinanceMutations } from "@/hooks/use-finance";
import { categoryAppliesTo } from "@/domain/finance";
import type { CategoryKind, FinanceCategory } from "@/domain/finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
}

/** Full CRUD for finance categories, reachable from the Finanzas screen. */
export function CategoryManagerDialog({ open, onOpenChange, categories }: Props) {
  const mutations = useFinanceMutations();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [editor, setEditor] = useState<{ open: boolean; category: FinanceCategory | null }>({
    open: false,
    category: null,
  });
  const [deleting, setDeleting] = useState<FinanceCategory | null>(null);

  const list = categories.filter((category) =>
    kind === "expense" || kind === "income" ? categoryAppliesTo(category.kind, kind) : true,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Categorías</DialogTitle>
            <DialogDescription>
              Crea, edita o elimina las categorías que usas en tus movimientos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {(["expense", "income"] as CategoryKind[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  kind === value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {value === "expense" ? "Gastos" : "Ingresos"}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {list.length === 0 && (
              <li className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Aún no tienes categorías de {kind === "expense" ? "gasto" : "ingreso"}.
              </li>
            )}
            {list.map((category) => {
              const Icon = getIcon(category.icon);
              return (
                <li
                  key={category.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${category.color}22` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: category.color }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                  {category.kind === "both" && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      Ambos
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${category.name}`}
                    className="h-8 w-8"
                    onClick={() => setEditor({ open: true, category })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Eliminar ${category.name}`}
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleting(category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>

          <Button
            variant="outline"
            className="w-full gap-1 border-dashed"
            onClick={() => setEditor({ open: true, category: null })}
          >
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
        </DialogContent>
      </Dialog>

      <CategoryDialog
        open={editor.open}
        onOpenChange={(value) => setEditor((prev) => ({ ...prev, open: value }))}
        category={editor.category}
        defaultKind={kind}
        pending={mutations.createCategory.isPending || mutations.updateCategory.isPending}
        onSubmit={async (input) => {
          if (editor.category) {
            await mutations.updateCategory.mutateAsync({ id: editor.category.id, patch: input });
          } else {
            await mutations.createCategory.mutateAsync({ input, position: categories.length });
          }
          setEditor({ open: false, category: null });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        title={`¿Eliminar la categoría "${deleting?.name ?? ""}"?`}
        description="Los movimientos que la usaban quedarán sin categoría."
        onConfirm={async () => {
          if (deleting) await mutations.deleteCategory.mutateAsync(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}