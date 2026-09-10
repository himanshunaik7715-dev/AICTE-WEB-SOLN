import { ReactNode } from "react";
export function AuthLoadingState({
  error,
  retry,
  signOut,
  children,
}: {
  error?: string;
  retry: () => void;
  signOut: () => void;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-100 p-6 text-center text-slate-900">
      <div className="flex gap-5">
        <img
          src="/tcet-logo.ico"
          alt="TCET logo"
          className="h-20 w-20 object-contain"
        />
        <img
          src="/TCET IOT LOGO.png"
          alt="TCET IoT logo"
          className="h-20 w-20 object-contain"
        />
      </div>
      <h1 className="text-xl font-bold">TCET AICTE Activity Points</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <div className="flex gap-4">
            <button
              onClick={retry}
              className="rounded bg-indigo-700 px-5 py-3 text-white"
            >
              Retry
            </button>
            <button onClick={signOut} className="rounded border px-5 py-3">
              Sign out
            </button>
          </div>
        </>
      ) : (
        <p role="status" className="animate-pulse">
          Restoring your session…
        </p>
      )}
      {children}
    </main>
  );
}
