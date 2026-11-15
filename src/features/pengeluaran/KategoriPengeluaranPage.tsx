import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { TablePagination } from "@/components/common/TablePagination";
import { EmptyState } from "@/components/feedback/EmptyState";
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
import { Switch } from "@/components/ui/switch";
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
import { bootstrapQueryKey } from "@/db/queries/bootstrap";
import type { ExpenseCategory } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import { formatTanggalWaktu } from "@/lib/format";

import { CategoryFormDialog } from "./CategoryFormDialog";
import {
  createExpenseCategoryRequest,
  deleteExpenseCategoryRequest,
  setExpenseCategoryActiveRequest,
  updateExpenseCategoryRequest,
} from "./expenses-api";
import {
  expenseCategoriesQueryKey,
  expensesQueryKey,
  fetchExpenseCategories,
} from "./expenses-queries";
import type {
  ExpenseCategoryInput,
  ExpenseCategoryWithUsage,
} from "./types";

const PAGE_SIZE = 10;

const statusOptions = [
  { value: "all", label: "Semua status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
] as const;

const sortOptions = [
  { value: "name-asc", label: "Nama A-Z" },
  { value: "name-desc", label: "Nama Z-A" },
  { value: "usage-desc", label: "Paling sering dipakai" },
  { value: "newest", label: "Terbaru" },
] as const;

type CategoryStatusFilter = (typeof statusOptions)[number]["value"];
type CategorySort = (typeof sortOptions)[number]["value"];

function isCategorySort(value: string): value is CategorySort {
  return sortOptions.some((option) => option.value === value);
}

function compareCategories(
  first: ExpenseCategoryWithUsage,
  second: ExpenseCategoryWithUsage,
  sort: CategorySort,
): number {
  switch (sort) {
    case "name-desc":
      return second.name.localeCompare(first.name, "id", {
        sensitivity: "base",
      });
    case "usage-desc":
      return second.usage_count - first.usage_count;
    case "newest":
      return second.id - first.id;
    default:
      return first.name.localeCompare(second.name, "id", {
        sensitivity: "base",
      });
  }
}

export function KategoriPengeluaranPage() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: expenseCategoriesQueryKey,
    queryFn: fetchExpenseCategories,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CategoryStatusFilter>("all");
  const [sort, setSort] = useState<CategorySort>("name-asc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ExpenseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] =
    useState<ExpenseCategoryWithUsage | null>(null);

  const invalidateCategoryData = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: expenseCategoriesQueryKey,
    });
    await queryClient.invalidateQueries({ queryKey: expensesQueryKey });
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    await queryClient.invalidateQueries({ queryKey: reportsQueryKey });
  };

  const toggleMutation = useMutation({
    mutationFn: async (input: {
      category: ExpenseCategoryWithUsage;
      isActive: boolean;
    }) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await setExpenseCategoryActiveRequest(
        token,
        input.category.id,
        input.isActive,
      );
    },
    onSuccess: async (_data, variables) => {
      await invalidateCategoryData();
      toast.success(
        variables.isActive
          ? "Kategori pengeluaran berhasil diaktifkan."
          : "Kategori pengeluaran berhasil dinonaktifkan.",
      );
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal mengubah status kategori pengeluaran."),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (category: ExpenseCategoryWithUsage) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await deleteExpenseCategoryRequest(token, category.id);
    },
    onSuccess: async (_data, category) => {
      await invalidateCategoryData();
      setDeletingCategory(null);
      toast.success(
        `Kategori "${category.name}" berhasil dihapus.`,
      );
    },
    onError: (error) => {
      setDeletingCategory(null);
      toast.error(
        getErrorMessage(error, "Gagal menghapus kategori pengeluaran."),
      );
    },
  });

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    const data = categoriesQuery.data ?? [];

    return data
      .filter((category) => {
        if (statusFilter === "active" && category.is_active !== 1) {
          return false;
        }
        if (statusFilter === "inactive" && category.is_active === 1) {
          return false;
        }
        if (!query) return true;
        return category.name.toLowerCase().includes(query);
      })
      .sort((first, second) => compareCategories(first, second, sort));
  }, [categoriesQuery.data, search, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleCategories = filteredCategories.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const hasActiveFilter = search.trim().length > 0 || statusFilter !== "all";

  const openCreateForm = () => {
    setEditingCategory(null);
    setFormOpen(true);
  };

  const openEditForm = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setFormOpen(true);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSort("name-asc");
    setPage(1);
  };

  const handleSave = async (input: ExpenseCategoryInput) => {
    if (!token) {
      throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
    }

    if (editingCategory) {
      await updateExpenseCategoryRequest(token, editingCategory.id, input);
    } else {
      await createExpenseCategoryRequest(token, input);
    }

    await invalidateCategoryData();
    toast.success(
      editingCategory
        ? "Kategori pengeluaran berhasil diperbarui."
        : "Kategori pengeluaran baru berhasil ditambahkan.",
    );
  };

  return (
    <>
      <PageHeader
        title="Kategori Pengeluaran"
        description="Kelola kelompok biaya operasional. Kategori yang sudah dipakai cukup dinonaktifkan."
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to="/pengeluaran">
                <ArrowLeft className="size-4" />
                Kembali
              </Link>
            </Button>
            <Button onClick={openCreateForm}>
              <Plus className="size-4" />
              Tambah Kategori
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-dashed bg-muted/35 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Kategori yang sudah dipakai pada pengeluaran tidak dapat dihapus agar
          riwayat dan laporan tetap utuh. Nonaktifkan kategori tersebut bila
          tidak ingin dipakai lagi.
        </p>
      </div>

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Cari nama kategori..."
              className="pl-9"
              aria-label="Cari kategori pengeluaran"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as CategoryStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="w-full sm:w-40"
                aria-label="Filter status kategori pengeluaran"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(value) => {
                if (isCategorySort(value)) {
                  setSort(value);
                  setPage(1);
                }
              }}
            >
              <SelectTrigger
                className="w-full sm:w-48"
                aria-label="Urutkan kategori pengeluaran"
              >
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
        </CardContent>
      </Card>

      {categoriesQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat kategori pengeluaran
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(categoriesQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void categoriesQuery.refetch()}
              disabled={categoriesQuery.isFetching}
            >
              <RefreshCw
                className={
                  categoriesQuery.isFetching
                    ? "size-4 animate-spin"
                    : "size-4"
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
                <TableHead>Nama Kategori</TableHead>
                <TableHead className="text-right">Pemakaian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Diperbarui
                </TableHead>
                <TableHead className="w-12 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriesQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-md" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto size-8 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="whitespace-normal py-0">
                    <EmptyState
                      icon={hasActiveFilter ? Search : Tags}
                      title={
                        hasActiveFilter
                          ? "Kategori tidak ditemukan"
                          : "Belum ada kategori pengeluaran"
                      }
                      description={
                        hasActiveFilter
                          ? "Coba ubah kata kunci atau filter status."
                          : "Tambahkan kategori pertama untuk mengelompokkan pengeluaran."
                      }
                      action={
                        hasActiveFilter ? (
                          <Button variant="outline" onClick={resetFilters}>
                            Reset filter
                          </Button>
                        ) : (
                          <Button onClick={openCreateForm}>
                            <Plus className="size-4" />
                            Tambah Kategori
                          </Button>
                        )
                      }
                      className="border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleCategories.map((category) => {
                  const isToggling =
                    toggleMutation.isPending &&
                    toggleMutation.variables?.category.id === category.id;

                  return (
                    <TableRow key={category.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium text-foreground">
                          {category.name}
                        </p>
                        {category.usage_count > 0 ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Dipakai pada {category.usage_count} catatan
                            pengeluaran
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {category.usage_count}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={category.is_active === 1}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                category,
                                isActive: checked,
                              })
                            }
                            disabled={isToggling}
                            aria-label={
                              category.is_active === 1
                                ? `Nonaktifkan ${category.name}`
                                : `Aktifkan ${category.name}`
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {category.is_active === 1 ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatTanggalWaktu(category.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Aksi untuk ${category.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => openEditForm(category)}
                            >
                              <Pencil className="size-4" />
                              Ubah
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {category.usage_count > 0 ? (
                              <DropdownMenuItem disabled>
                                <Trash2 className="size-4" />
                                Hapus (sudah dipakai)
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeletingCategory(category)}
                              >
                                <Trash2 className="size-4" />
                                Hapus
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {!categoriesQuery.isLoading && visibleCategories.length > 0 ? (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredCategories.length}
              onPageChange={setPage}
              itemLabel="kategori"
            />
          ) : null}
        </Card>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editingCategory}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(open) => {
          if (!open) setDeletingCategory(null);
        }}
        title="Hapus kategori pengeluaran?"
        description={
          deletingCategory
            ? `Kategori "${deletingCategory.name}" akan dihapus permanen. Kategori yang sudah dipakai pengeluaran tidak dapat dihapus, nonaktifkan saja agar riwayat tetap utuh.`
            : ""
        }
        confirmLabel="Hapus Kategori"
        pendingLabel="Menghapus..."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingCategory) deleteMutation.mutate(deletingCategory);
        }}
      />
    </>
  );
}
