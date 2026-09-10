import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../types";
import { AcademicScope, getAcademicScopes } from "../services/scopeService";
export function ScopeAdministration({ users }: { users: UserProfile[] }) {
  const [scopes, setScopes] = useState<AcademicScope[]>([]),
    [batch, setBatch] = useState(""),
    [department, setDepartment] = useState("Internet of Things (IoT)"),
    [course, setCourse] = useState("CSE(IOT)"),
    [division, setDivision] = useState("A"),
    [scope, setScope] = useState(""),
    [reviewer, setReviewer] = useState(""),
    [group, setGroup] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = () =>
    getAcademicScopes()
      .then(setScopes)
      .catch(() => setMessage("Unable to load academic scopes."));
  useEffect(() => {
    void load();
  }, []);
  async function save(provision: boolean, active = true) {
    setBusy(true);
    setMessage("");
    try {
      const { error } = provision
        ? await supabase.rpc("provision_academic_scope", {
            batch,
            department,
            course,
            division,
          })
        : await supabase.rpc("set_reviewer_assignment", {
            reviewer,
            academic_scope: Number(scope),
            reviewer_group:
              users.find((u) => u.id === reviewer)?.role === "cr" ? "" : group,
            is_active: active,
          });
      if (error) throw error;
      setMessage(
        provision
          ? "Academic scope and physical partition created."
          : "Reviewer assignment saved.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  const input = "block w-full rounded border p-2";
  return (
    <details className="rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-bold">
        Academic batches, divisions and reviewer assignments
      </summary>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          <h3 className="font-semibold">Add academic scope</h3>
          <label className="block text-sm">
            Batch
            <input
              required
              pattern="20[0-9]{2}-20[0-9]{2}"
              placeholder="2026-2030"
              className={input}
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Department
            <input
              required
              className={input}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Course code
            <input
              required
              className={input}
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Division
            <input
              required
              pattern="[A-Z]"
              className={input}
              value={division}
              onChange={(e) => setDivision(e.target.value.toUpperCase())}
            />
          </label>
          <button
            disabled={busy}
            className="rounded bg-indigo-700 px-4 py-2 text-white"
          >
            Create scope and partition
          </button>
        </form>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
        >
          <h3 className="font-semibold">Assign an approved reviewer</h3>
          <label className="block text-sm">
            Academic scope
            <select
              required
              className={input}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="">Choose scope</option>
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.academic_batch} · {s.course} · {s.division || "Legacy"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Reviewer
            <select
              required
              className={input}
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            >
              <option value="">Choose CR / TGM</option>
              {users
                .filter(
                  (u) =>
                    ["cr", "admin"].includes(u.role) &&
                    u.tgmApprovalStatus === "approved",
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === "cr" ? "CR" : "TGM"})
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            TG group (TGMs only)
            <input
              className={input}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button
              disabled={busy}
              className="rounded bg-indigo-700 px-4 py-2 text-white"
            >
              Assign
            </button>
            <button
              type="button"
              disabled={busy || !scope || !reviewer}
              onClick={() => void save(false, false)}
              className="rounded border px-4 py-2"
            >
              Revoke
            </button>
          </div>
        </form>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </details>
  );
}
