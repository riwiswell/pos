import { useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Plus, Search, Settings2, Tags } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { TransactionDetail } from "@/components/finance/TransactionDetail";
import { TransactionList } from "@/components/finance/TransactionList";
import { AccountDialog } from "@/components/finance/AccountDialog";
import { CategoryManagerDialog } from "@/components/finance/CategoryManagerDialog";
import { TitheSettingsDialog } from "@/components/finance/TitheSettingsDialog";
import { CategoryDonut, DailyBars } from "@/components/finance/FinanceCharts";
import { FinanceAdvancedPanel } from "@/components/finance/FinanceAdvancedPanel";
import { useGlobalDate } from "@/hooks/use-global-date";
import {
  useAccounts,
  useBalanceRows,
  useFinanceCategories,
  useFinanceMutations,
  useFinanceSettings,
  useTransactions,
} from "@/hooks/use-finance";
import {
  accountBalances,
  balanceOf,
  byCategory,
  dailySeries,
  sumBy,
  titheLedger,
  totalBalance,
} from "@/lib/finance-math";
import { buildPeriod, formatPeriod, PERIOD_LABEL, type PeriodKind } from "@/lib/period";
import { formatMoney } from "@/lib/money";
import { getIcon } from "@/lib/finance-icons";
import { cn } from "@/lib/utils";
import { categoryAppliesTo } from "@/domain/finance";
import type { FinanceAccount, FinanceCategory, FinanceTransaction, TransactionType } from "@/domain/finance";
import { HelpTip } from "@/components/common/HelpTip";

export const Route = createFileRoute("/_authenticated/finanzas")({
  head: () => ({
    meta: [
      { title: "Finanzas — Personal OS" },
      {
        name: "description",
        content: "Registra ingresos y gastos y revísalos por categorías, historial y período.",
      },
      { property: "og:title", content: "Finanzas — Personal OS" },
      {
        property: "og:description",
        content: "Registra ingresos y gastos y revísalos por categorías, historial y período.",
      },
    ],
  }),
  component: FinancePage,
});

type FinanceTab = "resumen" | "gastos" | "ingresos" | "historial";
const UNCATEGORIZED = "__uncategorized__";

function CategoryExplorer({
  type,
  transactions,
  categories,
  selectedId,
  onSelect,
  accounts,
  hideAmounts,
  onOpen,
}: {
  type: "expense" | "income";
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  accounts: FinanceAccount[];
  hideAmounts: boolean;
  onOpen: (tx: FinanceTransaction) => void;
}) {
  const rows = useMemo(() => {
    const applicable = categories.filter(
      (category) => category.active && categoryAppliesTo(category.kind, type),
    );
    const categoryRows = applicable.map((category) => {
      const items = transactions.filter(
        (tx) => tx.type === type && tx.category_id === category.id,
      );
      return {
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        count: items.length,
        total: sumBy(items, type),
      };
    });

    const uncategorized = transactions.filter(
      (tx) => tx.type === type && !tx.category_id,
    );
    if (uncategorized.length > 0) {
      categoryRows.push({
        id: UNCATEGORIZED,
        name: "Sin categoría",
        color: "#94a3b8",
        icon: "Circle",
        count: uncategorized.length,
        total: sumBy(uncategorized, type),
      });
    }

    return categoryRows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [categories, transactions, type]);

  const selected = rows.find((row) => row.id === selectedId);
  const detailItems = selectedId
    ? transactions.filter(
        (tx) =>
          tx.type === type &&
          (selectedId === UNCATEGORIZED
            ? !tx.category_id
            : tx.category_id === selectedId),
      )
    : [];

  if (selectedId) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            onClick={() => onSelect(null)}
            aria-label="Volver a categorías"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {selected && (
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${selected.color}22` }}
                >
                  {(() => {
                    const Icon = getIcon(selected.icon);
                    return <Icon className="h-4 w-4" style={{ color: selected.color }} />;
                  })()}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{selected?.name ?? "Categoría"}</h2>
                <p className="text-xs text-muted-foreground">
                  {detailItems.length} movimiento{detailItems.length === 1 ? "" : "s"} en {type === "expense" ? "gastos" : "ingresos"}
                </p>
              </div>
            </div>
          </div>
          <p className="text-base font-semibold tabular-nums">
            {hideAmounts ? "••••" : formatMoney(selected?.total ?? 0)}
          </p>
        </div>

        {detailItems.length === 0 ? (
          <EmptyState
            title="No hay movimientos aquí"
            description="Esta categoría no tiene registros en el período seleccionado."
          />
        ) : (
          <TransactionList
            transactions={detailItems}
            accounts={accounts}
            categories={categories}
            hideAmounts={hideAmounts}
            onOpen={onOpen}
          />
        )}
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={type === "expense" ? "Aún no tienes categorías de gastos" : "Aún no tienes categorías de ingresos"}
        description="Crea categorías para poder explorar tus movimientos de forma ordenada."
      />
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{type === "expense" ? "Gastos por categoría" : "Ingresos por categoría"}</h2>
        <p className="text-sm text-muted-foreground">
          Toca una categoría para entrar y ver solamente sus registros.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const Icon = getIcon(row.icon);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              className="glass flex items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-accent/50"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${row.color}22` }}
              >
                <Icon className="h-5 w-5" style={{ color: row.color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {row.count} registro{row.count === 1 ? "" : "s"}
                </span>
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">
                {hideAmounts ? "••••" : formatMoney(row.total)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FinancePage() {
  const { date } = useGlobalDate();
  const [periodKind, setPeriodKind] = useState<PeriodKind>("month");
  const [custom, setCustom] = useState({ start: date, end: date });
  const period = useMemo(
    () => buildPeriod(periodKind, date, custom),
    [periodKind, date, custom],
  );

  const accounts = useAccounts();
  const categories = useFinanceCategories();
  const settings = useFinanceSettings();
  const balanceRows = useBalanceRows();
  const transactions = useTransactions({ from: period.start, to: period.end });
  const titheHistory = useTransactions({ from: "1900-01-01", to: period.end });
  const mutations = useFinanceMutations();

  const [tab, setTab] = useState<FinanceTab>("resumen");
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | null>(null);
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [deleting, setDeleting] = useState<FinanceTransaction | null>(null);
  const [selected, setSelected] = useState<FinanceTransaction | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [titheOpen, setTitheOpen] = useState(false);
  const [titheDetail, setTitheDetail] = useState(false);
  const [accountDialog, setAccountDialog] = useState<{
    open: boolean;
    account: FinanceAccount | null;
  }>({ open: false, account: null });

  const list = transactions.data ?? [];
  const accountList = accounts.data ?? [];
  const categoryList = categories.data ?? [];
  const balances = accountBalances(balanceRows.data ?? []);
  const total = totalBalance(accountList, balances);
  const expenses = sumBy(list, "expense");
  const income = sumBy(list, "income");

  const hideAmounts = settings.data ? !settings.data.show_money_in_dashboard : false;
  const money = (value: number) => (hideAmounts ? "••••" : formatMoney(value));

  const categoryMeta = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const category of categoryList) {
      map.set(category.id, { name: category.name, color: category.color });
    }
    return map;
  }, [categoryList]);

  const expenseSlices = useMemo(
    () => byCategory(list, "expense", categoryMeta),
    [list, categoryMeta],
  );
  const incomeSlices = useMemo(
    () => byCategory(list, "income", categoryMeta),
    [list, categoryMeta],
  );
  const series = useMemo(() => dailySeries(list), [list]);

  const historyVisible = useMemo(() => {
    const needle = historySearch.trim().toLocaleLowerCase();
    if (!needle) return list;
    return list.filter((tx) => {
      const categoryName = tx.category_id
        ? categoryMeta.get(tx.category_id)?.name ?? ""
        : "sin categoria";
      const haystack = [
        tx.note ?? "",
        categoryName,
        ...(tx.tags ?? []),
        tx.type,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [list, historySearch, categoryMeta]);

  const tithe =
    settings.data && titheHistory.data
      ? titheLedger(titheHistory.data, settings.data, period.start, period.end)
      : null;

  const loading = accounts.isLoading || transactions.isLoading;
  const error = accounts.error ?? transactions.error;

  function changeTab(next: string) {
    const value = next as FinanceTab;
    setTab(value);
    if (value !== "gastos") setSelectedExpenseCategory(null);
    if (value !== "ingresos") setSelectedIncomeCategory(null);
  }

  return (
    <div className="space-y-4 pb-24">
      <GlobalDateHeader />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(["day", "week", "month", "year", "custom"] as PeriodKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setPeriodKind(kind)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  periodKind === kind
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {PERIOD_LABEL[kind]}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {formatPeriod(period)}
            <HelpTip helpKey="finance.period" text="Define qué fechas entran en el resumen, las categorías y el historial." />
          </span>
        </div>

        {periodKind === "custom" && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-3">
            <label className="text-xs text-muted-foreground" htmlFor="finance-from">Desde</label>
            <Input
              id="finance-from"
              type="date"
              value={custom.start}
              onChange={(event) => setCustom((prev) => ({ ...prev, start: event.target.value || prev.start }))}
              className="h-9 w-auto"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <label className="text-xs text-muted-foreground" htmlFor="finance-to">Hasta</label>
            <Input
              id="finance-to"
              type="date"
              value={custom.end}
              onChange={(event) => setCustom((prev) => ({ ...prev, end: event.target.value || prev.end }))}
              className="h-9 w-auto"
            />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                Resumen financiero
                <HelpTip helpKey="finance" />
              </h1>
              <p className="text-sm text-muted-foreground">
                El resumen no mezcla el historial: aquí ves panorama, cuentas y análisis.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={hideAmounts ? "Mostrar montos" : "Ocultar montos"}
                title={hideAmounts ? "Mostrar montos" : "Ocultar montos"}
                onClick={() =>
                  mutations.updateSettings.mutate({ show_money_in_dashboard: hideAmounts })
                }
              >
                {hideAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setCategoriesOpen(true)}>
                <Tags className="h-3.5 w-3.5" /> Categorías
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="glass rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Balance</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{money(total)}</p>
            </div>
            <div className="glass rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gastos</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{money(expenses)}</p>
            </div>
            <div className="glass rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ingresos</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-success">{money(income)}</p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {accountList.map((account) => {
              const Icon = getIcon(account.icon);
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountDialog({ open: true, account })}
                  className="glass flex min-w-[9rem] shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-left"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${account.color}22` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: account.color }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-muted-foreground">{account.name}</span>
                    <span className="block text-sm font-semibold tabular-nums">{money(balanceOf(account, balances))}</span>
                  </span>
                </button>
              );
            })}
            <Button
              variant="outline"
              className="h-auto min-w-[6.5rem] shrink-0 gap-1 rounded-2xl border-dashed text-muted-foreground"
              onClick={() => setAccountDialog({ open: true, account: null })}
            >
              <Plus className="h-4 w-4" /> Cuenta
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CategoryDonut
              slices={expenseSlices}
              total={expenses}
              hideAmounts={hideAmounts}
              title="Gastos por categoría"
            />
            <CategoryDonut
              slices={incomeSlices}
              total={income}
              hideAmounts={hideAmounts}
              title="Ingresos por categoría"
            />
          </div>
          <DailyBars data={series} hideAmounts={hideAmounts} />

          {tithe && (
            <section className="glass space-y-3 rounded-2xl px-4 py-3" aria-label="Diezmo">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1 text-sm font-medium">💰 Diezmo ({tithe.percent}%) <HelpTip helpKey="tithe.pending" /></p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setTitheDetail((value) => !value)} aria-expanded={titheDetail}>
                    {titheDetail ? "Ocultar detalle" : "Ver detalle"}
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Configurar diezmo" className="h-8 w-8" onClick={() => setTitheOpen(true)}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <div>
                  <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">Pendiente <HelpTip helpKey="tithe.pending" /></p>
                  <p className="text-lg font-semibold tabular-nums text-primary">{money(tithe.pending)}</p>
                </div>
                {tithe.credit > 0 && (
                  <div>
                    <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">A favor <HelpTip helpKey="tithe.credit" /></p>
                    <p className="text-lg font-semibold tabular-nums text-success">{money(tithe.credit)}</p>
                  </div>
                )}
              </div>
              {titheDetail && (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                  {[
                    { key: "tithe.carry", label: tithe.opening >= 0 ? "Pendiente anterior" : "A favor anterior", value: Math.abs(tithe.opening) },
                    { key: "tithe.generated", label: "Generado", value: tithe.generated },
                    { key: "tithe.paid", label: "Pagado", value: tithe.paid },
                    { key: "tithe.pending", label: "Pendiente", value: tithe.pending },
                    { key: "tithe.credit", label: "A favor", value: tithe.credit },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-border px-3 py-2">
                      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {item.label} <HelpTip helpKey={item.key} />
                      </p>
                      <p className="text-base font-semibold tabular-nums">{money(item.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <FinanceAdvancedPanel />
        </TabsContent>

        <TabsContent value="gastos">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message="No pudimos cargar tus gastos." />
          ) : (
            <CategoryExplorer
              type="expense"
              transactions={list}
              categories={categoryList}
              selectedId={selectedExpenseCategory}
              onSelect={setSelectedExpenseCategory}
              accounts={accountList}
              hideAmounts={hideAmounts}
              onOpen={setSelected}
            />
          )}
        </TabsContent>

        <TabsContent value="ingresos">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message="No pudimos cargar tus ingresos." />
          ) : (
            <CategoryExplorer
              type="income"
              transactions={list}
              categories={categoryList}
              selectedId={selectedIncomeCategory}
              onSelect={setSelectedIncomeCategory}
              accounts={accountList}
              hideAmounts={hideAmounts}
              onOpen={setSelected}
            />
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <section className="space-y-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                Historial de movimientos
                <HelpTip helpKey="finance.history" text="Aquí sí puedes ver todo junto, ordenado cronológicamente, sin mezclarlo con el resumen." />
              </h2>
              <p className="text-sm text-muted-foreground">
                Busca por nota, categoría o etiquetas dentro del período seleccionado.
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Buscar, por ejemplo: pan"
                aria-label="Buscar en el historial"
                className="h-11 pl-9"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {historyVisible.length} resultado{historyVisible.length === 1 ? "" : "s"} en {formatPeriod(period)}
              </span>
              {historySearch && (
                <button
                  type="button"
                  className="hover:text-foreground"
                  onClick={() => setHistorySearch("")}
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message="No pudimos cargar tu historial." />
          ) : historyVisible.length === 0 ? (
            <EmptyState
              title={historySearch ? "No encontramos coincidencias" : "Sin movimientos en este período"}
              description={
                historySearch
                  ? "Prueba con otra palabra o cambia el período."
                  : "Registra tu primer gasto o ingreso."
              }
            />
          ) : (
            <TransactionList
              transactions={historyVisible}
              accounts={accountList}
              categories={categoryList}
              hideAmounts={hideAmounts}
              onOpen={setSelected}
            />
          )}
        </TabsContent>
      </Tabs>

      <Button
        size="lg"
        className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg sm:bottom-8 sm:right-8"
        aria-label="Nuevo movimiento"
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <TransactionDetail
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        transaction={selected}
        accounts={accountList}
        categories={categoryList}
        hideAmounts={hideAmounts}
        onEdit={(tx) => {
          setEditing(tx);
          setDialogOpen(true);
        }}
        onDelete={setDeleting}
      />

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={date}
        accounts={accountList}
        categories={categoryList}
        transaction={editing}
        pending={mutations.createTransaction.isPending || mutations.updateTransaction.isPending}
        onSubmit={async (input) => {
          if (editing) {
            await mutations.updateTransaction.mutateAsync({ id: editing.id, patch: input });
          } else {
            await mutations.createTransaction.mutateAsync(input);
          }
          setDialogOpen(false);
          setEditing(null);
        }}
      />

      <AccountDialog
        open={accountDialog.open}
        onOpenChange={(open) => setAccountDialog((prev) => ({ ...prev, open }))}
        account={accountDialog.account}
        pending={mutations.createAccount.isPending || mutations.updateAccount.isPending}
        onSubmit={async (input) => {
          if (accountDialog.account) {
            await mutations.updateAccount.mutateAsync({ id: accountDialog.account.id, patch: input });
          } else {
            await mutations.createAccount.mutateAsync({ input, position: accountList.length });
          }
          setAccountDialog({ open: false, account: null });
        }}
      />

      <CategoryManagerDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categoryList}
      />

      {settings.data && (
        <TitheSettingsDialog
          open={titheOpen}
          onOpenChange={setTitheOpen}
          settings={settings.data}
          pending={mutations.updateSettings.isPending}
          onSubmit={async (patch) => {
            await mutations.updateSettings.mutateAsync(patch);
            setTitheOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Eliminar movimiento"
        description="Esta acción no se puede deshacer."
        onConfirm={async () => {
          if (deleting) await mutations.deleteTransaction.mutateAsync(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
