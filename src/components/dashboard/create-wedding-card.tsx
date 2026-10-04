"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { apiRequest, errorMessage } from "@/lib/client/api-client";

// Shown on the dashboard when the account has no wedding yet (e.g. after Google sign-in, or if
// the workspace step of signup failed). Not part of the Stitch screen; styled to match it.
export function CreateWeddingCard() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      toast({
        type: "error",
        title: "Name your workspace",
        message: "e.g. Ananya & Vikram's Wedding",
      });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/weddings", { method: "POST", body: { title: title.trim() } });
      toast({
        type: "success",
        title: "Wedding workspace created!",
        message: "Welcome to your dashboard.",
      });
      router.refresh();
    } catch (error) {
      setSubmitting(false);
      toast({
        type: "error",
        title: "Couldn't create the workspace",
        message: errorMessage(error),
      });
    }
  }

  return (
    <section className="elevation-1 relative overflow-hidden rounded-2xl border border-[#2A2622]/[0.05] bg-surface-container-lowest p-6 md:p-10">
      <div className="max-w-xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded bg-[#FAF3EC] px-2.5 py-1 font-label-sm text-[11px] font-semibold tracking-wider text-secondary uppercase">
          <Icon name="favorite" className="text-[14px]" />
          New workspace
        </div>
        <h3 className="mb-2 font-headline-md text-headline-md text-on-surface">
          Create your wedding workspace
        </h3>
        <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
          Give it a name to start planning, or open the invitation link your family sent you to join
          theirs.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Wedding workspace name"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="e.g. Ananya & Vikram's Wedding"
            className="flex-1 rounded-lg border border-surface-dim bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface transition-all placeholder:text-on-surface-variant/40 focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-body-sm text-body-sm font-medium text-on-primary shadow-xs transition-all hover:bg-[#163A2E] active:scale-[0.98] disabled:opacity-70"
          >
            <Icon name="add" className="text-[17px]" />
            {submitting ? "Creating..." : "Create workspace"}
          </button>
        </form>
      </div>
    </section>
  );
}
