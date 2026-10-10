import type { AssigneeView } from "@/lib/tasks/view";

// The overlapping initials on a task: soft tones in the list, solid tones on board cards (as in
// the two Stitch screens). Hovering a circle shows the person's full name.

const SOFT = [
  "bg-surface-container-high text-primary",
  "bg-secondary-fixed text-on-secondary-fixed",
  "bg-primary-fixed/60 text-primary",
  "bg-surface-container text-secondary",
];
const SOLID = ["bg-[#1F4D3D]", "bg-[#4A6B5D]", "bg-[#B5714A]", "bg-[#8B4F2B]"];

export function AssigneeAvatars({
  assignees,
  variant,
  max = 3,
}: {
  assignees: AssigneeView[];
  variant: "soft" | "solid";
  max?: number;
}) {
  if (assignees.length === 0) return null;
  const shown = assignees.length > max ? assignees.slice(0, max - 1) : assignees;
  const extra = assignees.length - shown.length;
  const base =
    variant === "soft"
      ? "h-6 w-6 border border-surface-container-lowest text-[10px] font-medium"
      : "h-6 w-6 ring-2 ring-[#FFFDF9] text-[9px] font-bold text-[#FAF6F0]";

  return (
    <div className="flex -space-x-1.5">
      {shown.map((person) => (
        <span
          key={person.id}
          title={person.name}
          className={`flex items-center justify-center rounded-full font-label-sm ${base} ${
            variant === "soft" ? SOFT[person.tone] : SOLID[person.tone]
          }`}
        >
          {person.initials}
        </span>
      ))}
      {extra > 0 ? (
        <span
          title={assignees
            .slice(shown.length)
            .map((person) => person.name)
            .join(", ")}
          className={`flex items-center justify-center rounded-full bg-surface-container-high font-label-sm text-on-surface-variant ${
            variant === "soft"
              ? "h-6 w-6 border border-surface-container-lowest text-[10px] font-medium"
              : "h-6 w-6 text-[9px] font-bold ring-2 ring-[#FFFDF9]"
          }`}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
