import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { journalService } from "@/services/journal.service";
import type { JournalEntryInput } from "@/domain/journal";

export const journalKeys = {
  entries: ["journal_entries"] as const,
  lists: ["shopping_lists"] as const,
  items: ["shopping_items"] as const,
};

function onError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Ocurrió un error inesperado");
}

export function useJournalEntries() {
  return useQuery({ queryKey: journalKeys.entries, queryFn: journalService.listEntries, staleTime: 15_000 });
}

export function useJournalMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: journalKeys.entries });
  return {
    create: useMutation({
      mutationFn: (input: JournalEntryInput) => journalService.createEntry(input),
      onSuccess: () => { toast.success("Entrada guardada"); void invalidate(); },
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: JournalEntryInput }) =>
        journalService.updateEntry(id, input),
      onSuccess: () => { toast.success("Cambios guardados"); void invalidate(); },
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => journalService.deleteEntry(id),
      onSuccess: () => { toast.success("Entrada eliminada"); void invalidate(); },
      onError,
    }),
  };
}

export function useShoppingLists() {
  return useQuery({ queryKey: journalKeys.lists, queryFn: journalService.listLists, staleTime: 15_000 });
}

export function useShoppingItems() {
  return useQuery({ queryKey: journalKeys.items, queryFn: journalService.listItems, staleTime: 15_000 });
}

export function useShoppingMutations() {
  const qc = useQueryClient();
  const inv = () => {
    void qc.invalidateQueries({ queryKey: journalKeys.lists });
    void qc.invalidateQueries({ queryKey: journalKeys.items });
  };
  return {
    createList: useMutation({
      mutationFn: ({ name, position }: { name: string; position: number }) =>
        journalService.createList(name, position),
      onSuccess: inv,
      onError,
    }),
    renameList: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => journalService.renameList(id, name),
      onSuccess: inv,
      onError,
    }),
    deleteList: useMutation({
      mutationFn: (id: string) => journalService.deleteList(id),
      onSuccess: () => { toast.success("Lista eliminada"); inv(); },
      onError,
    }),
    addItem: useMutation({
      mutationFn: (v: { listId: string; name: string; position: number }) =>
        journalService.addItem(v.listId, v.name, v.position),
      onSuccess: inv,
      onError,
    }),
    updateItem: useMutation({
      mutationFn: ({ id, ...patch }: { id: string; name?: string; checked?: boolean }) =>
        journalService.updateItem(id, patch),
      onSuccess: inv,
      onError,
    }),
    deleteItem: useMutation({
      mutationFn: (id: string) => journalService.deleteItem(id),
      onSuccess: inv,
      onError,
    }),
  };
}