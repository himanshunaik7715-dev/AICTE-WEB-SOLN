import { useEffect, useState } from "react";
import {
  AcademicChange,
  AcademicScope,
  decideAcademicChange,
  getAcademicChanges,
  getAcademicScopes,
} from "../services/scopeService";
export function AcademicChangeQueue() {
  const [rows, setRows] = useState<AcademicChange[]>([]),
    [scopes, setScopes] = useState<AcademicScope[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<number | null>(null);
  const load = async () => {
    try {
      const [r, s] = await Promise.all([
        getAcademicChanges(),
        getAcademicScopes(),
      ]);
      setRows(r);
      setScopes(s);
    } catch {
      setError(
        "Academic requests unavailable. Verify the database migration and retry.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const label = (id: number) => {
    const s = scopes.find((x) => x.id === id);
    return s
      ? `${s.academic_batch} / ${s.course} / ${s.division || "Legacy"}`
      : String(id);
  };
  async function decide(id: number, approve: boolean) {
    setBusy(id);
    setError("");
    try {
      await decideAcademicChange(
        id,
        approve,
        approve ? "Verified by administrator" : "Correction not approved",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="font-bold">Academic correction requests</h2>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {!error && !rows.some((r) => r.status === "pending") && (
        <p className="mt-2 text-sm text-slate-600">No pending corrections.</p>
      )}
      {rows
        .filter((r) => r.status === "pending")
        .map((r) => (
          <div key={r.id} className="mt-3 border-t pt-3 text-sm">
            <p>Student: {r.student_id}</p>
            <p>
              {label(r.original_scope_id)} → {label(r.requested_scope_id)}
            </p>
            <p>{r.reason}</p>
            <div className="mt-2 flex gap-3">
              <button
                disabled={busy !== null}
                onClick={() => void decide(r.id, true)}
                className="rounded bg-indigo-700 px-3 py-2 text-white"
              >
                Approve verified correction
              </button>
              <button
                disabled={busy !== null}
                onClick={() => void decide(r.id, false)}
                className="rounded border px-3 py-2"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
    </section>
  );
}
