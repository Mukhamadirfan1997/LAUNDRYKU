import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
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
import type { EmployeePosition } from "@/db/types";
import { useAuthStore } from "@/features/auth/auth-store";
import { getErrorMessage } from "@/lib/api";
import { formatTanggalWaktu } from "@/lib/format";

import { EmployeeFormDialog } from "./EmployeeFormDialog";
import {
  createEmployeeRequest,
  deleteEmployeeRequest,
  setEmployeeActiveRequest,
  updateEmployeeRequest,
} from "./settings-api";
import {
  fetchEmployees,
  settingsAccountsQueryKey,
  settingsActivityLogsQueryKey,
  settingsEmployeesQueryKey,
} from "./settings-queries";
import type { EmployeeInput, EmployeeWithAccountCount } from "./types";
import { positionLabels } from "./types";

const PAGE_SIZE = 8;

export function PegawaiSettingsTab() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeWithAccountCount | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<EmployeeWithAccountCount | null>(null);

  const employeesQuery = useQuery({
    queryKey: settingsEmployeesQueryKey,
    queryFn: fetchEmployees,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: settingsEmployeesQueryKey }),
      queryClient.invalidateQueries({ queryKey: settingsAccountsQueryKey }),
      queryClient.invalidateQueries({ queryKey: settingsActivityLogsQueryKey }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (input: EmployeeInput) => {
      if (!token) throw new Error("Sesi berakhir.");
      if (editingEmployee) {
        await updateEmployeeRequest(token, editingEmployee.id, input);
      } else {
        await createEmployeeRequest(token, input);
      }
    },
    onSuccess: async () => {
      toast.success(
        editingEmployee
          ? "Data pegawai berhasil diperbarui."
          : "Pegawai baru berhasil ditambahkan.",
      );
      await invalidate();
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      employee,
      nextActive,
    }: {
      employee: EmployeeWithAccountCount;
      nextActive: boolean;
    }) => {
      if (!token) throw new Error("Sesi berakhir.");
      await setEmployeeActiveRequest(token, employee.id, nextActive);
    },
    onSuccess: async (_, variables) => {
      toast.success(
        variables.nextActive
          ? `Pegawai "${variables.employee.name}" diaktifkan.`
          : `Pegawai "${variables.employee.name}" dinonaktifkan beserta akun loginnya.`,
      );
      await invalidate();
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(
          error,
          "Gagal mengubah status pegawai. Silakan coba lagi.",
        ),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (employee: EmployeeWithAccountCount) => {
      if (!token) throw new Error("Sesi berakhir.");
      await deleteEmployeeRequest(token, employee.id);
    },
    onSuccess: async (_, employee) => {
      toast.success(`Pegawai "${employee.name}" berhasil dihapus.`);
      setDeleteTarget(null);
      await invalidate();
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal menghapus pegawai. Silakan coba lagi."),
      );
    },
  });

  const filteredEmployees = useMemo(() => {
    const list = employeesQuery.data ?? [];
    return list.filter((item) => {
      if (positionFilter !== "all" && item.position !== positionFilter) {
        return false;
      }
      if (statusFilter !== "all") {
        const wantActive = statusFilter === "active" ? 1 : 0;
        if (item.is_active !== wantActive) return false;
      }
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchPhone = (item.phone ?? "").toLowerCase().includes(query);
        const matchUsername = (item.account_username ?? "")
          .toLowerCase()
          .includes(query);
        if (!matchName && !matchPhone && !matchUsername) return false;
      }
      return true;
    });
  }, [employeesQuery.data, positionFilter, search, statusFilter]);

  const pagedEmployees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, page]);

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (employee: EmployeeWithAccountCount) => {
    setEditingEmployee(employee);
    setFormOpen(true);
  };

  const isOwnEmployee = (employee: EmployeeWithAccountCount) =>
    currentUser?.employeeId === employee.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, telepon, akun..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>

              <Select
                value={positionFilter}
                onValueChange={(val) => {
                  setPositionFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Jabatan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jabatan</SelectItem>
                  {(Object.keys(positionLabels) as EmployeePosition[]).map(
                    (pos) => (
                      <SelectItem key={pos} value={pos}>
                        {positionLabels[pos]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => employeesQuery.refetch()}
                disabled={employeesQuery.isFetching}
                title="Muat ulang"
              >
                <RefreshCw
                  className={`size-4 ${
                    employeesQuery.isFetching ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>

            <Button onClick={handleOpenCreate}>
              <Plus className="size-4" />
              Tambah Pegawai
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Pegawai</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>No. Telepon / Alamat</TableHead>
                  <TableHead>Akun Terhubung</TableHead>
                  <TableHead className="w-[90px] text-center">Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeesQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-5 w-9 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="size-8" /></TableCell>
                    </TableRow>
                  ))
                ) : pagedEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 p-0">
                      <EmptyState
                        icon={Users}
                        title="Tidak ada pegawai ditemukan"
                        description={
                          search || positionFilter !== "all" || statusFilter !== "all"
                            ? "Coba ubah kata kunci atau bersihkan filter."
                            : "Tambahkan data pegawai pertama Anda."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedEmployees.map((emp) => {
                    const isSelf = isOwnEmployee(emp);
                    const hasAccount = emp.account_count > 0;
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{emp.name}</span>
                            {isSelf ? (
                              <Badge variant="outline" className="text-[10px]">
                                Anda
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Diperbarui {formatTanggalWaktu(emp.updated_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              emp.position === "Admin"
                                ? "default"
                                : emp.position === "Kasir"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {emp.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{emp.phone || "—"}</div>
                          {emp.address ? (
                            <div className="max-w-[200px] truncate" title={emp.address}>
                              {emp.address}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {hasAccount ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-medium text-foreground">
                                @{emp.account_username}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              Belum dibuatkan akun
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={emp.is_active === 1}
                            disabled={isSelf || toggleActiveMutation.isPending}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({
                                employee: emp,
                                nextActive: checked,
                              })
                            }
                            aria-label={`Ubah status ${emp.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(emp)}
                              >
                                <Pencil className="mr-2 size-4" />
                                Ubah Data
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={isSelf || hasAccount}
                                onClick={() => setDeleteTarget(emp)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                {hasAccount
                                  ? "Hapus (punya akun)"
                                  : isSelf
                                    ? "Hapus (akun Anda)"
                                    : "Hapus Pegawai"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {filteredEmployees.length > PAGE_SIZE ? (
            <TablePagination
              page={page}
              total={filteredEmployees.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="pegawai"
            />
          ) : null}
        </CardContent>
      </Card>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        positionLocked={editingEmployee ? isOwnEmployee(editingEmployee) : false}
        onSave={async (input) => {
          await saveMutation.mutateAsync(input);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Hapus Pegawai"
        description={`Apakah Anda yakin ingin menghapus data pegawai "${deleteTarget?.name}"? Aksi ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Pegawai"
        pendingLabel="Menghapus..."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />
    </div>
  );
}
