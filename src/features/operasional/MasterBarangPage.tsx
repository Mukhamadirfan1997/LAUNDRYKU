import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { ActiveBadge } from "@/components/common/ActiveBadge";
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
import type { Item } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah, formatTanggalWaktu } from "@/lib/format";

import { ItemFormDialog } from "./ItemFormDialog";
import {
  createItemRequest,
  deleteItemRequest,
  setItemActiveRequest,
  updateItemRequest,
  type ItemInput,
} from "./catalog-api";
import {
  fetchItems,
  itemsQueryKey,
  type ItemWithUsage,
} from "./catalog-queries";

const PAGE_SIZE = 10;

const statusOptions = [
  { value: "all", label: "Semua status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
] as const;

const sortOptions = [
  { value: "name-asc", label: "Nama A-Z" },
  { value: "name-desc", label: "Nama Z-A" },
  { value: "price-asc", label: "Harga terendah" },
  { value: "price-desc", label: "Harga tertinggi" },
  { value: "stock-asc", label: "Stok tersedikit" },
  { value: "stock-desc", label: "Stok terbanyak" },
  { value: "newest", label: "Terbaru" },
] as const;

type ItemStatusFilter = (typeof statusOptions)[number]["value"];
type ItemSort = (typeof sortOptions)[number]["value"];

function compareItems(
  first: ItemWithUsage,
  second: ItemWithUsage,
  sort: ItemSort,
): number {
  switch (sort) {
    case "name-desc":
      return second.name.localeCompare(first.name, "id", {
        sensitivity: "base",
      });
    case "price-asc":
      return first.price - second.price;
    case "price-desc":
      return second.price - first.price;
    case "stock-asc":
      return first.stock - second.stock;
    case "stock-desc":
      return second.stock - first.stock;
    case "newest":
      return second.id - first.id;
    default:
      return first.name.localeCompare(second.name, "id", {
        sensitivity: "base",
      });
  }
}

function isItemSort(value: string): value is ItemSort {
  return sortOptions.some((option) => option.value === value);
}

export function MasterBarangPage() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const token = useAuthStore((state) => state.token);
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: itemsQueryKey,
    queryFn: fetchItems,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ItemStatusFilter>("all");
  const [sort, setSort] = useState<ItemSort>("name-asc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<ItemWithUsage | null>(null);

  const toggleMutation = useMutation({
    mutationFn: async (input: {
      item: ItemWithUsage;
      isActive: boolean;
    }) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await setItemActiveRequest(token, input.item.id, input.isActive);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: itemsQueryKey });
      toast.success(
        variables.isActive
          ? "Barang berhasil diaktifkan."
          : "Barang berhasil dinonaktifkan.",
      );
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal mengubah status barang."),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: ItemWithUsage) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await deleteItemRequest(token, item.id);
    },
    onSuccess: async (_data, item) => {
      await queryClient.invalidateQueries({ queryKey: itemsQueryKey });
      setDeletingItem(null);
      toast.success(`Barang "${item.name}" berhasil dihapus.`);
    },
    onError: (error) => {
      setDeletingItem(null);
      toast.error(getErrorMessage(error, "Gagal menghapus barang."));
    },
  });

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const data = itemsQuery.data ?? [];

    return data
      .filter((item) => {
        if (statusFilter === "active" && item.is_active !== 1) return false;
        if (statusFilter === "inactive" && item.is_active === 1) return false;
        if (!query) return true;
        return (
          item.name.toLowerCase().includes(query) ||
          item.unit.toLowerCase().includes(query)
        );
      })
      .sort((first, second) => compareItems(first, second, sort));
  }, [itemsQuery.data, search, sort, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const hasActiveFilter = search.trim().length > 0 || statusFilter !== "all";

  const openCreateForm = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const openEditForm = (item: Item) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSort("name-asc");
    setPage(1);
  };

  const handleSave = async (input: ItemInput) => {
    if (!token) {
      throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
    }

    if (editingItem) {
      await updateItemRequest(token, editingItem.id, input);
    } else {
      await createItemRequest(token, input);
    }

    await queryClient.invalidateQueries({ queryKey: itemsQueryKey });
    toast.success(
      editingItem
        ? "Barang berhasil diperbarui."
        : "Barang baru berhasil ditambahkan.",
    );
  };

  const tableColumnCount = isAdmin ? 7 : 6;

  return (
    <>
      <PageHeader
        title="Master Barang"
        description="Kelola barang yang dijual atau dipakai dalam operasional laundry."
        actions={
          isAdmin ? (
            <Button onClick={openCreateForm}>
              <Plus className="size-4" />
              Tambah Barang
            </Button>
          ) : (
            <Badge variant="secondary">
              <Eye className="size-3.5" />
              Hanya lihat
            </Badge>
          )
        }
      />

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
              placeholder="Cari nama atau satuan barang…"
              className="pl-9"
              aria-label="Cari barang"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as ItemStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="w-full sm:w-40"
                aria-label="Filter status barang"
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
                if (isItemSort(value)) {
                  setSort(value);
                  setPage(1);
                }
              }}
            >
              <SelectTrigger
                className="w-full sm:w-48"
                aria-label="Urutkan barang"
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

      {itemsQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat master barang
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(itemsQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void itemsQuery.refetch()}
              disabled={itemsQuery.isFetching}
            >
              <RefreshCw
                className={
                  itemsQuery.isFetching ? "size-4 animate-spin" : "size-4"
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
                <TableHead>Nama Barang</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Diperbarui
                </TableHead>
                {isAdmin ? (
                  <TableHead className="w-12 text-right">Aksi</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        <Skeleton className="ml-auto size-8 rounded-md" />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              ) : visibleItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumnCount}
                    className="whitespace-normal py-0"
                  >
                    <EmptyState
                      icon={hasActiveFilter ? Search : Package}
                      title={
                        hasActiveFilter
                          ? "Barang tidak ditemukan"
                          : "Belum ada barang"
                      }
                      description={
                        hasActiveFilter
                          ? "Coba ubah kata kunci atau filter status."
                          : isAdmin
                            ? "Tambahkan barang pertama untuk mulai mengelola stok dan harga."
                            : "Belum ada barang yang ditambahkan Admin."
                      }
                      action={
                        hasActiveFilter ? (
                          <Button variant="outline" onClick={resetFilters}>
                            Reset filter
                          </Button>
                        ) : isAdmin ? (
                          <Button onClick={openCreateForm}>
                            <Plus className="size-4" />
                            Tambah Barang
                          </Button>
                        ) : undefined
                      }
                      className="border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleItems.map((item) => {
                  const isToggling =
                    toggleMutation.isPending &&
                    toggleMutation.variables?.item.id === item.id;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium text-foreground">
                          {item.name}
                        </p>
                        {item.usage_count > 0 ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Dipakai {item.usage_count} baris transaksi
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatRupiah(item.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.stock}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={item.is_active === 1}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  item,
                                  isActive: checked,
                                })
                              }
                              disabled={isToggling}
                              aria-label={
                                item.is_active === 1
                                  ? `Nonaktifkan ${item.name}`
                                  : `Aktifkan ${item.name}`
                              }
                            />
                            <span className="text-xs text-muted-foreground">
                              {item.is_active === 1 ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        ) : (
                          <ActiveBadge active={item.is_active === 1} />
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatTanggalWaktu(item.updated_at)}
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Aksi untuk ${item.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => openEditForm(item)}
                              >
                                <Pencil className="size-4" />
                                Ubah
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {item.usage_count > 0 ? (
                                <DropdownMenuItem disabled>
                                  <Trash2 className="size-4" />
                                  Hapus (dipakai)
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDeletingItem(item)}
                                >
                                  <Trash2 className="size-4" />
                                  Hapus
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {!itemsQuery.isLoading && visibleItems.length > 0 ? (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredItems.length}
              onPageChange={setPage}
              itemLabel="barang"
            />
          ) : null}
        </Card>
      )}

      <ItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editingItem}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
        title="Hapus barang?"
        description={
          deletingItem
            ? `Barang "${deletingItem.name}" akan dihapus permanen. Barang yang sudah dipakai transaksi tidak dapat dihapus, nonaktifkan saja agar riwayat tetap utuh.`
            : ""
        }
        confirmLabel="Hapus Barang"
        pendingLabel="Menghapus…"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem);
        }}
      />
    </>
  );
}
