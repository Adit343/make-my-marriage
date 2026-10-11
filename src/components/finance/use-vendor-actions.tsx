"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { EventMenuItem } from "@/components/events/event-menu";
import { deleteVendor, updateVendor } from "@/components/finance/finance-api";
import { VendorDrawer, type VendorDrawerMode } from "@/components/finance/vendor-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { VENDOR_STATUSES, type VendorStatus } from "@/lib/constants/enums";
import { VENDOR_STATUS_LABEL } from "@/lib/finance/labels";
import type { VendorDto } from "@/modules/vendors/vendor.dto";

/**
 * Everything you can do to a vendor from the list or its own page: the add/edit slide-over,
 * changing the status, and deleting. Render `overlays` once.
 */
export function useVendorActions({
  weddingId,
  placesConfigured,
  afterDelete,
}: {
  weddingId: string;
  placesConfigured: boolean;
  /** Where to go after a delete (the detail page returns to the list); default: refresh in place. */
  afterDelete?: () => void;
}): {
  openDrawer: (mode: VendorDrawerMode) => void;
  setStatus: (vendor: VendorDto, status: VendorStatus) => Promise<void>;
  menuItems: (vendor: VendorDto, options?: { includeView?: boolean }) => EventMenuItem[];
  overlays: ReactNode;
} {
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState<VendorDrawerMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VendorDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function setStatus(vendor: VendorDto, status: VendorStatus) {
    if (status === vendor.status) return;
    try {
      await updateVendor(weddingId, vendor.id, vendor.version, { status });
      toast({
        type: "success",
        title: `Marked as ${VENDOR_STATUS_LABEL[status].toLowerCase()}`,
        message: vendor.name,
      });
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't change the status", message: errorMessage(error) });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const result = await deleteVendor(weddingId, pendingDelete.id);
      toast({
        type: "success",
        title: "Vendor deleted",
        message:
          result.expensesUnlinked > 0
            ? `${pendingDelete.name}. ${result.expensesUnlinked} ${result.expensesUnlinked === 1 ? "expense stays" : "expenses stay"} in your ledger.`
            : pendingDelete.name,
      });
      setPendingDelete(null);
      setDeleting(false);
      if (afterDelete) afterDelete();
      else router.refresh();
    } catch (error) {
      setDeleting(false);
      setPendingDelete(null);
      toast({ type: "error", title: "Couldn't delete the vendor", message: errorMessage(error) });
    }
  }

  function menuItems(vendor: VendorDto, options: { includeView?: boolean } = {}): EventMenuItem[] {
    return [
      ...(options.includeView === false
        ? []
        : [
            {
              icon: "visibility" as const,
              label: "View details",
              onSelect: () => router.push(`/dashboard/vendors/${vendor.id}`),
            },
          ]),
      {
        icon: "edit",
        label: "Edit vendor",
        onSelect: () => setDrawer({ kind: "edit", vendor }),
      },
      {
        icon: "sync_alt",
        label: "Change status",
        submenu: VENDOR_STATUSES.map((status) => ({
          label: VENDOR_STATUS_LABEL[status],
          active: vendor.status === status,
          onSelect: () => void setStatus(vendor, status),
        })),
      },
      {
        icon: "delete",
        label: "Delete vendor",
        danger: true,
        onSelect: () => setPendingDelete(vendor),
      },
    ];
  }

  const overlays = (
    <>
      {drawer ? (
        <VendorDrawer
          weddingId={weddingId}
          mode={drawer}
          placesConfigured={placesConfigured}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            router.refresh();
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this vendor?"
          confirmLabel="Delete vendor"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          <p>
            <strong className="font-semibold text-on-surface">{pendingDelete.name}</strong> will be
            removed from your vendors.
            {pendingDelete.money.expenseCount > 0
              ? ` Its ${pendingDelete.money.expenseCount} linked ${pendingDelete.money.expenseCount === 1 ? "expense stays" : "expenses stay"} in your ledger, just without the vendor.`
              : ""}
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );

  return { openDrawer: setDrawer, setStatus, menuItems, overlays };
}
