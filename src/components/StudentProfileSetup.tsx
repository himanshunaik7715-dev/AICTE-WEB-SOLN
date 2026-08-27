import React, { useMemo, useState } from "react";
import { UserProfile } from "../types";
import { completeStudentProfile } from "../services/authService";
import { parseStudentUID } from "../utils/parseStudentUID";
import {
  validateErpNumber,
  validatePhoneNumber,
} from "../utils/studentProfile";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Info,
} from "lucide-react";

interface StudentProfileSetupProps {
  email: string;
  name: string;
  existingProfile?: UserProfile;
  onComplete: (profile: UserProfile) => void;
  onBack?: () => void;
}

export const StudentProfileSetup: React.FC<StudentProfileSetupProps> = ({
  email,
  name: initialName,
  existingProfile,
  onComplete,
  onBack,
}) => {
  const [fullName, setFullName] = useState(
    existingProfile?.name || initialName,
  );
  const [studentUid, setStudentUid] = useState(
    existingProfile?.studentUid || "",
  );
  const [erpNo, setErpNo] = useState(existingProfile?.erpNo || "");
  const [phoneNumber, setPhoneNumber] = useState(
    existingProfile?.phoneNumber || "",
  );
  const [uidError, setUidError] = useState("");
  const [erpError, setErpError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  const parsedUid = useMemo(() => {
    if (!studentUid.trim()) return null;
    return parseStudentUID(studentUid);
  }, [studentUid]);

  const handleUidChange = (value: string) => {
    setStudentUid(value);
    if (value.trim() && !parseStudentUID(value)) {
      setUidError("Invalid UID format. Example: 25-CSE(IOT)B01-29");
    } else {
      setUidError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setNameError("");
    setErpError("");
    setPhoneError("");
    setUidError("");

    let hasError = false;

    if (!fullName.trim()) {
      setNameError("Full Name is required.");
      hasError = true;
    }

    const parsed = parseStudentUID(studentUid);
    if (!parsed) {
      setUidError("Invalid UID format. Example: 25-CSE(IOT)B01-29");
      hasError = true;
    }

    const erpErr = validateErpNumber(erpNo);
    if (erpErr) {
      setErpError(erpErr);
      hasError = true;
    }

    const phoneErr = validatePhoneNumber(phoneNumber);
    if (phoneErr) {
      setPhoneError(phoneErr);
      hasError = true;
    }

    if (hasError || !parsed) return;

    setLoading(true);
    try {
      const saved = await completeStudentProfile(
        email,
        fullName,
        {
          studentUid: parsed.uid,
          erpNo,
          phoneNumber,
          course: parsed.rawCourse,
          department: parsed.department,
          division: parsed.division,
          rollNo: parsed.rollNumber,
        },
        existingProfile,
      );
      onComplete(saved);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to save profile. Please try again.";
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 sm:px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                Complete Your Student Profile
              </h2>
              <p className="text-xs text-indigo-100 mt-0.5">
                One-time setup required before accessing the dashboard.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {submitError && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* College Email — read-only */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              College Email
            </label>
            <div className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 bg-slate-50 font-medium">
              {email}
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setNameError("");
              }}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {nameError && (
              <p className="text-[11px] text-rose-600 mt-1">{nameError}</p>
            )}
          </div>

          {/* Student UID */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Student UID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="25-CSE(IOT)B01-29"
              value={studentUid}
              onChange={(e) => handleUidChange(e.target.value)}
              className={`w-full border rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono ${
                uidError ? "border-rose-300 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {uidError && (
              <p className="text-[11px] text-rose-600 mt-1">{uidError}</p>
            )}
          </div>

          {/* Detected info from UID */}
          {parsedUid && (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
                <Info className="w-3.5 h-3.5" />
                Detected Student Information
              </div>
              <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div>
                  <span className="text-slate-500">Academic Year</span>
                  <p className="font-semibold text-slate-800">
                    {parsedUid.admissionYear} –{" "}
                    {parsedUid.academicBatch.split("-")[1]}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Course</span>
                  <p className="font-semibold text-slate-800">
                    {parsedUid.course}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Department</span>
                  <p className="font-semibold text-slate-800">
                    {parsedUid.department}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Division</span>
                  <p className="font-semibold text-slate-800">
                    {parsedUid.division}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Roll Number</span>
                  <p className="font-semibold text-slate-800">
                    {parsedUid.rollNumber}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ERP Number */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              ERP Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1032250498"
              value={erpNo}
              onChange={(e) => {
                setErpNo(e.target.value);
                setErpError("");
              }}
              className={`w-full border rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                erpError ? "border-rose-300 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {erpError && (
              <p className="text-[11px] text-rose-600 mt-1">{erpError}</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="9876543210"
              maxLength={10}
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
                setPhoneError("");
              }}
              className={`w-full border rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                phoneError
                  ? "border-rose-300 bg-rose-50/30"
                  : "border-slate-200"
              }`}
            />
            {phoneError && (
              <p className="text-[11px] text-rose-600 mt-1">{phoneError}</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={loading}
                className="flex-1 py-3 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !!uidError}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? "Saving Profile..." : "Complete Profile"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Your profile is saved securely to the database.
          </p>
        </form>
      </div>
    </div>
  );
};
