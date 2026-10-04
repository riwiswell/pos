import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { financeService, type TransactionFilters } from "@/services/finance.service";
import type { AccountInput, CategoryInput, FinanceSettings, TransactionInput } from "@/domain/finance";

export const financeKeys = {
  accounts: ["finance_accounts"] as const,
  categories: ["finance_categories"] as const,
  settings: ["finance_settings"] as const,
  balances: ["finance_balances"] as const,
  transactions: (filters: TransactionFilters) => ["finance_transactions", filters] as const,
  allTransactions: ["finance_transactions"] as const,
};

function onError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado";
  toast.error(message);
}

export function useAccounts() {
  return useQuery({ queryKey: financeKeys.accounts, queryFn: financeService.ensureDefaultAccount });
}

export function useFinanceCategories() {
  return useQuery({ queryKey: financeKeys.categories, queryFn: financeService.listCategories });
}

export function useFinanceSettings() {
  return useQuery({ queryKey: financeKeys.settings, queryFn: financeService.getSettings });
}

export function useBalanceRows() {
  return useQuery({ queryKey: financeKeys.balances, queryFn: financeService.listBalanceRows });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: financeKeys.transactions(filters),
    queryFn: () => financeService.listTransactions(filters),
  });
}

/** Every write refreshes the derived data: balances, totals, charts, tithe. */
export function useFinanceMutations() {
  const qc = useQueryClient();

  const refreshDerived = () => {
    void qc.invalidateQueries({ queryKey: financeKeys.allTransactions });
    void qc.invalidateQueries({ queryKey: financeKeys.balances });
  };

  const createAccount = useMutation({
    mutationFn: (vars: { input: AccountInput; position: number }) =>
      financeService.createAccount(vars.input, vars.position),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.accounts });
      toast.success("Cuenta creada");
    },
    onError,
  });

  const updateAccount = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<AccountInput & { position: number }> }) =>
      financeService.updateAccount(vars.id, vars.patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.accounts });
      refreshDerived();
    },
    onError,
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => financeService.deleteAccount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.accounts });
      refreshDerived();
      toast.success("Cuenta eliminada");
    },
    onError,
  });

  const reorderAccounts = useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) =>
      financeService.reorderAccounts(ordered),
    onSuccess: () => void qc.invalidateQueries({ queryKey: financeKeys.accounts }),
    onError,
  });

  const createCategory = useMutation({
    mutationFn: (vars: { input: CategoryInput; position: number }) =>
      financeService.createCategory(vars.input, vars.position),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: financeKeys.categories });
      if (result.reused) toast.info(`Ya tenías la categoría "${result.category.name}"; la reutilicé.`);
      else toast.success("Categoría creada");
    },
    onError,
  });


  const updateCategory = useMutation({
    mutationFn: (vars: {
      id: string;
      patch: Partial<CategoryInput & { position: number; active: boolean }>;
    }) => financeService.updateCategory(vars.id, vars.patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.categories });
      refreshDerived();
    },
    onError,
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => financeService.deleteCategory(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.categories });
      refreshDerived();
      toast.success("Categoría eliminada");
    },
    onError,
  });

  const reorderCategories = useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) =>
      financeService.reorderCategories(ordered),
    onSuccess: () => void qc.invalidateQueries({ queryKey: financeKeys.categories }),
    onError,
  });

  const createTransaction = useMutation({
    mutationFn: (input: TransactionInput) => financeService.createTransaction(input),
    onSuccess: () => {
      refreshDerived();
      toast.success("Movimiento registrado");
    },
    onError,
  });

  const updateTransaction = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<TransactionInput> }) =>
      financeService.updateTransaction(vars.id, vars.patch),
    onSuccess: () => {
      refreshDerived();
      toast.success("Movimiento actualizado");
    },
    onError,
  });

  const deleteTransaction = useMutation({
    mutationFn: (id: string) => financeService.deleteTransaction(id),
    onSuccess: () => {
      refreshDerived();
      toast.success("Movimiento eliminado");
    },
    onError,
  });

  const updateSettings = useMutation({
    mutationFn: (
      patch: Partial<
        Pick<
          FinanceSettings,
          "tithe_percent" | "tithe_basis" | "tithe_custom_note" | "show_money_in_dashboard"
        >
      >,
    ) => financeService.updateSettings(patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: financeKeys.settings }),
    onError,
  });

  return {
    createAccount,
    updateAccount,
    deleteAccount,
    reorderAccounts,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    updateSettings,
  };
}