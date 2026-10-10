"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { RELATIONSHIP_PLAIN } from "@/components/dashboard/labels";
import { createTask, updateTask, type TaskInput } from "@/components/tasks/tasks-api";
import { Icon } from "@/components/ui/icon";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type MemberRelationship,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/constants/enums";
import {
  MAX_TASK_ASSIGNEES,
  MAX_TASK_TITLE,
  TASK_FORM_DESCRIPTION_LIMIT,
} from "@/lib/constants/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  toneOf,
  type TaskEventInfo,
  type TaskMember,
  type TaskView,
} from "@/lib/tasks/view";
import { initialsOf } from "@/lib/text/initials";

// The "Add / Edit Task" slide-over from the Stitch design. One form creates a task, edits one, or
// starts a new task in a given status/event (the board's "+ Add task", the event page's "Add
// task"). Anyone in the wedding may edit any task.

export type TaskDrawerMode =
  | { kind: "create"; eventId?: string | null; status?: TaskStatus }
  | { kind: "edit"; task: TaskView; focus?: "assignees" };

const LABEL = "block font-label-md text-label-md font-semibold text-[#2A2622]";
const FIELD =
  "w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-3.5 py-2.5 font-body-md text-body-md text-[#2A2622] outline-none transition-all placeholder:text-[#2A2622]/35 focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.08)]";
// A native date field whose own picker icon is stretched over the whole input (and made invisible)
// so the designed calendar icon shows and a click anywhere opens the picker.
const PICKER =
  "relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

const AVATAR_TONE = ["bg-[#1F4D3D]", "bg-[#4A6B5D]", "bg-[#B5714A]", "bg-[#8B4F2B]"];
const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-[#1F4D3D]",
  in_progress: "bg-[#F4A074]",
  done: "bg-[#B9C4BE]",
};

function relationshipText(value: string | null): string | null {
  return value ? (RELATIONSHIP_PLAIN[value as MemberRelationship] ?? null) : null;
}

export function TaskDrawer({
  weddingId,
  events,
  members,
  mode,
  onClose,
  onSaved,
}: {
  weddingId: string;
  events: TaskEventInfo[];
  members: TaskMember[];
  mode: TaskDrawerMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const editing = mode.kind === "edit";
  const initial = mode.kind === "edit" ? mode.task : null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [eventId, setEventId] = useState<string>(
    initial ? (initial.eventId ?? "") : mode.kind === "create" ? (mode.eventId ?? "") : "",
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(
    initial?.status ?? (mode.kind === "create" ? (mode.status ?? "todo") : "todo"),
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial?.assigneeMemberIds ?? []);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const assigneeSection = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      if (picking) setPicking(false);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, picking, saving]);

  useEffect(() => {
    if (mode.kind === "edit" && mode.focus === "assignees") {
      assigneeSection.current?.scrollIntoView({ block: "center" });
    }
  }, [mode]);

  useEffect(() => {
    if (!picking) return;
    const onPointer = (event: MouseEvent) => {
      if (picker.current && !picker.current.contains(event.target as Node)) setPicking(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [picking]);

  const memberById = new Map(members.map((member) => [member.id, member]));
  const available = members.filter((member) => !assigneeIds.includes(member.id));
  const atLimit = assigneeIds.length >= MAX_TASK_ASSIGNEES;

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitleError(true);
      return;
    }
    const input: TaskInput = {
      title: cleanTitle,
      description: description.trim() || null,
      eventId: eventId || null,
      status,
      priority,
      dueDate: dueDate || null,
      assigneeMemberIds: assigneeIds,
    };

    setSaving(true);
    try {
      if (mode.kind === "edit") await updateTask(weddingId, mode.task.id, mode.task.version, input);
      else await createTask(weddingId, input);
      toast({
        type: "success",
        title: editing ? "Task updated" : "Task added",
        message: cleanTitle,
      });
      onSaved();
    } catch (error) {
      setSaving(false);
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Someone else just changed this task"
            : "Couldn't save the task",
        message: errorMessage(error),
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-[#2A2622]/25 backdrop-blur-[2px]"
        onMouseDown={() => {
          if (!saving) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        className="fixed inset-y-0 right-0 flex w-[540px] max-w-full flex-col border-l border-[#E5DDD2] bg-[#FFFDF9] shadow-2xl"
      >
        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <header className="flex-shrink-0 border-b border-[#2A2622]/[0.06] px-8 pt-8 pb-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary-fixed/40 px-3 py-1 font-label-sm text-label-sm font-semibold tracking-wider text-secondary uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                  Task creator • Wedding suite
                </span>
                <h2
                  id="task-drawer-title"
                  className="font-headline-md text-headline-md font-normal text-[#2A2622]"
                >
                  {editing ? "Edit task" : "Add task"}
                </h2>
                <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">
                  Create an assignment, link it to a ceremony, and designate team members.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close panel"
                onClick={onClose}
                className="-mt-1 -mr-2 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-[#F2ECE3] hover:text-[#2A2622]"
              >
                <Icon name="close" />
              </button>
            </div>
          </header>

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-8 py-6">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="task-title" className={LABEL}>
                  Task title <span className="text-secondary">*</span>
                </label>
                {titleError ? <span className="text-[11px] text-error">Title required</span> : null}
              </div>
              <input
                id="task-title"
                type="text"
                autoFocus
                autoComplete="off"
                maxLength={MAX_TASK_TITLE}
                placeholder="e.g., Confirm dholak & folk music troupe arrival"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) setTitleError(false);
                }}
                aria-invalid={titleError}
                className={`${FIELD} ${titleError ? "border-error" : ""}`}
              />
              <p className="flex items-center gap-1.5 font-body-sm text-[12px] text-on-surface-variant">
                <Icon name="info" className="text-[14px]" />
                Keep titles action-oriented and clear for collaborators.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="task-description"
                  className="block font-label-md text-label-md font-semibold text-[#2A2622]"
                >
                  Description{" "}
                  <span className="font-normal text-on-surface-variant">(optional)</span>
                </label>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {description.length} / {TASK_FORM_DESCRIPTION_LIMIT}
                </span>
              </div>
              <textarea
                id="task-description"
                rows={4}
                maxLength={TASK_FORM_DESCRIPTION_LIMIT}
                placeholder="Add context, contacts or anything a collaborator needs to know."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${FIELD} resize-none font-body-sm text-body-sm`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-event" className={LABEL}>
                Event
              </label>
              <div className="relative">
                <Icon
                  name="celebration"
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-[#1F4D3D]"
                />
                <select
                  id="task-event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className={`${FIELD} cursor-pointer appearance-none pr-10 pl-11`}
                >
                  <option value="">No event (general task)</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
                />
              </div>
              <p className="font-body-sm text-[12px] text-on-surface-variant">
                Link this task to an event, or leave it as a general task.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="task-due" className={LABEL}>
                  Due date
                </label>
                <div className="relative">
                  <input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`${FIELD} ${PICKER} pl-11 font-body-sm text-body-sm`}
                  />
                  <Icon
                    name="calendar_today"
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <span id="task-priority-label" className={LABEL}>
                  Priority
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="task-priority-label"
                  className="flex rounded-lg border border-[#2A2622]/10 bg-[#F5EFEB] p-1"
                >
                  {TASK_PRIORITIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={priority === value}
                      onClick={() => setPriority(value)}
                      className={`flex-1 rounded-md px-3 py-1.5 font-label-md text-label-md font-medium transition-colors ${
                        priority === value
                          ? "bg-[#1F4D3D] text-[#FAF6F0] shadow-sm"
                          : "text-on-surface-variant hover:text-[#2A2622]"
                      }`}
                    >
                      {PRIORITY_LABEL[value]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span id="task-status-label" className={LABEL}>
                Status
              </span>
              <div
                role="radiogroup"
                aria-labelledby="task-status-label"
                className="grid grid-cols-3 gap-1 rounded-lg border border-[#2A2622]/10 bg-[#F5EFEB] p-1"
              >
                {TASK_STATUSES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={status === value}
                    onClick={() => setStatus(value)}
                    className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 font-body-sm text-body-sm transition-colors ${
                      status === value
                        ? "border border-[#2A2622]/10 bg-[#FFFDF9] font-medium text-[#2A2622] shadow-sm"
                        : "text-on-surface-variant hover:text-[#2A2622]"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
                    {STATUS_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>

            <div ref={assigneeSection} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Assign to</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Up to {MAX_TASK_ASSIGNEES} people.
                </span>
              </div>
              <div className="relative" ref={picker}>
                <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] p-2.5">
                  {assigneeIds.map((id) => {
                    const member = memberById.get(id);
                    if (!member) return null;
                    const relation = relationshipText(member.relationship);
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-2 rounded-full border border-[#2A2622]/10 bg-[#FAF6F0] py-1 pr-2 pl-1"
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full font-label-sm text-[9px] font-bold text-[#FAF6F0] ${AVATAR_TONE[toneOf(id)]}`}
                        >
                          {initialsOf(member.name)}
                        </span>
                        <span className="font-body-sm text-[13px] font-medium text-[#2A2622]">
                          {member.name}
                          {relation ? (
                            <span className="font-normal text-on-surface-variant">
                              {" "}
                              ({relation})
                            </span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${member.name}`}
                          onClick={() =>
                            setAssigneeIds(assigneeIds.filter((other) => other !== id))
                          }
                          className="text-outline transition-colors hover:text-[#B33A3A]"
                        >
                          <Icon name="close" className="text-[14px]" />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPicking((value) => !value)}
                    disabled={atLimit || available.length === 0}
                    aria-expanded={picking}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-body-sm text-[13px] font-medium text-[#1F4D3D] transition-colors hover:bg-[#1F4D3D]/[0.06] disabled:cursor-not-allowed disabled:text-outline disabled:hover:bg-transparent"
                  >
                    <Icon name="add" className="text-[16px]" />
                    {assigneeIds.length === 0 ? "Add a member…" : "Add another member…"}
                  </button>
                </div>
                {picking ? (
                  <ul
                    aria-label="Team members"
                    className="elevation-2 absolute right-0 left-0 z-10 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] py-1.5"
                  >
                    {available.map((member) => {
                      const relation = relationshipText(member.relationship);
                      return (
                        <li key={member.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigneeIds([...assigneeIds, member.id]);
                              setPicking(false);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-surface-container"
                          >
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full font-label-sm text-[9px] font-bold text-[#FAF6F0] ${AVATAR_TONE[toneOf(member.id)]}`}
                            >
                              {initialsOf(member.name)}
                            </span>
                            <span className="font-body-sm text-[13px] text-[#2A2622]">
                              {member.name}
                              {relation ? (
                                <span className="text-on-surface-variant"> ({relation})</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              {members.length <= 1 ? (
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Invite family and your planner from Members to give them tasks.
                </p>
              ) : null}
            </div>
          </div>

          <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[#E8E1D7] bg-[#FAF6F0]/95 px-8 py-4 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="lock" className="shrink-0 text-[16px] text-surface-tint" />
              <span className="truncate">Shared with your team</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="shrink-0 rounded-lg border border-[#D5CCC0] px-5 py-2.5 font-label-md text-label-md font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3] focus:ring-2 focus:ring-[#B5714A] focus:outline-none active:scale-[0.99]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[#1F4D3D] px-6 py-2.5 font-label-md text-label-md font-medium whitespace-nowrap text-[#FAF6F0] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-none active:scale-[0.99] disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save task"}
                {saving ? null : <Icon name="arrow_forward" className="text-[16px]" />}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
