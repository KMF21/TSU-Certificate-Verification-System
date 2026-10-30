"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { RegisterRow } from "@/lib/admin/register-query";
import { LEVEL_LABEL } from "@/lib/admin/roles";
import {
  approveRecordsAction,
  verifyRecordsAction,
} from "@/app/admin/(staff)/records/actions";
import {
  Empty,
  formatDay,
  Notice,
  RecordBadge,
  SampleBadge,
  SourceBadge,
} from "./ui";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

export function RecordsTable({
  rows,
  total,
  page,
  pages,
  pageSize,
  prevHref,
  nextHref,
  canAct,
  userId,
  sessions,
}: {
  rows: RegisterRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
  canAct: boolean;
  userId: string;
  sessions: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"approve" | "verify" | null>(null);
  const [senateDate, setSenateDate] = useState("");
  const [session, setSession] = useState("");
  const [message, setMessage] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);
  const [pending, start] = useTransition();

  const chosen = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  );
  const isOwn = (r: RegisterRow) =>
    r.created_by === userId || r.updated_by === userId;
  const approvable = chosen.filter((r) => r.status === "pending" && !isOwn(r));
  const verifiable = chosen.filter(
    (r) =>
      r.source === "legacy" &&
      r.verification_status === "unverified" &&
      !isOwn(r),
  );
  const ownCount = chosen.filter(isOwn).length;
  const missingSession = approvable.some((r) => !r.graduation_session);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.error) setMessage({ tone: "bad", text: res.error });
      else {
        setMessage({ tone: "good", text: res.ok ?? "Done." });
        setSelected(new Set());
        setMode(null);
        router.refresh();
      }
    });

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <section aria-label="Records" className="mt-6">
      {message && (
        <div className="mb-4 flex items-start gap-2">
          <div className="flex-1">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
          <button
            type="button"
            className="mt-2 text-ink-faint hover:text-ink"
            onClick={() => setMessage(null)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {canAct && chosen.length > 0 && (
        <div className="sticky top-16 z-20 mb-4 rounded-card border border-navy/20 bg-navy-50 p-4 shadow-card lg:top-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-navy">
              {chosen.length} selected
            </p>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={!approvable.length || pending}
              onClick={() => setMode("approve")}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve{" "}
              {approvable.length || ""}
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!verifiable.length || pending}
              onClick={() => setMode("verify")}
            >
              <BadgeCheck className="h-4 w-4" aria-hidden /> Mark verified{" "}
              {verifiable.length || ""}
            </button>
            <button
              type="button"
              className="text-sm text-ink-muted underline-offset-2 hover:underline"
              onClick={() => {
                setSelected(new Set());
                setMode(null);
              }}
            >
              Clear selection
            </button>
          </div>
          {ownCount > 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              {ownCount} of these you created or last edited, so they’re left
              out. Another officer must approve or verify them.
            </p>
          )}

          {mode === "approve" && (
            <form
              className="mt-4 grid gap-3 border-t border-navy/10 pt-4 sm:grid-cols-[auto_auto_1fr] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  approveRecordsAction({
                    ids: approvable.map((r) => r.id),
                    senateDate,
                    session,
                  }),
                );
              }}
            >
              <label className="block">
                <span className="label">Senate approval date</span>
                <input
                  type="date"
                  required
                  max={today()}
                  min="2008-01-01"
                  value={senateDate}
                  onChange={(e) => setSenateDate(e.target.value)}
                  className="field-sm"
                />
              </label>
              <label className="block">
                <span className="label">
                  Graduation session {missingSession ? "" : "(optional)"}
                </span>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  required={missingSession}
                  className="field-sm"
                >
                  <option value="">
                    {missingSession
                      ? "Choose a session"
                      : "Keep each record’s session"}
                  </option>
                  {sessions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="btn-primary btn-sm"
                  disabled={pending}
                >
                  {pending
                    ? "Approving…"
                    : `Approve ${approvable.length} record${approvable.length === 1 ? "" : "s"}`}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => setMode(null)}
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-ink-muted sm:col-span-3">
                Live records get a certificate serial and a verification code.
                Approved records can only be changed afterwards with a reason.
              </p>
            </form>
          )}

          {mode === "verify" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-navy/10 pt-4">
              <p className="text-sm text-ink">
                Confirm you have checked {verifiable.length} legacy record
                {verifiable.length === 1 ? "" : "s"} against the official Senate
                documents.
              </p>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    verifyRecordsAction({ ids: verifiable.map((r) => r.id) }),
                  )
                }
              >
                {pending ? "Saving…" : "Yes, mark verified"}
              </button>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => setMode(null)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="No records match">
          Try a different search, or clear some filters.
        </Empty>
      ) : (
        <>
          {/* Phones: one card per record */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`card flex gap-3 p-4 ${selected.has(r.id) ? "ring-2 ring-navy/30" : ""}`}
              >
                {canAct && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.full_name}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-navy"
                  />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <Link
                    href={`/admin/records/${r.id}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {r.full_name}
                  </Link>
                  <p className="font-mono text-xs text-ink-muted">
                    {r.reg_number}
                  </p>
                  <p className="mt-2 text-ink">
                    {r.award_title} {r.programme_name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {[
                      r.class_of_degree,
                      r.cgpa != null ? Number(r.cgpa).toFixed(2) : null,
                      r.graduation_session,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <RecordBadge
                      status={r.status}
                      source={r.source}
                      verification={r.verification_status}
                    />
                    <SourceBadge source={r.source} />
                    {r.is_sample && <SampleBadge />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-navy-50/60 text-left text-ink-muted">
                  <tr>
                    {canAct && (
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all on this page"
                          checked={allOnPage}
                          onChange={toggleAll}
                          className="h-4 w-4 accent-navy"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 font-medium">Graduate</th>
                    <th className="px-4 py-3 font-medium">Programme</th>
                    <th className="px-4 py-3 font-medium">Class / CGPA</th>
                    <th className="px-4 py-3 font-medium">Session</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t border-line align-top ${selected.has(r.id) ? "bg-navy-50/50" : "hover:bg-canvas/60"}`}
                    >
                      {canAct && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.full_name}`}
                            checked={selected.has(r.id)}
                            onChange={() => toggle(r.id)}
                            className="h-4 w-4 accent-navy"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/records/${r.id}`}
                          className="font-medium text-navy underline-offset-2 hover:underline"
                        >
                          {r.full_name}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-ink-muted">
                          {r.reg_number}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink">
                          {r.award_title} {r.programme_name}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {LEVEL_LABEL[r.level]} · {r.department_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>
                          {r.class_of_degree ?? (
                            <span className="text-ink-faint">—</span>
                          )}
                        </p>
                        {r.cgpa != null && (
                          <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                            {Number(r.cgpa).toFixed(2)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p>
                          {r.graduation_session ?? (
                            <span className="text-ink-faint">—</span>
                          )}
                        </p>
                        {r.senate_approval_date && (
                          <p className="mt-0.5 text-xs text-ink-muted">
                            Senate {formatDay(r.senate_approval_date)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <RecordBadge
                            status={r.status}
                            source={r.source}
                            verification={r.verification_status}
                          />
                          <SourceBadge source={r.source} />
                          {r.is_sample && <SampleBadge />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <nav
        aria-label="Pages"
        className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted"
      >
        <p>
          {total === 0
            ? "No records"
            : `Showing ${first.toLocaleString("en-GB")}–${last.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")}`}
          {selected.size > 0 && " · selection applies to this page only"}
        </p>
        <div className="flex items-center gap-2">
          {prevHref ? (
            <Link href={prevHref} className="btn-outline btn-sm">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </Link>
          ) : null}
          <span>
            Page {page} of {pages}
          </span>
          {nextHref ? (
            <Link href={nextHref} className="btn-outline btn-sm">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </nav>
    </section>
  );
}
