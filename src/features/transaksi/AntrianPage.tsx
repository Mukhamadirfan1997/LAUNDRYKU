import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  Eye,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";

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
import type { OrderStatus, PaymentStatus } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah, formatTanggal } from "@/lib/format";

import { OrderDetailDialog } from "./OrderDetailDialog";
import { OrderStatusBadge, PaymentStatusBadge } from "./OrderStatusBadge";
import { PaymentDialog } from "./PaymentDialog";
import { ReceiptDialog } from "./ReceiptDialog";
import { fetchOrders, ordersQueryKey } from "./orders-queries";
import type { OrderSummary } from "./types";

const PAGE_SIZE = 10;

const statusOptions: Array<{ value: "all" | OrderStatus; label: string }> = [
  { value: "all", label: "Semua status" },
  { value: "masuk", label: "Masuk" },
  { value: "proses", label: "Proses" },
  { value: "selesai", label: "Selesai" },
];

const paymentOptions: Array<{ value: "all" | PaymentStatus; label: string }> = [
  { value: "all", label: "Semua pembayaran" },
  { value: "belum_bayar", label: "Belum bayar" },
  { value: "dp", label: "DP" },
  { value: "lunas", label: "Lunas" },
];

const sortOptions = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "total-desc", label: "Total tertinggi" },
  { value: "total-asc", label: "Total terendah" },
  { value: "remaining-desc", label: "Sisa terbesar" },
] as const;

type StatusFilter = (typeof statusOptions)[number]["value"];
type PaymentFilter = (typeof paymentOptions)[number]["value"];
type OrderSort = (typeof sortOptions)[number]["value"];

function isOrderSort(value: string): value is OrderSort {
  return sortOptions.some((option) => option.value === value);
}

function compareOrders(first: OrderSummary, second: OrderSummary, sort: OrderSort) {
  switch (sort) {
    case "oldest":
      return first.id - second.id;
    case "total-desc":
      return second.total - first.total;
    case "total-asc":
      return first.total - second.total;
    case "remaining-desc":
      return second.remaining_amount - first.remaining_amount;
    default:
      return second.id - first.id;
  }
}

export function AntrianPage() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const canHandlePayment = role === "admin" || role === "kasir";
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/app/transaksi/antrian" });
  const searchRef = useRef<HTMLInputElement>(null);

  const ordersQuery = useQuery({
    queryKey: ordersQueryKey,
    queryFn: fetchOrders,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [page, setPage] = useState(1);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(
    searchParams.order ?? null,
  );
  const [paymentOrder, setPaymentOrder] = useState<OrderSummary | null>(null);
  const [receiptOrderId, setReceiptOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (searchParams.order) {
      setDetailOrderId(searchParams.order);
    }
  }, [searchParams.order]);

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

  const closeDetail = (): void => {
    setDetailOrderId(null);
    if (searchParams.order) {
      void navigate({
        to: "/transaksi/antrian",
        search: {},
        replace: true,
      });
    }
  };

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = ordersQuery.data ?? [];

    return rows
      .filter((order) => {
        if (statusFilter !== "all" && order.status !== statusFilter) return false;
        if (
          paymentFilter !== "all" &&
          order.payment_status !== paymentFilter
        ) {
          return false;
        }
        if (!query) return true;

        return (
          order.order_number.toLowerCase().includes(query) ||
          order.customer_name.toLowerCase().includes(query) ||
          order.customer_phone.toLowerCase().includes(query) ||
          (order.notes ?? "").toLowerCase().includes(query)
        );
      })
      .sort((first, second) => compareOrders(first, second, sort));
  }, [ordersQuery.data, paymentFilter, search, sort, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const hasActiveFilter =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    paymentFilter !== "all";

  const resetFilters = (): void => {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setSort("newest");
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Antrian Masuk"
        description="Daftar order laundry, status pengerjaan, dan sisa pembayaran."
        actions={
          canHandlePayment ? (
            <Button asChild>
              <Link to="/transaksi/baru">
                <Plus className="size-4" />
                Transaksi Baru
              </Link>
            </Button>
          ) : (
            <Badge variant="secondary">
              <Eye className="size-3.5" />
              Hanya lihat & ubah status
            </Badge>
          )
        }
      />

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Cari nomor order, pelanggan, atau HP… (Ctrl+K)"
              className="pl-9"
              aria-label="Cari order"
              aria-keyshortcuts="Control+K"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as StatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter status order">
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
              value={paymentFilter}
              onValueChange={(value) => {
                setPaymentFilter(value as PaymentFilter);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter status pembayaran">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(value) => {
                if (isOrderSort(value)) {
                  setSort(value);
                  setPage(1);
                }
              }}
            >
              <SelectTrigger aria-label="Urutkan order">
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

      {ordersQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat daftar order
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(ordersQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void ordersQuery.refetch()}
              disabled={ordersQuery.isFetching}
            >
              <RefreshCw
                className={
                  ordersQuery.isFetching ? "size-4 animate-spin" : "size-4"
                }
              />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Order</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead className="text-center">Item</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Dibayar</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pembayaran</TableHead>
                  <TableHead className="w-12 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 9 }).map((__, cell) => (
                        <TableCell key={cell}>
                          <Skeleton className="h-4 w-full max-w-28" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : visibleOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="whitespace-normal py-0">
                      <EmptyState
                        icon={hasActiveFilter ? Search : ReceiptText}
                        title={
                          hasActiveFilter
                            ? "Order tidak ditemukan"
                            : "Belum ada order"
                        }
                        description={
                          hasActiveFilter
                            ? "Coba ubah kata kunci atau filter."
                            : canHandlePayment
                              ? "Buat transaksi baru untuk mulai mencatat antrian laundry."
                              : "Belum ada order yang masuk."
                        }
                        action={
                          hasActiveFilter ? (
                            <Button variant="outline" onClick={resetFilters}>
                              Reset filter
                            </Button>
                          ) : canHandlePayment ? (
                            <Button asChild>
                              <Link to="/transaksi/baru">
                                <Plus className="size-4" />
                                Transaksi Baru
                              </Link>
                            </Button>
                          ) : undefined
                        }
                        className="border-0 bg-transparent"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {order.order_number}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatTanggal(order.order_date)}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium text-foreground">
                          {order.customer_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {order.customer_phone}
                        </p>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {order.item_count}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatRupiah(order.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatRupiah(order.paid_amount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-primary">
                        {formatRupiah(order.remaining_amount)}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={order.payment_status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Aksi untuk ${order.order_number}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => setDetailOrderId(order.id)}
                            >
                              <Eye className="size-4" />
                              Detail
                            </DropdownMenuItem>
                            {canHandlePayment ? (
                              <>
                                <DropdownMenuItem
                                  onSelect={() => setPaymentOrder(order)}
                                  disabled={order.remaining_amount <= 0}
                                >
                                  <CreditCard className="size-4" />
                                  {order.remaining_amount <= 0
                                    ? "Sudah lunas"
                                    : "Catat pembayaran"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => setReceiptOrderId(order.id)}
                                >
                                  <ReceiptText className="size-4" />
                                  Struk PDF
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!ordersQuery.isLoading && visibleOrders.length > 0 ? (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredOrders.length}
              onPageChange={setPage}
              itemLabel="order"
            />
          ) : null}
        </Card>
      )}

      <OrderDetailDialog
        open={detailOrderId !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        orderId={detailOrderId}
        onPay={(order) => setPaymentOrder(order)}
        onReceipt={(order) => setReceiptOrderId(order.id)}
      />

      <PaymentDialog
        open={paymentOrder !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentOrder(null);
        }}
        order={paymentOrder}
      />

      <ReceiptDialog
        open={receiptOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setReceiptOrderId(null);
        }}
        orderId={receiptOrderId}
      />
    </>
  );
}
