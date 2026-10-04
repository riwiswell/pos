import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Plus, Settings2, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { HelpTip } from "@/components/common/HelpTip";
import type { FinanceAccount, FinanceTransaction } from "@/domain/finance";

export const Route = createFileRoute("/_authenticated/finanzas")({
  head: () => ({
    meta: [
      { title: "Finanzas — Personal OS" },
      {
        name: "description",
        content: "Registra gastos e ingresos en segundos y revisa tu balance real por período.",
      },
      { property: "og:title", content: "Finanzas — Personal OS" },
      {
        property: "og:description",
        content: "Registra gastos e ingresos en segundos y revisa tu balance real por período.",
      },
    ],
  }),
  component: FinancePage,
});

/** Única fuente de verdad del filtro: la tarjeta seleccionada. */
type Lens = "all" | "expense" | "income";

function FinancePage() {
  const { date } = useGlobalDate();
  const [periodKind, setPeriodKind] = useState<PeriodKind>("month");
  const [custom, setCustom] = useState<{ start: string; end: string }>({ start: date, end: date });
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
  const [titheDetail, setTitheDetail] = useState(false);
  const mutations = useFinanceMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [deleting, setDeleting] = useState<FinanceTransaction | null>(null);
  const [selected, setSelected] = useState<FinanceTransaction | null>(null);
  const [lens, setLens] = useState<Lens>("all");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [titheOpen, setTitheOpen] = useState(false);
  const [accountDialog, setAccountDialog] = useState<{
    open: boolean;
    account: FinanceAccount | null;
  }>({ open: false, account: null });


  const list = transactions.data ?? [];
  const accountList = accounts.data ?? [];
  const balances = accountBalances(balanceRows.data ?? []);
  const total = totalBalance(accountList, balances);
  const expenses = sumBy(list, "expense");
  const income = sumBy(list, "income");
  const tithe =
    settings.data && titheHistory.data
      ? titheLedger(titheHistory.data, settings.data, period.start, period.end)
      : null;

  const hideAmounts = settings.data ? !settings.data.show_money_in_dashboard : false;
  const money = (value: number) => (hideAmounts ? "••••" : formatMoney(value));

  const categoryMeta = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const category of categories.data ?? []) {
      map.set(category.id, { name: category.name, color: category.color });
    }
    return map;
  }, [categories.data]);

  const chartType: "expense" | "income" = lens === "income" ? "income" : "expense";
  const slices = useMemo(
    () => byCategory(list, chartType, categoryMeta),
    [list, chartType, categoryMeta],
  );
  const series = useMemo(() => dailySeries(list), [list]);

  const visible = useMemo(
    () => (lens === "all" ? list : list.filter((tx) => tx.type === lens)),
    [list, lens],
  );

  const loading = accounts.isLoading || transactions.isLoading;
  const error = accounts.error ?? transactions.error;

  return (
    <div className="space-y-4 pb-24">
      <GlobalDateHeader />

      {/* Las tarjetas SON el filtro: una sola fuente de verdad para el listado.
          Los valores nunca cambian al filtrar; solo cambia qué se lista. */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filtro de movimientos">
        <button
          type="button"
          onClick={() => setLens("all")}
          aria-pressed={lens === "all"}
          className={cn(
            "glass relative rounded-2xl p-3 text-left transition-shadow",
            lens === "all" && "ring-2 ring-primary",
          )}
        >
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Balance</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{money(total)}</p>
          <span
            role="button"
            tabIndex={0}
            aria-label={hideAmounts ? "Mostrar montos" : "Ocultar montos"}
            title={hideAmounts ? "Mostrar montos" : "Ocultar montos"}
            onClick={(event) => {
              event.stopPropagation();
              mutations.updateSettings.mutate({ show_money_in_dashboard: hideAmounts });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") event.stopPropagation();
            }}
            className="absolute right-2 top-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {hideAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setLens("expense")}
          aria-pressed={lens === "expense"}
          className={cn(
            "glass rounded-2xl p-3 text-left transition-shadow",
            lens === "expense" && "ring-2 ring-primary",
          )}
        >
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gastos</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{money(expenses)}</p>
        </button>
        <button
          type="button"
          onClick={() => setLens("income")}
          aria-pressed={lens === "income"}
          className={cn(
            "glass rounded-2xl p-3 text-left transition-shadow",
            lens === "income" && "ring-2 ring-primary",
          )}
        >
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ingresos</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-success">
            {money(income)}
          </p>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(["day", "week", "month", "year", "custom"] as PeriodKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setPeriodKind(kind)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  periodKind === kind
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {PERIOD_LABEL[kind]}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{formatPeriod(period)}</span>
        </div>

        {periodKind === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="Desde"
              value={custom.start}
              onChange={(event) =>
                setCustom((prev) => ({ ...prev, start: event.target.value || prev.start }))
              }
              className="h-9 w-auto"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              type="date"
              aria-label="Hasta"
              value={custom.end}
              onChange={(event) =>
                setCustom((prev) => ({ ...prev, end: event.target.value || prev.end }))
              }
              className="h-9 w-auto"
            />
          </div>
        )}
      </div>


      {/* Accounts strip: real balance = initial balance + ledger */}
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
                <span className="block text-sm font-semibold tabular-nums">
                  {money(balanceOf(account, balances))}
                </span>
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

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 rounded-full text-xs"
          onClick={() => setCategoriesOpen(true)}
        >
          <Tags className="h-3.5 w-3.5" /> Categorías
        </Button>
      </div>

      <CategoryDonut
        slices={slices}
        total={chartType === "income" ? income : expenses}
        hideAmounts={hideAmounts}
        title={chartType === "income" ? "Ingresos por categoría" : "Gastos por categoría"}
      />
      <DailyBars data={series} hideAmounts={hideAmounts} />

      {tithe && (
        <section className="glass space-y-3 rounded-2xl px-4 py-3" aria-label="Diezmo">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">💰 Diezmo ({tithe.percent}%)</p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setTitheDetail((v) => !v)} aria-expanded={titheDetail}>
                {titheDetail ? "Ocultar detalle" : "Ver detalle"}
              </Button>
              <Button size="icon" variant="ghost" aria-label="Configurar diezmo" className="h-8 w-8" onClick={() => setTitheOpen(true)}>
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1" data-testid="tithe-summary">
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
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3" data-testid="tithe-detail">
              {[
                { key: "tithe.carry", label: tithe.opening >= 0 ? "Pendiente anterior" : "A favor anterior", value: Math.abs(tithe.opening), tone: "text-foreground" },
                { key: "tithe.generated", label: "Generado", value: tithe.generated, tone: "text-foreground" },
                { key: "tithe.paid", label: "Pagado", value: tithe.paid, tone: "text-success" },
                { key: "tithe.pending", label: "Pendiente", value: tithe.pending, tone: "text-primary" },
                { key: "tithe.credit", label: "A favor", value: tithe.credit, tone: "text-success" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border px-3 py-2">
                  <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {item.label} <HelpTip helpKey={item.key} />
                  </p>
                  <p className={`text-base font-semibold tabular-nums ${item.tone}`}>{money(item.value)}</p>
                </div>
              ))}
              <p className="col-span-2 text-xs text-muted-foreground">
                Obligación del período: {money(tithe.obligation)} (pendiente anterior + generado). Los pagos se aplican primero a lo pendiente; lo pagado de más queda a favor.
              </p>
            </div>
          )}
        </section>
      )}


      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="No pudimos cargar tus finanzas." />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Sin movimientos en este período"
          description="Registra tu primer gasto o ingreso; toma menos de tres segundos."
        />
      ) : (
        <TransactionList
          transactions={visible}
          accounts={accountList}
          categories={categories.data ?? []}
          hideAmounts={hideAmounts}
          onOpen={setSelected}
        />
      )}

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
        categories={categories.data ?? []}
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
        categories={categories.data ?? []}
        transaction={editing}
        pending={mutations.createTransaction.isPending || mutations.updateTransaction.isPending}
        onSubmit={async (input) => {
          if (editing) await mutations.updateTransaction.mutateAsync({ id: editing.id, patch: input });
          else await mutations.createTransaction.mutateAsync(input);
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
            await mutations.updateAccount.mutateAsync({
              id: accountDialog.account.id,
              patch: input,
            });
          } else {
            await mutations.createAccount.mutateAsync({ input, position: accountList.length });
          }
          setAccountDialog({ open: false, account: null });
        }}
      />

      <CategoryManagerDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories.data ?? []}
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