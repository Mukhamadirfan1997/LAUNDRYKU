import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  Users,
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
import { bootstrapQueryKey } from "@/db/queries/bootstrap";
import type { Customer } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import { formatTanggalWaktu } from "@/lib/format";

import { CustomerFormDialog } from "./CustomerFormDialog";
import {
  createCustomerRequest,
  deleteCustomerRequest,
  updateCustomerRequest,
  type CustomerInput,
} from "./customers-api";
import {
  customersQueryKey,
  fetchCustomers,
} from "./customers-queries";
import { ordersQueryKey } from "./orders-queries";
import type { CustomerWithOrderCount } from "./types";

const PAGE_SIZE = 10;

const sortOptions = [
  { value: "name-asc", label: "Nama A-Z" },
  { value: "name-desc", label: "Nama Z-A" },
  { value: "orders-desc", label: "Order terbanyak" },
  { value: "newest", label: "Terbaru" },
] as const;

type CustomerSort = (typeof sortOptions)[number]["value"];

function isCustomerSort(value: string): value is CustomerSort {
  return sortOptions.some((option) => option.value === value);
}

function compareCustomers(
  first: CustomerWithOrderCount,
  second: CustomerWithOrderCount,
  sort: CustomerSort,
): number {
  switch (sort) {
    case "name-desc":
      return second.name.localeCompare(first.name, "id", {
        sensitivity: "base",
      });
    case "orders-desc":
      return second.order_count - first.order_count;
    case "newest":
      return second.id - first.id;
    default:
      return first.name.localeCompare(second.name, "id", {
        sensitivity: "base",
      });
  }
}

export function PelangganPage() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const customersQuery = useQuery({
    queryKey: customersQueryKey,
    queryFn: fetchCustomers,
  });

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CustomerSort>("name-asc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] =
    useState<CustomerWithOrderCount | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key.toLowerCase() !== "k") return;

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (customer: CustomerWithOrderCount) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await deleteCustomerRequest(token, customer.id);
    },
    onSuccess: async (_data, customer) => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKey });
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      setDeletingCustomer(null);
      toast.success(`Pelanggan "${customer.name}" berhasil dihapus.`);
    },
    onError: (error) => {
      setDeletingCustomer(null);
      toast.error(getErrorMessage(error, "Gagal menghapus pelanggan."));
    },
  });

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = customersQuery.data ?? [];

    return rows
      .filter((customer) => {
        if (!query) return true;
        return (
          customer.name.toLowerCase().includes(query) ||
          customer.phone.toLowerCase().includes(query) ||
          (customer.address ?? "").toLowerCase().includes(query) ||
          (customer.notes ?? "").toLowerCase().includes(query)
        );
      })
      .sort((first, second) => compareCustomers(first, second, sort));
  }, [customersQuery.data, search, sort]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const openCreateForm = (): void => {
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const openEditForm = (customer: Customer): void => {
    setEditingCustomer(customer);
    setFormOpen(true);
  };

  const handleSave = async (input: CustomerInput): Promise<void> => {
    if (!token) {
      throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
    }

    if (editingCustomer) {
      await updateCustomerRequest(token, editingCustomer.id, input);
    } else {
      await createCustomerRequest(token, input);
    }

    await queryClient.invalidateQueries({ queryKey: customersQueryKey });
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    toast.success(
      editingCustomer
        ? "Pelanggan berhasil diperbarui."
        : "Pelanggan baru berhasil ditambahkan.",
    );
  };

  return (
    <>
      <PageHeader
        title="Data Pelanggan"
        description="Simpan data pelanggan agar transaksi berikutnya lebih cepat dicatat."
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="size-4" />
            Tambah Pelanggan
          </Button>
        }
      />

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, nomor HP, alamat, atau catatan… (Ctrl+K)"
              className="pl-9"
              aria-label="Cari pelanggan"
              aria-keyshortcuts="Control+K"
            />
          </div>
          <Select
            value={sort}
            onValueChange={(value) => {
              if (isCustomerSort(value)) {
                setSort(value);
                setPage(1);
              }
            }}
          >
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label="Urutkan pelanggan"
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
        </CardContent>
      </Card>

      {customersQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat data pelanggan
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(customersQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void customersQuery.refetch()}
              disabled={customersQuery.isFetching}
            >
              <RefreshCw
                className={
                  customersQuery.isFetching ? "size-4 animate-spin" : "size-4"
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
                <TableHead>Nama</TableHead>
                <TableHead>No. HP</TableHead>
                <TableHead className="hidden md:table-cell">Alamat</TableHead>
                <TableHead className="hidden text-center lg:table-cell">
                  Order
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  Diperbarui
                </TableHead>
                <TableHead className="w-12 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="mx-auto h-5 w-10" />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto size-8 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="whitespace-normal py-0">
                    <EmptyState
                      icon={search.trim() ? Search : Users}
                      title={
                        search.trim()
                          ? "Pelanggan tidak ditemukan"
                          : "Belum ada pelanggan"
                      }
                      description={
                        search.trim()
                          ? "Coba ubah kata kunci pencarian."
                          : "Tambahkan pelanggan pertama atau buat order baru."
                      }
                      action={
                        search.trim() ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSearch("");
                              setPage(1);
                            }}
                          >
                            Reset pencarian
                          </Button>
                        ) : (
                          <Button onClick={openCreateForm}>
                            <Plus className="size-4" />
                            Tambah Pelanggan
                          </Button>
                        )
                      }
                      className="border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium text-foreground">
                        {customer.name}
                      </p>
                      {customer.notes ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {customer.notes}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {customer.phone}
                    </TableCell>
                    <TableCell className="hidden max-w-64 whitespace-normal text-muted-foreground md:table-cell">
                      {customer.address || "—"}
                    </TableCell>
                    <TableCell className="hidden text-center lg:table-cell">
                      <Badge variant="outline">{customer.order_count}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {formatTanggalWaktu(customer.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Aksi untuk ${customer.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => openEditForm(customer)}
                          >
                            <Pencil className="size-4" />
                            Ubah
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeletingCustomer(customer)}
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

          {!customersQuery.isLoading && visibleCustomers.length > 0 ? (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredCustomers.length}
              onPageChange={setPage}
              itemLabel="pelanggan"
            />
          ) : null}
        </Card>
      )}

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editingCustomer}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deletingCustomer)}
        onOpenChange={(open) => {
          if (!open) setDeletingCustomer(null);
        }}
        title="Hapus pelanggan?"
        description={
          deletingCustomer
            ? `Pelanggan "${deletingCustomer.name}" akan dihapus. ${deletingCustomer.order_count > 0 ? "Order lama tetap menyimpan salinan nama dan nomor HP pelanggan." : "Data ini belum memiliki order."}`
            : ""
        }
        confirmLabel="Hapus Pelanggan"
        pendingLabel="Menghapus…"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingCustomer) deleteMutation.mutate(deletingCustomer);
        }}
      />
    </>
  );
}
