"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createWedding, logOut, takeOnboardingPrefill } from "@/components/auth/auth-api";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { MEMBER_RELATIONSHIPS, type MemberRelationship } from "@/lib/constants/enums";

// The right-hand panel of the Stitch onboarding screen: "Start a new wedding" creates the
// wedding (caller becomes owner); "I have an invitation" is for people joining someone else's.

const ROLE_OPTIONS: Record<MemberRelationship, string> = {
  couple: "One of the couple",
  parent: "Parent",
  sibling: "Sibling",
  relative: "Relative",
  friend: "Friend",
  planner: "Wedding planner",
  other: "Other",
};

const FIELD =
  "w-full rounded-xl border border-[#E7DFD5] bg-white px-3.5 py-2.5 text-sm text-[#2A2622] transition-all duration-200 placeholder:text-[#9A938A] focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.12)] focus:outline-hidden";
const FIELD_ERROR = "border-error";
const LABEL = "mb-1.5 flex items-center justify-between text-xs font-semibold text-[#2A2622]";
const TAB =
  "relative flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-200 focus:ring-2 focus:ring-[#1F4D3D]/30 focus:outline-hidden sm:text-sm";
const TAB_ACTIVE = "bg-[#1F4D3D] text-[#FAF6F0] shadow-xs";
const TAB_IDLE = "text-[#68625B] hover:text-[#2A2622]";
const PRIMARY =
  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1F4D3D] px-4 py-3 text-sm font-semibold tracking-wide text-[#FAF6F0] shadow-xs transition-all duration-200 hover:bg-[#16362B] hover:shadow-sm active:scale-[0.99] disabled:pointer-events-none disabled:opacity-90";

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

type Field = "title" | "partnerOne" | "partnerTwo";

export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"new" | "invite">("new");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [relationship, setRelationship] = useState<MemberRelationship>("couple");
  const [errors, setErrors] = useState<Record<Field, boolean>>({
    title: false,
    partnerOne: false,
    partnerTwo: false,
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [invitation, setInvitation] = useState("");

  // What was typed on the signup form (workspace name, role) pre-fills this one.
  useEffect(() => {
    const prefill = takeOnboardingPrefill();
    if (!prefill) return;
    // Reading sessionStorage has to wait for the browser, so this sets state after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (prefill.title) {
      setTitle(prefill.title);
      setTitleEdited(true);
    }
    if (prefill.relationship && MEMBER_RELATIONSHIPS.includes(prefill.relationship)) {
      setRelationship(prefill.relationship);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /** As in the design: the title follows the partner names until it's edited by hand. */
  function updatePartner(which: "one" | "two", value: string) {
    const one = which === "one" ? value : partnerOne;
    const two = which === "two" ? value : partnerTwo;
    if (which === "one") setPartnerOne(value);
    else setPartnerTwo(value);
    if (value.trim())
      setErrors((current) => ({
        ...current,
        [which === "one" ? "partnerOne" : "partnerTwo"]: false,
      }));
    if (!titleEdited && one.trim() && two.trim()) {
      setTitle(`${one.trim()} & ${two.trim()}'s Wedding`);
      setErrors((current) => ({ ...current, title: false }));
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      title: !title.trim(),
      partnerOne: !partnerOne.trim(),
      partnerTwo: !partnerTwo.trim(),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      toast({
        type: "error",
        title: "A few details are missing",
        message: "Add a wedding name and both partners' names to continue.",
      });
      return;
    }

    setStatus("submitting");
    try {
      const { wedding } = await createWedding({
        title: title.trim(),
        partners: [{ name: partnerOne.trim() }, { name: partnerTwo.trim() }],
        weddingDate: weddingDate || undefined,
        relationship,
      });
      setStatus("done");
      toast({
        type: "success",
        title: "Wedding Created Successfully!",
        message: `"${wedding.title}" is ready. Opening your dashboard...`,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setStatus("idle");
      toast({ type: "error", title: "Couldn't create your wedding", message: errorMessage(error) });
    }
  }

  function handleJoin() {
    if (!invitation.trim()) {
      toast({
        type: "error",
        title: "Invitation link needed",
        message: "Paste the invitation link from the email the couple sent you.",
      });
      return;
    }
    toast({
      type: "info",
      title: "Joining by invitation is coming soon",
      message:
        "Once member invitations are live, the link in your email will add you to their wedding.",
    });
  }

  async function switchAccount() {
    try {
      await logOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="relative flex w-full flex-col justify-between overflow-y-auto bg-[#FAF6F0] p-6 sm:p-10 lg:w-[55%] lg:p-14">
      <div className="mx-auto mb-8 flex w-full max-w-[460px] items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-[#68625B]">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1F4D3D] text-[10px] font-semibold text-[#FAF6F0]">
            ✓
          </span>
          <span>Account created</span>
          <span className="mx-1 text-[#E7DFD5]">›</span>
          <span className="font-semibold text-[#1F4D3D]">Workspace setup</span>
        </div>
        <button
          type="button"
          onClick={() =>
            toast({
              type: "info",
              title: "Need help?",
              message:
                "Support is coming soon. Everything here can be changed later from your dashboard.",
            })
          }
          className="flex items-center gap-1 text-xs font-medium text-[#68625B] transition-all duration-200 hover:text-[#1F4D3D]"
        >
          <span>Need help?</span>
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </button>
      </div>

      <div className="mx-auto my-auto w-full max-w-[440px] py-2">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2">
            <span className="rounded-full border border-[#1F4D3D]/10 bg-[#EDF4F1] px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-[#1F4D3D] uppercase">
              Step 2 of 2
            </span>
            <span className="text-xs text-[#9A938A]">• Workspace Initialization</span>
          </div>
          <h2 className="mb-2 font-display text-2xl leading-tight font-medium tracking-[-0.02em] text-[#2A2622] sm:text-3xl">
            Let&apos;s set up your wedding
          </h2>
          <p className="text-xs leading-relaxed text-[#68625B] sm:text-sm">
            A few details to get started. You can change any of this later.
          </p>
        </div>

        <div className="mb-6">
          <div
            className="grid grid-cols-2 rounded-xl border border-[#E7DFD5] bg-[#F5F0E6] p-1"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "new"}
              onClick={() => setTab("new")}
              className={`${TAB} ${tab === "new" ? TAB_ACTIVE : TAB_IDLE}`}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Start a new wedding</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "invite"}
              onClick={() => setTab("invite")}
              className={`${TAB} ${tab === "invite" ? TAB_ACTIVE : TAB_IDLE}`}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
              <span>I have an invitation</span>
            </button>
          </div>
        </div>

        {tab === "new" ? (
          <form noValidate onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="wedding-name" className={LABEL}>
                <span>Wedding name</span>
                <span className="text-[11px] font-normal text-[#9A938A]">Display title</span>
              </label>
              <div className="relative">
                <input
                  id="wedding-name"
                  name="weddingName"
                  type="text"
                  maxLength={120}
                  placeholder="Aarav & Diya's Wedding"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setTitleEdited(true);
                    if (event.target.value.trim())
                      setErrors((current) => ({ ...current, title: false }));
                  }}
                  aria-invalid={errors.title}
                  className={`${FIELD} pr-10 ${errors.title ? FIELD_ERROR : ""}`}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#9A938A]">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="partner-one" className={LABEL}>
                  Partner one
                </label>
                <input
                  id="partner-one"
                  name="partnerOne"
                  type="text"
                  maxLength={80}
                  placeholder="First name"
                  value={partnerOne}
                  onChange={(event) => updatePartner("one", event.target.value)}
                  aria-invalid={errors.partnerOne}
                  className={`${FIELD} ${errors.partnerOne ? FIELD_ERROR : ""}`}
                />
              </div>
              <div>
                <label htmlFor="partner-two" className={LABEL}>
                  Partner two
                </label>
                <input
                  id="partner-two"
                  name="partnerTwo"
                  type="text"
                  maxLength={80}
                  placeholder="First name"
                  value={partnerTwo}
                  onChange={(event) => updatePartner("two", event.target.value)}
                  aria-invalid={errors.partnerTwo}
                  className={`${FIELD} ${errors.partnerTwo ? FIELD_ERROR : ""}`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="wedding-date" className={LABEL}>
                <span>
                  Wedding date <span className="font-normal text-[#9A938A]">(optional)</span>
                </span>
                <span className="text-[11px] font-normal text-[#B5714A]">Can be set later</span>
              </label>
              <input
                id="wedding-date"
                name="weddingDate"
                type="date"
                value={weddingDate}
                onChange={(event) => setWeddingDate(event.target.value)}
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="user-role" className={LABEL}>
                <span>Your role in this wedding</span>
                <span className="text-[11px] font-normal text-[#9A938A]">
                  Defines default module view
                </span>
              </label>
              <div className="relative">
                <select
                  id="user-role"
                  name="userRole"
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value as MemberRelationship)}
                  className={`${FIELD} cursor-pointer appearance-none pr-10`}
                >
                  {MEMBER_RELATIONSHIPS.map((value) => (
                    <option key={value} value={value}>
                      {ROLE_OPTIONS[value]}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-[#68625B]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-[#E7DFD5]/80 bg-[#F5F0E6]/80 p-3 text-[#68625B]">
              <svg
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-[#1F4D3D]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              <p className="text-[12px] leading-relaxed text-[#68625B]">
                You&apos;ll be the <strong className="font-semibold text-[#2A2622]">owner</strong>{" "}
                of this wedding and can invite family and your planner next.
              </p>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={status !== "idle"} className={PRIMARY}>
                <span>
                  {status === "idle"
                    ? "Create my wedding"
                    : status === "submitting"
                      ? "Setting up workspace..."
                      : "Workspace Ready!"}
                </span>
                {status === "submitting" ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin text-[#FAF6F0]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <ArrowIcon />
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="space-y-3 rounded-xl border border-[#E7DFD5] bg-[#F5F0E6] p-4">
              <label
                htmlFor="invitation-link"
                className="block text-xs font-semibold text-[#2A2622]"
              >
                Invitation link
              </label>
              <p className="text-xs text-[#68625B]">
                Paste the invitation link from the email the couple or your family sent you.
              </p>
              <input
                id="invitation-link"
                type="text"
                value={invitation}
                onChange={(event) => setInvitation(event.target.value)}
                placeholder="https://…/join/…"
                className={FIELD}
              />
            </div>
            <button type="button" onClick={handleJoin} className={PRIMARY}>
              <span>Join existing wedding</span>
              <ArrowIcon />
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#E7DFD5]/60 pt-5 text-[11px] text-[#9A938A]">
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 text-[#1F4D3D]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <span>One user = one wedding architecture • 256-bit encrypted</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[440px] pt-6 text-center text-xs text-[#68625B]">
        <span>
          Logged in as <strong>{email}</strong>
        </span>
        <span className="mx-2 text-[#E7DFD5]">•</span>
        <button
          type="button"
          onClick={switchAccount}
          className="underline transition-all duration-200 hover:text-[#1F4D3D]"
        >
          Switch account
        </button>
      </div>
    </div>
  );
}
