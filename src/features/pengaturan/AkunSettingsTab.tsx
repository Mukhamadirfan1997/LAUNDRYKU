import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
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
import type { UserRole } from "@/db/types";
import { useAuthStore } from "@/features/auth/auth-store";
import { roleLabels } from "@/features/auth/types";
import { getErrorMessage } from "@/lib/api";
import { formatTanggalWaktu } from "@/lib/format";

import { AccountFormDialog } from "./AccountFormDialog";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import {
  createAccountRequest,
  deleteAccountRequest,
  setAccountActiveRequest,
  updateAccountRequest,
} from "./settings-api";
import {
  fetchAccounts,
  fetchEmployees,
  settingsAccountsQueryKey,
  settingsActivityLogsQueryKey,
  settingsEmployeesQueryKey,
} from "./settings-queries";
import type {
  AccountCreateInput,
  AccountUpdateInput,
  AccountWithEmployee,
} from "./types";

const PAGE_SIZE = 8;

export function AkunSettingsTab() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<AccountWithEmployee | null>(null);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<AccountWithEmployee | null>(null);

  const accountsQuery = useQuery({
    queryKey: settingsAccountsQueryKey,
    queryFn: fetchAccounts,
  });

  const employeesQuery = useQuery({
    queryKey: settingsEmployeesQueryKey,
    queryFn: fetchEmployees,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: settingsAccountsQueryKey }),
      queryClient.invalidateQueries({ queryKey: settingsEmployeesQueryKey }),
      queryClient.invalidateQueries({ queryKey: settingsActivityLogsQueryKey }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (input: AccountCreateInput) => {
      if (!token) throw new Error("Sesi berakhir.");
      await createAccountRequest(token, input);
    },
    onSuccess: async () => {
      toast.success("Akun login baru berhasil dibuat.");
      await invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      accountId,
      input,
    }: {
      accountId: number;
      input: AccountUpdateInput;
    }) => {
      if (!token) throw new Error("Sesi berakhir.");
      await updateAccountRequest(token, accountId, input);
    },
    onSuccess: async () => {
      toast.success("Data akun login berhasil diperbarui.");
      await invalidate();
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      account,
      nextActive,
    }: {
      account: AccountWithEmployee;
      nextActive: boolean;
    }) => {
      if (!token) throw new Error("Sesi berakhir.");
      await setAccountActiveRequest(token, account.id, nextActive);
    },
    onSuccess: async (_, variables) => {
      toast.success(
        variables.nextActive
          ? `Akun "@${variables.account.username}" diaktifkan.`
          : `Akun "@${variables.account.username}" dinonaktifkan.`,
      );
      await invalidate();
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal mengubah status akun. Silakan coba lagi."),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (account: AccountWithEmployee) => {
      if (!token) throw new Error("Sesi berakhir.");
      await deleteAccountRequest(token, account.id);
    },
    onSuccess: async (_, account) => {
      toast.success(`Akun "@${account.username}" berhasil dihapus.`);
      setDeleteTarget(null);
      await invalidate();
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal menghapus akun. Silakan coba lagi."),
      );
    },
  });

  // Calculate active admin count to disable deactivation/deletion of the last admin
  const activeAdminCount = useMemo(() => {
    return (
      accountsQuery.data?.filter(
        (acc) => acc.role === "admin" && acc.is_active === 1,
      ).length ?? 0
    );
  }, [accountsQuery.data]);

  const filteredAccounts = useMemo(() => {
    const list = accountsQuery.data ?? [];
    return list.filter((item) => {
      if (roleFilter !== "all" && item.role !== roleFilter) return false;
      if (statusFilter !== "all") {
        const wantActive = statusFilter === "active" ? 1 : 0;
        if (item.is_active !== wantActive) return false;
      }
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchUser = item.username.toLowerCase().includes(query);
        const matchEmp = (item.employee_name ?? "").toLowerCase().includes(query);
        if (!matchUser && !matchEmp) return false;
      }
      return true;
    });
  }, [accountsQuery.data, roleFilter, search, statusFilter]);

  const pagedAccounts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAccounts.slice(start, start + PAGE_SIZE);
  }, [filteredAccounts, page]);

  const isOwnAccount = (acc: AccountWithEmployee) =>
    currentUser?.id === acc.id;

  const isLastActiveAdmin = (acc: AccountWithEmployee) =>
    acc.role === "admin" && acc.is_active === 1 && activeAdminCount <= 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari username, nama pegawai..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>

              <Select
                value={roleFilter}
                onValueChange={(val) => {
                  setRoleFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
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
                onClick={() => accountsQuery.refetch()}
                disabled={accountsQuery.isFetching}
                title="Muat ulang"
              >
                <RefreshCw
                  className={`size-4 ${
                    accountsQuery.isFetching ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPasswordDialogOpen(true)}
              >
                <KeyRound className="size-4" />
                Ubah Password Saya
              </Button>
              <Button
                onClick={() => {
                  setEditingAccount(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                Buat Akun
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Pegawai Terhubung</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Login Terakhir</TableHead>
                  <TableHead className="w-[90px] text-center">Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountsQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-5 w-9 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="size-8" /></TableCell>
                    </TableRow>
                  ))
                ) : pagedAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 p-0">
                      <EmptyState
                        icon={UserCheck}
                        title="Tidak ada akun login ditemukan"
                        description={
                          search || roleFilter !== "all" || statusFilter !== "all"
                            ? "Coba ubah kata kunci atau bersihkan filter."
                            : "Buat akun login pertama untuk staf Anda."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedAccounts.map((acc) => {
                    const isSelf = isOwnAccount(acc);
                    const isLastAdmin = isLastActiveAdmin(acc);
                    return (
                      <TableRow key={acc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>@{acc.username}</span>
                            {isSelf ? (
                              <Badge variant="outline" className="text-[10px]">
                                Anda
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Dibuat {formatTanggalWaktu(acc.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {acc.employee_name ? (
                            <div>
                              <div className="text-xs font-medium text-foreground">
                                {acc.employee_name}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                Jabatan: {acc.employee_position ?? "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              Tidak terhubung
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              acc.role === "admin"
                                ? "default"
                                : acc.role === "kasir"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="capitalize"
                          >
                            {roleLabels[acc.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {acc.last_login_at
                            ? formatTanggalWaktu(acc.last_login_at)
                            : "Belum pernah login"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={acc.is_active === 1}
                            disabled={
                              isSelf ||
                              (acc.is_active === 1 && isLastAdmin) ||
                              (acc.is_active === 0 && acc.employee_active !== 1) ||
                              toggleActiveMutation.isPending
                            }
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({
                                account: acc,
                                nextActive: checked,
                              })
                            }
                            aria-label={`Ubah status @${acc.username}`}
                            title={
                              isSelf
                                ? "Tidak dapat menonaktifkan akun sendiri"
                                : isLastAdmin
                                  ? "Satu-satunya akun admin aktif"
                                  : acc.is_active === 0 && acc.employee_active !== 1
                                    ? "Aktifkan pegawai terlebih dahulu"
                                    : undefined
                            }
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
                                onClick={() => {
                                  setEditingAccount(acc);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="mr-2 size-4" />
                                Ubah Akun
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={isSelf || isLastAdmin}
                                onClick={() => setDeleteTarget(acc)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                {isSelf
                                  ? "Hapus (akun Anda)"
                                  : isLastAdmin
                                    ? "Hapus (admin terakhir)"
                                    : "Hapus Akun"}
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

          {filteredAccounts.length > PAGE_SIZE ? (
            <TablePagination
              page={page}
              total={filteredAccounts.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="akun"
            />
          ) : null}
        </CardContent>
      </Card>

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editingAccount}
        employees={employeesQuery.data ?? []}
        isOwnAccount={editingAccount ? isOwnAccount(editingAccount) : false}
        onSaveCreate={async (input) => {
          await createMutation.mutateAsync(input);
        }}
        onSaveUpdate={async (input) => {
          if (!editingAccount) return;
          await updateMutation.mutateAsync({
            accountId: editingAccount.id,
            input,
          });
        }}
      />

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Hapus Akun Pengguna"
        description={`Apakah Anda yakin ingin menghapus akun login "@${deleteTarget?.username}"? Riwayat aktivitas yang dibuat oleh akun ini akan tetap tersimpan.`}
        confirmLabel="Hapus Akun"
        pendingLabel="Menghapus..."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />
    </div>
  );
}
