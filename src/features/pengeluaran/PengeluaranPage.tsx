import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { TablePagination } from "@/components/common/TablePagination";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/features/auth/auth-store";
import { reportsQueryKey } from "@/features/laporan/report-queries";
import { getErrorMessage } from "@/lib/api";
import {
  formatRupiah,
  formatTanggal,
  formatTanggalWaktu,
} from "@/lib/format";

import { ExpenseFormDialog } from "./ExpenseFormDialog";
import {
  createExpenseRequest,
  deleteExpenseRequest,
  updateExpenseRequest,
} from "./expenses-api";
import {
  expenseCategoriesQueryKey,
  expensesQueryKey,
  fetchExpenseCategories,
  fetchExpenses,
} from "./expenses-queries";
import type { ExpenseInput, ExpenseWithCategory } from "./types";

const PAGE_SIZE = 10;

const sortOptions = [
  { value: "date-desc", label: "Tanggal terbaru" },
  { value: "date-asc", label: "Tanggal terlama" },
  { value: "amount-desc", label: "Nominal terbesar" },
  { value: "amount-asc", label: "Nominal terkecil" },
] as const;

type ExpenseSort = (typeof sortOptions)[number]["value"];

function isExpenseSort(value: string): value is ExpenseSort {
  return sortOptions.some((option) => option.value === value);
}

function compareExpenses(
  first: ExpenseWithCategory,
  second: ExpenseWithCategory,
  sort: ExpenseSort,
): number {
  switch (sort) {
    case "date-asc":
      return (
        first.expense_date.localeCompare(second.expense_date) ||
        first.id - second.id
      );
    case "amount-desc":
      return second.amount - first.amount;
    case "amount-asc":
      return first.amount - second.amount;
    default:
      return (
        second.expense_date.localeCompare(first.expense_date) ||
        second.id - first.id
      );
  }
}

export function PengeluaranPage() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: expensesQueryKey,
    queryFn: fetchExpenses,
  });
  const categoriesQuery = useQuery({
    queryKey: expenseCategoriesQueryKey,
    queryFn: fetchExpenseCategories,
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState<ExpenseSort>("date-desc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<ExpenseWithCategory | null>(null);
  const [deletingExpense, setDeletingExpense] =
    useState<ExpenseWithCategory | null>(null);

  const dateRangeInvalid = Boolean(
    startDate && endDate && startDate > endDate,
  );

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    const data = expensesQuery.data ?? [];

    if (dateRangeInvalid) return [];

    return data
      .filter((expense) => {
        if (
          categoryFilter !== "all" &&
          String(expense.category_id) !== categoryFilter
        ) {
          return false;
        }
        if (startDate && expense.expense_date < startDate) return false;
        if (endDate && expense.expense_date > endDate) return false;
        if (!query) return true;
        return (
          expense.description.toLowerCase().includes(query) ||
          expense.category_name.toLowerCase().includes(query)
        );
      })
      .sort((first, second) => compareExpenses(first, second, sort));
  }, [
    categoryFilter,
    dateRangeInvalid,
    endDate,
    expensesQuery.data,
    search,
    sort,
    startDate,
  ]);

  const totalFiltered = filteredExpenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );
  const categoryCount = new Set(
    filteredExpenses.map((expense) => expense.category_id),
  ).size;
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleExpenses = filteredExpenses.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const hasActiveFilter =
    search.trim().length > 0 ||
    categoryFilter !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate);
  const categories = categoriesQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (expense: ExpenseWithCategory) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await deleteExpenseRequest(token, expense.id);
    },
    onSuccess: async (_data, expense) => {
      await queryClient.invalidateQueries({ queryKey: expensesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: expenseCategoriesQueryKey,
      });
      await queryClient.invalidateQueries({ queryKey: reportsQueryKey });
      setDeletingExpense(null);
      toast.success(`Pengeluaran "${expense.description}" berhasil dihapus.`);
    },
    onError: (error) => {
      setDeletingExpense(null);
      toast.error(getErrorMessage(error, "Gagal menghapus pengeluaran."));
    },
  });

  const openCreateForm = () => {
    setEditingExpense(null);
    setFormOpen(true);
  };

  const openEditForm = (expense: ExpenseWithCategory) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStartDate("");
    setEndDate("");
    setSort("date-desc");
    setPage(1);
  };

  const handleSave = async (input: ExpenseInput) => {
    if (!token) {
      throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
    }

    if (editingExpense) {
      await updateExpenseRequest(token, editingExpense.id, input);
    } else {
      await createExpenseRequest(token, input);
    }

    await queryClient.invalidateQueries({ queryKey: expensesQueryKey });
    await queryClient.invalidateQueries({
      queryKey: expenseCategoriesQueryKey,
    });
    await queryClient.invalidateQueries({ queryKey: reportsQueryKey });
    toast.success(
      editingExpense
        ? "Pengeluaran berhasil diperbarui."
        : "Pengeluaran baru berhasil dicatat.",
    );
  };

  return (
    <>
      <PageHeader
        title="Pengeluaran"
        description="Catat biaya operasional dan kelompokkan per kategori agar laporan kas tetap akurat."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/pengeluaran/kategori">
                <Settings2 className="size-4" />
                Kategori
              </Link>
            </Button>
            <Button onClick={openCreateForm}>
              <Plus className="size-4" />
              Catat Pengeluaran
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="gap-0 py-0">
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Total pengeluaran
              </p>
              <p className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">
                {formatRupiah(totalFiltered)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {hasActiveFilter ? "Sesuai filter aktif" : "Seluruh catatan"}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15">
              <Wallet className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Jumlah catatan
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {filteredExpenses.length}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Catatan pengeluaran
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/15 dark:text-amber-400">
              <CalendarDays className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Kategori terpakai
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {categoryCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Dari catatan yang tampil
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 ring-1 ring-inset ring-cyan-500/15 dark:text-cyan-400">
              <ListFilter className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_155px_155px_190px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari keterangan atau kategori..."
                className="pl-9"
                aria-label="Cari pengeluaran"
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter kategori pengeluaran">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                    {category.is_active === 1 ? "" : " (nonaktif)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              aria-label="Tanggal mulai pengeluaran"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              aria-label="Tanggal akhir pengeluaran"
            />

            <Select
              value={sort}
              onValueChange={(value) => {
                if (isExpenseSort(value)) {
                  setSort(value);
                  setPage(1);
                }
              }}
            >
              <SelectTrigger aria-label="Urutkan pengeluaran">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {dateRangeInvalid ? (
                <p className="text-xs font-medium text-destructive">
                  Tanggal mulai tidak boleh setelah tanggal akhir.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Filter tanggal menggunakan tanggal pengeluaran.
                </p>
              )}
              {hasActiveFilter ? (
                <Badge variant="secondary">Filter aktif</Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={!hasActiveFilter && sort === "date-desc"}
            >
              Reset filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {expensesQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat pengeluaran
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(expensesQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void expensesQuery.refetch()}
              disabled={expensesQuery.isFetching}
            >
              <RefreshCw
                className={
                  expensesQuery.isFetching ? "size-4 animate-spin" : "size-4"
                }
              />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Diperbarui
                </TableHead>
                <TableHead className="w-12 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expensesQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-md" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-24" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto size-8 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="whitespace-normal py-0">
                    <EmptyState
                      icon={hasActiveFilter ? Search : Wallet}
                      title={
                        hasActiveFilter
                          ? "Pengeluaran tidak ditemukan"
                          : "Belum ada pengeluaran"
                      }
                      description={
                        hasActiveFilter
                          ? "Coba ubah kata kunci, kategori, atau rentang tanggal."
                          : "Catat biaya operasional pertama agar laporan kas mulai terisi."
                      }
                      action={
                        hasActiveFilter ? (
                          <Button variant="outline" onClick={resetFilters}>
                            Reset filter
                          </Button>
                        ) : (
                          <Button onClick={openCreateForm}>
                            <Plus className="size-4" />
                            Catat Pengeluaran
                          </Button>
                        )
                      }
                      className="border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTanggal(expense.expense_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{expense.category_name}</Badge>
                        {expense.category_active === 1 ? null : (
                          <Badge variant="secondary">Nonaktif</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <p className="max-w-md font-medium text-foreground">
                        {expense.description}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                      {formatRupiah(expense.amount)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {formatTanggalWaktu(expense.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Aksi untuk ${expense.description}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => openEditForm(expense)}
                          >
                            <Pencil className="size-4" />
                            Ubah
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeletingExpense(expense)}
                          >
                            <Trash2 className="size-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!expensesQuery.isLoading && visibleExpenses.length > 0 ? (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredExpenses.length}
              onPageChange={setPage}
              itemLabel="pengeluaran"
            />
          ) : null}
        </Card>
      )}

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editingExpense}
        categories={categories}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        onOpenChange={(open) => {
          if (!open) setDeletingExpense(null);
        }}
        title="Hapus pengeluaran?"
        description={
          deletingExpense
            ? `Pengeluaran "${deletingExpense.description}" sebesar ${formatRupiah(deletingExpense.amount)} akan dihapus permanen dan tidak lagi masuk laporan.`
            : ""
        }
        confirmLabel="Hapus Pengeluaran"
        pendingLabel="Menghapus..."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingExpense) deleteMutation.mutate(deletingExpense);
        }}
      />
    </>
  );
}
