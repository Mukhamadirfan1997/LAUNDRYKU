import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Info, Loader2, ReceiptText, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/auth-store";
import { logActivityRequest } from "@/features/auth/auth-api";
import { getErrorMessage } from "@/lib/api";
import {
  notifyFileSaved,
  openSavedFile,
  saveFileWithDialog,
} from "@/lib/export";
import { formatRupiah } from "@/lib/format";
import {
  buildReceiptPdf,
  type ReceiptFormat,
} from "@/lib/receipt-pdf";

import {
  businessProfileQueryKey,
  fetchBusinessProfile,
  fetchOrderDetail,
  orderDetailQueryKey,
} from "./orders-queries";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number | null;
}

const formatOptions: Array<{ value: ReceiptFormat; label: string }> = [
  { value: "58mm", label: "Thermal 58 mm" },
  { value: "80mm", label: "Thermal 80 mm" },
  { value: "a5", label: "A5" },
];

export function ReceiptDialog({
  open,
  onOpenChange,
  orderId,
}: ReceiptDialogProps) {
  const token = useAuthStore((state) => state.token);
  const [format, setFormat] = useState<ReceiptFormat>("80mm");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormat("80mm");
    setFormError(null);
  }, [open]);

  const detailQuery = useQuery({
    queryKey: orderDetailQueryKey(orderId ?? 0),
    queryFn: () => fetchOrderDetail(orderId ?? 0),
    enabled: open && Boolean(orderId),
  });
  const profileQuery = useQuery({
    queryKey: businessProfileQueryKey,
    queryFn: fetchBusinessProfile,
    enabled: open,
  });

  const order = detailQuery.data ?? null;

  const handleDownload = async (): Promise<void> => {
    if (!order) return;

    setFormError(null);
    setIsSaving(true);

    try {
      const result = buildReceiptPdf(
        order,
        profileQuery.data ?? null,
        format,
      );
      const path = await saveFileWithDialog(result.bytes, {
        defaultFileName: result.fileName,
        filters: [{ name: "Berkas PDF", extensions: ["pdf"] }],
      });

      if (!path) return;

      toast.success("Struk berhasil disimpan.", {
        action: {
          label: "Buka file",
          onClick: () => {
            void openSavedFile(path).catch(() => {
              toast.error("File tersimpan, tetapi tidak dapat dibuka otomatis.");
            });
          },
        },
      });
      void notifyFileSaved("Struk LaundryKu tersimpan", path);

      if (token) {
        try {
          await logActivityRequest(token, {
            action: "export",
            entity: "orders",
            entityId: order.id,
            description: `Menyimpan struk ${order.order_number} (${format})`,
          });
        } catch (error) {
          console.warn("Gagal mencatat log ekspor struk:", error);
        }
      }
    } catch (error) {
      setFormError(
        getErrorMessage(error, "Gagal menyimpan struk PDF. Silakan coba lagi."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-w-md"
        showCloseButton={!isSaving}
        onEscapeKeyDown={(event) => {
          if (isSaving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isSaving) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" />
            Struk PDF
          </DialogTitle>
          <DialogDescription>
            {order
              ? `${order.order_number} · ${order.customer_name}`
              : "Menyiapkan data struk…"}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : detailQuery.isError ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{getErrorMessage(detailQuery.error)}</p>
          </div>
        ) : !order ? (
          <p className="text-sm text-muted-foreground">
            Data order tidak ditemukan. Muat ulang daftar order.
          </p>
        ) : (
          <div className="space-y-4">
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p className="leading-relaxed">{formError}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Total</p>
                <p className="font-semibold text-foreground">
                  {formatRupiah(order.total)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Sisa bayar</p>
                <p className="font-semibold text-primary">
                  {formatRupiah(order.remaining_amount)}
                </p>
              </div>
              <div className="col-span-2 text-[11px] text-muted-foreground">
                {order.items.length} baris item · {order.payments.length}{" "}
                pembayaran tercatat
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ukuran struk</Label>
              <Select
                value={format}
                onValueChange={(value) => setFormat(value as ReceiptFormat)}
                disabled={isSaving}
              >
                <SelectTrigger aria-label="Ukuran struk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                File disimpan melalui dialog Save As. Header struk memakai nama,
                alamat, dan telepon dari profil usaha.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Tutup
          </Button>
          <Button
            type="button"
            onClick={() => void handleDownload()}
            disabled={
              isSaving ||
              !order ||
              detailQuery.isLoading ||
              profileQuery.isLoading
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>
                <Download className="size-4" />
                Unduh PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
