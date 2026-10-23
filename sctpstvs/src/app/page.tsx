import { LoginForm } from "./login-form";

export default function Home() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">SWEP Group 15 · OAU, Ile-Ife</p>
        <h1 className="text-3xl font-bold leading-tight">Campus Ride Pass</h1>
        <p>
          Pay for campus shuttle rides from your wallet and get a signed, single-use ticket. Conductors scan it once;
          a copied or reused ticket is caught.
        </p>
      </div>
      <LoginForm />
      <details className="rounded-md border border-border bg-surface p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Demo accounts</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 pr-2">Role</th>
              <th className="py-1 pr-2">Number</th>
              <th className="py-1">Password</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr>
              <td className="py-1 pr-2 font-sans">Student</td>
              <td className="py-1 pr-2">CSC/2021/001</td>
              <td className="py-1">student123</td>
            </tr>
            <tr>
              <td className="py-1 pr-2 font-sans">Student (₦100)</td>
              <td className="py-1 pr-2">EEG/2022/014</td>
              <td className="py-1">student123</td>
            </tr>
            <tr>
              <td className="py-1 pr-2 font-sans">Conductor</td>
              <td className="py-1 pr-2">CON/001</td>
              <td className="py-1">conductor123</td>
            </tr>
            <tr>
              <td className="py-1 pr-2 font-sans">Admin</td>
              <td className="py-1 pr-2">ADM/001</td>
              <td className="py-1">admin123</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-muted">This is a demo: no real money is used and fares are example values.</p>
      </details>
    </main>
  );
}
