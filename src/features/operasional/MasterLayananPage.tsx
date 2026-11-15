import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
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
import { getServiceName, type Service } from "@/db/types";
import { bootstrapQueryKey } from "@/db/queries/bootstrap";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah, formatTanggalWaktu } from "@/lib/format";

import { ServiceFormDialog } from "./ServiceFormDialog";
import {
  createServiceRequest,
  deleteServiceRequest,
  setServiceActiveRequest,
  updateServiceRequest,
  type ServiceInput,
} from "./catalog-api";
import {
  fetchServices,
  servicesQueryKey,
  type ServiceWithUsage,
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
] as const;

type ServiceStatusFilter = (typeof statusOptions)[number]["value"];
type ServiceSort = (typeof sortOptions)[number]["value"];

function compareServices(
  first: Service,
  second: Service,
  sort: ServiceSort,
): number {
  switch (sort) {
    case "name-desc":
      return getServiceName(second).localeCompare(getServiceName(first), "id", {
        sensitivity: "base",
      });
    case "price-asc":
      return first.price - second.price;
    case "price-desc":
      return second.price - first.price;
    default:
      return getServiceName(first).localeCompare(getServiceName(second), "id", {
        sensitivity: "base",
      });
  }
}

function isServiceSort(value: string): value is ServiceSort {
  return sortOptions.some((option) => option.value === value);
}

export function MasterLayananPage() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const token = useAuthStore((state) => state.token);
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  const servicesQuery = useQuery({
    queryKey: servicesQueryKey,
    queryFn: fetchServices,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ServiceStatusFilter>("all");
  const [sort, setSort] = useState<ServiceSort>("name-asc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] =
    useState<ServiceWithUsage | null>(null);

  const toggleMutation = useMutation({
    mutationFn: async (input: {
      service: Service;
      isActive: boolean;
    }) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await setServiceActiveRequest(
        token,
        input.service.id,
        input.isActive,
      );
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      toast.success(
        variables.isActive
          ? "Layanan berhasil diaktifkan."
          : "Layanan berhasil dinonaktifkan.",
      );
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal mengubah status layanan."),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (service: ServiceWithUsage) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await deleteServiceRequest(token, service.id);
    },
    onSuccess: async (_data, service) => {
      await queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      setDeletingService(null);
      toast.success(
        `Layanan "${getServiceName(service)}" berhasil dihapus.`,
      );
    },
    onError: (error) => {
      setDeletingService(null);
      toast.error(getErrorMessage(error, "Gagal menghapus layanan."));
    },
  });

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const data = servicesQuery.data ?? [];

    return data
      .filter((service) => {
        if (statusFilter === "active" && service.is_active !== 1) return false;
        if (statusFilter === "inactive" && service.is_active === 1) return false;
        if (!query) return true;
        return (
          service.category.toLowerCase().includes(query) ||
          service.speed.toLowerCase().includes(query) ||
          service.unit.toLowerCase().includes(query)
        );
      })
      .sort((first, second) => compareServices(first, second, sort));
  }, [search, servicesQuery.data, sort, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredServices.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleServices = filteredServices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const hasActiveFilter = search.trim().length > 0 || statusFilter !== "all";

  const openCreateForm = () => {
    setEditingService(null);
    setFormOpen(true);
  };

  const openEditForm = (service: Service) => {
    setEditingService(service);
    setFormOpen(true);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSort("name-asc");
    setPage(1);
  };

  const handleSave = async (input: ServiceInput) => {
    if (!token) {
      throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
    }

    if (editingService) {
      await updateServiceRequest(token, editingService.id, input);
    } else {
      await createServiceRequest(token, input);
    }

    await queryClient.invalidateQueries({ queryKey: servicesQueryKey });
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    toast.success(
      editingService
        ? "Layanan berhasil diperbarui."
        : "Layanan baru berhasil ditambahkan.",
    );
  };

  const tableColumnCount = isAdmin ? 6 : 5;

  return (
    <>
      <PageHeader
        title="Master Layanan"
        description="Kelola layanan laundry, termasuk layanan kustom, satuan, harga, dan status aktif."
        actions={
          isAdmin ? (
            <Button onClick={openCreateForm}>
              <Plus className="size-4" />
              Tambah Layanan
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
              placeholder="Cari kategori, kecepatan, atau satuan…"
              className="pl-9"
              aria-label="Cari layanan"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as ServiceStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="w-full sm:w-40"
                aria-label="Filter status layanan"
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
                if (isServiceSort(value)) {
                  setSort(value);
                  setPage(1);
                }
              }}
            >
              <SelectTrigger
                className="w-full sm:w-48"
                aria-label="Urutkan layanan"
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

      {servicesQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat master layanan
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(servicesQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void servicesQuery.refetch()}
              disabled={servicesQuery.isFetching}
            >
              <RefreshCw
                className={
                  servicesQuery.isFetching ? "size-4 animate-spin" : "size-4"
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
                <TableHead>Layanan</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Harga</TableHead>
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
              {servicesQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-44" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
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
              ) : visibleServices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumnCount}
                    className="whitespace-normal py-0"
                  >
                    <EmptyState
                      icon={hasActiveFilter ? Search : Sparkles}
                      title={
                        hasActiveFilter
                          ? "Layanan tidak ditemukan"
                          : "Belum ada layanan"
                      }
                      description={
                        hasActiveFilter
                          ? "Coba ubah kata kunci atau filter status."
                          : isAdmin
                            ? "Tambahkan layanan pertama untuk mulai mengelola harga dan status."
                            : "Belum ada layanan yang ditambahkan Admin."
                      }
                      action={
                        hasActiveFilter ? (
                          <Button variant="outline" onClick={resetFilters}>
                            Reset filter
                          </Button>
                        ) : isAdmin ? (
                          <Button onClick={openCreateForm}>
                            <Plus className="size-4" />
                            Tambah Layanan
                          </Button>
                        ) : undefined
                      }
                      className="border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleServices.map((service) => {
                  const isToggling =
                    toggleMutation.isPending &&
                    toggleMutation.variables?.service.id === service.id;
                  const label = getServiceName(service);

                  return (
                    <TableRow key={service.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium text-foreground">
                          {label}
                        </p>
                        {service.usage_count > 0 ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Dipakai {service.usage_count} baris transaksi
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {service.unit}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatRupiah(service.price)}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={service.is_active === 1}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  service,
                                  isActive: checked,
                                })
                              }
                              disabled={isToggling}
                              aria-label={
                                service.is_active === 1
                                  ? `Nonaktifkan ${label}`
                                  : `Aktifkan ${label}`
                              }
                            />
                            <span className="text-xs text-muted-foreground">
                              {service.is_active === 1 ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        ) : (
                          <ActiveBadge active={service.is_active === 1} />
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatTanggalWaktu(service.updated_at)}
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Aksi untuk ${label}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => openEditForm(service)}
                              >
                                <Pencil className="size-4" />
                                Ubah
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {service.usage_count > 0 ? (
                                <DropdownMenuItem disabled>
                                  <Trash2 className="size-4" />
                                  Hapus (dipakai)
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDeletingService(service)}
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

          {!servicesQuery.isLoading && visibleServices.length > 0 ? (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredServices.length}
              onPageChange={setPage}
              itemLabel="layanan"
            />
          ) : null}
        </Card>
      )}

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        service={editingService}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deletingService)}
        onOpenChange={(open) => {
          if (!open) setDeletingService(null);
        }}
        title="Hapus layanan?"
        description={
          deletingService
            ? `Layanan "${getServiceName(deletingService)}" akan dihapus permanen. Layanan yang sudah dipakai transaksi tidak dapat dihapus, nonaktifkan saja agar riwayat tetap utuh.`
            : ""
        }
        confirmLabel="Hapus Layanan"
        pendingLabel="Menghapus…"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingService) deleteMutation.mutate(deletingService);
        }}
      />
    </>
  );
}
