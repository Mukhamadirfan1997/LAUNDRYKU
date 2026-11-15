import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/auth-store";
import { bootstrapQueryKey } from "@/db/queries/bootstrap";
import { getErrorMessage } from "@/lib/api";
import { formatAngka, formatRupiah, todayIso } from "@/lib/format";

import { createOrderRequest } from "./orders-api";
import { customersQueryKey, fetchCustomers } from "./customers-queries";
import { ordersQueryKey } from "./orders-queries";
import {
  fetchItems,
  fetchServices,
  itemsQueryKey,
  servicesQueryKey,
} from "@/features/operasional/catalog-queries";
import type { OrderLineInput } from "./types";

interface DraftLine {
  key: string;
  lineType: "service" | "item";
  refId: number;
  name: string;
  unit: string;
  price: string;
  qty: string;
}

function parseQty(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineSubtotal(line: DraftLine): number {
  const price = Number(line.price || "0");
  if (!Number.isFinite(price)) return 0;
  return Math.round(price * parseQty(line.qty));
}

export function OrderFormPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const servicesQuery = useQuery({
    queryKey: servicesQueryKey,
    queryFn: fetchServices,
  });
  const itemsQuery = useQuery({
    queryKey: itemsQueryKey,
    queryFn: fetchItems,
  });
  const customersQuery = useQuery({
    queryKey: customersQueryKey,
    queryFn: fetchCustomers,
  });

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderDate, setOrderDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const activeServices = useMemo(
    () => (servicesQuery.data ?? []).filter((service) => service.is_active === 1),
    [servicesQuery.data],
  );
  const activeItems = useMemo(
    () => (itemsQuery.data ?? []).filter((item) => item.is_active === 1),
    [itemsQuery.data],
  );

  const customerMatches = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return [];

    return (customersQuery.data ?? [])
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.phone.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [customerSearch, customersQuery.data]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + lineSubtotal(line), 0),
    [lines],
  );

  const createMutation = useMutation({
    mutationFn: async (input: {
      customerId: number | null;
      customerName: string;
      customerPhone: string;
      orderDate: string;
      notes: string | null;
      lines: OrderLineInput[];
    }) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      return createOrderRequest(token, input);
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      await queryClient.invalidateQueries({ queryKey: customersQueryKey });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      toast.success(`Order ${created.orderNumber} berhasil dibuat.`);
      await navigate({
        to: "/transaksi/antrian",
        search: { order: created.id },
      });
    },
    onError: (error) => {
      setFormError(
        getErrorMessage(error, "Gagal menyimpan transaksi. Silakan coba lagi."),
      );
    },
  });

  const addLine = (
    lineType: DraftLine["lineType"],
    refId: number,
    name: string,
    unit: string,
    price: number,
  ) => {
    setLines((current) => {
      const existing = current.find(
        (line) => line.lineType === lineType && line.refId === refId,
      );
      if (existing) {
        return current.map((line) =>
          line.key === existing.key
            ? { ...line, qty: String(parseQty(line.qty) + 1) }
            : line,
        );
      }

      return [
        ...current,
        {
          key: crypto.randomUUID(),
          lineType,
          refId,
          name,
          unit,
          price: String(price),
          qty: "1",
        },
      ];
    });
  };

  const addSelectedService = () => {
    const id = Number(selectedServiceId);
    const service = activeServices.find((item) => item.id === id);
    if (!service) return;
    addLine(
      "service",
      service.id,
      `${service.category} - ${service.speed}`,
      service.unit,
      service.price,
    );
    setSelectedServiceId("");
  };

  const addSelectedItem = () => {
    const id = Number(selectedItemId);
    const item = activeItems.find((entry) => entry.id === id);
    if (!item) return;
    addLine("item", item.id, item.name, item.unit, item.price);
    setSelectedItemId("");
  };

  const updateLine = (
    key: string,
    field: "price" | "qty",
    value: string,
  ) => {
    if (field === "price" && value !== "" && !/^\d+$/.test(value)) return;
    if (
      field === "qty" &&
      value !== "" &&
      !/^\d*(?:[.,]\d*)?$/.test(value)
    ) {
      return;
    }

    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const handleSubmit = async (): Promise<void> => {
    setFormError(null);

    const name = customerName.trim();
    const phone = customerPhone.trim();

    if (name.length < 2) {
      setFormError("Nama pelanggan minimal 2 karakter.");
      return;
    }
    if (phone.length < 6) {
      setFormError("Nomor HP pelanggan minimal 6 karakter.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Tambahkan minimal satu layanan atau barang.");
      return;
    }

    const invalidQty = lines.some((line) => {
      const qty = parseQty(line.qty);
      return !Number.isFinite(qty) || qty <= 0;
    });
    if (invalidQty) {
      setFormError("Jumlah (qty) setiap item harus lebih dari 0.");
      return;
    }

    const invalidPrice = lines.some((line) => {
      const price = Number(line.price || "0");
      return !Number.isFinite(price) || price < 0;
    });
    if (invalidPrice) {
      setFormError("Harga setiap item harus berupa angka yang valid.");
      return;
    }
    if (total <= 0) {
      setFormError("Total order harus lebih dari 0.");
      return;
    }

    await createMutation.mutateAsync({
      customerId,
      customerName: name,
      customerPhone: phone,
      orderDate,
      notes: notes.trim() ? notes.trim() : null,
      lines: lines.map((line) => ({
        lineType: line.lineType,
        refId: line.refId,
        price: Number(line.price || "0"),
        qty: parseQty(line.qty),
      })),
    });
  };

  const isLoadingCatalogs =
    servicesQuery.isLoading || itemsQuery.isLoading || customersQuery.isLoading;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      noValidate
    >
      <PageHeader
        title="Transaksi Baru"
        description="Catat order laundry dan rincian layanan dalam satu transaksi."
        actions={
          <Button asChild variant="outline">
            <Link to="/transaksi/antrian">
              <ArrowLeft className="size-4" />
              Kembali
            </Link>
          </Button>
        }
      />

      {formError ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{formError}</p>
        </div>
      ) : null}

      {isLoadingCatalogs ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Memuat data layanan, barang, dan pelanggan…
        </div>
      ) : null}

      {servicesQuery.isError || itemsQuery.isError || customersQuery.isError ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:text-amber-300">
          <span>
            Sebagian data pendukung gagal dimuat. Periksa koneksi database lalu
            coba lagi.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void servicesQuery.refetch();
              void itemsQuery.refetch();
              void customersQuery.refetch();
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <div className="space-y-4">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-primary" />
                Pelanggan & tanggal
              </CardTitle>
              <CardDescription>
                Pilih pelanggan lama atau ketik pelanggan baru.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label htmlFor="customer-search">Cari pelanggan</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="customer-search"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Nama atau nomor HP…"
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
                {customerSearch.trim() ? (
                  <div className="overflow-hidden rounded-lg border bg-popover shadow-sm">
                    {customerMatches.length > 0 ? (
                      customerMatches.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                          onClick={() => {
                            setCustomerId(customer.id);
                            setCustomerName(customer.name);
                            setCustomerPhone(customer.phone);
                            setCustomerSearch("");
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {customer.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {customer.phone}
                            </span>
                          </span>
                          <Badge variant="outline">
                            {customer.order_count} order
                          </Badge>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2.5 text-xs text-muted-foreground">
                        Pelanggan baru akan dibuat otomatis saat order disimpan.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">
                    Nama pelanggan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(event) => {
                      setCustomerName(event.target.value);
                      setCustomerId(null);
                    }}
                    placeholder="Contoh: Ibu Sari"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">
                    Nomor HP <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customer-phone"
                    value={customerPhone}
                    onChange={(event) => {
                      setCustomerPhone(event.target.value);
                      setCustomerId(null);
                    }}
                    placeholder="0812xxxxxxx"
                    inputMode="tel"
                    autoComplete="off"
                  />
                </div>
              </div>

              {customerId ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
                  <Badge variant="secondary">Pelanggan tersimpan</Badge>
                  Mengubah nomor HP akan membuat pelanggan baru.
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="order-date">
                    Tanggal order <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="order-date"
                    type="date"
                    value={orderDate}
                    onChange={(event) => setOrderDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="order-notes">Catatan order</Label>
                  <Textarea
                    id="order-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Contoh: pisahkan pakaian putih, tanpa pewangi."
                    maxLength={500}
                    className="min-h-16"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="size-4 text-primary" />
                Rincian layanan & barang
              </CardTitle>
              <CardDescription>
                Harga dapat disesuaikan per baris. Qty boleh desimal untuk
                layanan berbasis berat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Layanan</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedServiceId}
                      onValueChange={setSelectedServiceId}
                      disabled={activeServices.length === 0}
                    >
                      <SelectTrigger aria-label="Pilih layanan">
                        <SelectValue placeholder="Pilih layanan…" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeServices.map((service) => (
                          <SelectItem key={service.id} value={String(service.id)}>
                            {service.category} - {service.speed} ·{" "}
                            {formatRupiah(service.price)}/{service.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addSelectedService}
                      disabled={!selectedServiceId}
                      aria-label="Tambah layanan"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  {activeServices.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Belum ada layanan aktif. Admin dapat menambahkannya di
                      Master Layanan.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Barang tambahan</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedItemId}
                      onValueChange={setSelectedItemId}
                      disabled={activeItems.length === 0}
                    >
                      <SelectTrigger aria-label="Pilih barang">
                        <SelectValue placeholder="Pilih barang…" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeItems.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name} · {formatRupiah(item.price)}/{item.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addSelectedItem}
                      disabled={!selectedItemId}
                      aria-label="Tambah barang"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  {activeItems.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Belum ada barang aktif. Barang tambahan bersifat opsional.
                    </p>
                  ) : null}
                </div>
              </div>

              {lines.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Belum ada item"
                  description="Pilih layanan atau barang di atas, lalu tekan tombol tambah."
                  className="py-8"
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-28 text-right">Harga</TableHead>
                        <TableHead className="w-24 text-right">Qty</TableHead>
                        <TableHead className="w-32 text-right">
                          Subtotal
                        </TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => (
                        <TableRow key={line.key}>
                          <TableCell className="whitespace-normal">
                            <p className="font-medium text-foreground">
                              {line.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant="outline">
                                {line.lineType === "service"
                                  ? "Layanan"
                                  : "Barang"}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                per {line.unit}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.price}
                              onChange={(event) =>
                                updateLine(
                                  line.key,
                                  "price",
                                  event.target.value,
                                )
                              }
                              inputMode="numeric"
                              className="ml-auto h-8 w-24 text-right"
                              aria-label={`Harga ${line.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.qty}
                              onChange={(event) =>
                                updateLine(line.key, "qty", event.target.value)
                              }
                              inputMode="decimal"
                              className="ml-auto h-8 w-20 text-right"
                              aria-label={`Qty ${line.name}`}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatRupiah(lineSubtotal(line))}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeLine(line.key)}
                              aria-label={`Hapus ${line.name}`}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="gap-0 py-0 lg:sticky lg:top-20">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-base">Ringkasan order</CardTitle>
            <CardDescription>
              Total dihitung otomatis dari harga dan qty.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Jumlah baris</span>
              <span className="font-medium text-foreground">{lines.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total qty</span>
              <span className="font-medium text-foreground">
                {formatAngka(
                  lines.reduce((sum, line) => sum + parseQty(line.qty), 0),
                )}
              </span>
            </div>
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Total tagihan
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-primary">
                {formatRupiah(total)}
              </p>
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={createMutation.isPending || lines.length === 0}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan…
                </>
              ) : (
                "Simpan Order"
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Pembayaran dapat dicatat setelah order tersimpan.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
