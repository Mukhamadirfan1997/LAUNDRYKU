import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  FilterX,
  History,
  RefreshCw,
  Search,
} from "lucide-react";

import { TablePagination } from "@/components/common/TablePagination";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { ActivityAction } from "@/db/types";
import { formatTanggalWaktu } from "@/lib/format";

import {
  fetchActivityLogs,
  fetchActivityUsers,
  settingsActivityLogsQueryKey,
  settingsActivityUsersQueryKey,
} from "./settings-queries";
import {
  activityActionLabels,
  activityActionOptions,
  entityLabels,
} from "./types";

const PAGE_SIZE = 10;

function actionBadgeVariant(
  action: ActivityAction,
): "default" | "secondary" | "destructive" | "outline" {
  switch (action) {
    case "create":
    case "payment":
      return "default";
    case "update":
    case "status_change":
      return "secondary";
    case "delete":
      return "destructive";
    case "backup":
    case "restore":
    case "export":
    case "login":
    case "logout":
    default:
      return "outline";
  }
}

export function ActivityLogSettingsTab() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userName, setUserName] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const usersQuery = useQuery({
    queryKey: settingsActivityUsersQueryKey,
    queryFn: fetchActivityUsers,
  });

  const isDateInvalid = Boolean(
    startDate && endDate && startDate > endDate,
  );

  const logsQuery = useQuery({
    queryKey: [
      ...settingsActivityLogsQueryKey,
      { startDate, endDate, userName, action, search, page, pageSize: PAGE_SIZE },
    ],
    queryFn: () =>
      fetchActivityLogs({
        startDate,
        endDate,
        userName: userName === "all" ? "" : userName,
        action: action === "all" ? "" : (action as ActivityAction),
        search,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !isDateInvalid,
  });

  const hasFilter =
    Boolean(startDate) ||
    Boolean(endDate) ||
    userName !== "all" ||
    action !== "all" ||
    Boolean(search.trim());

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setUserName("all");
    setAction("all");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pengguna</Label>
              <Select
                value={userName}
                onValueChange={(val) => {
                  setUserName(val);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Pengguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pengguna</SelectItem>
                  {(usersQuery.data ?? []).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Aksi</Label>
              <Select
                value={action}
                onValueChange={(val) => {
                  setAction(val);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Aksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  {activityActionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pencarian</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Keterangan..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {isDateInvalid ? (
            <p className="text-xs text-destructive">
              Rentang tanggal tidak valid: tanggal awal tidak boleh lebih baru dari
              tanggal akhir.
            </p>
          ) : null}

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Total {logsQuery.data?.total ?? 0} log aktivitas tercatat
            </span>
            <div className="flex items-center gap-2">
              {hasFilter ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 text-xs text-muted-foreground"
                >
                  <FilterX className="mr-1.5 size-3.5" />
                  Bersihkan Filter
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => logsQuery.refetch()}
                disabled={logsQuery.isFetching}
              >
                <RefreshCw
                  className={`mr-1.5 size-3.5 ${
                    logsQuery.isFetching ? "animate-spin" : ""
                  }`}
                />
                Segarkan
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Waktu</TableHead>
                  <TableHead className="w-[130px]">Pengguna</TableHead>
                  <TableHead className="w-[110px]">Aksi</TableHead>
                  <TableHead className="w-[140px]">Modul / Data</TableHead>
                  <TableHead>Keterangan Aktivitas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full max-w-sm" /></TableCell>
                    </TableRow>
                  ))
                ) : (logsQuery.data?.rows.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 p-0">
                      <EmptyState
                        icon={History}
                        title="Tidak ada log aktivitas"
                        description={
                          hasFilter
                            ? "Coba sesuaikan rentang tanggal atau bersihkan filter."
                            : "Aktivitas pengguna seperti tambah data, pembayaran, dan ekspor akan tercatat otomatis di sini."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  logsQuery.data?.rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTanggalWaktu(log.created_at)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        @{log.user_name || "sistem"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionBadgeVariant(log.action)}>
                          {activityActionLabels[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.entity
                          ? entityLabels[log.entity] ?? log.entity
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        <div className="flex items-center gap-1.5">
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="break-words">{log.description}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {(logsQuery.data?.total ?? 0) > PAGE_SIZE ? (
            <TablePagination
              page={page}
              total={logsQuery.data?.total ?? 0}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="log"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
