import Link from "next/link";
import { SetupGuide } from "@/components/SetupGuide";

export const metadata = {
  title: "Set up TBA Wallet UI for your own project",
  description: "How to point this repo's wallet UI at your own NFT collection.",
};

// Reachable from the live homepage's "How to use this in your own project"
// link. This deployment is already configured and working (that's what /
// shows now) - this page is for visitors who want their own copy.
export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ‹ back to the live site
        </Link>
        <h1 className="text-2xl font-semibold">Use this in your own project</h1>
        <p className="text-neutral-400">
          This site is already a live, working copy of the TBA Wallet UI,
          pointed at one specific NFT collection. Want to point the same code at
          your own NFT collection instead? Clone the repo and follow the 5 steps
          below.
        </p>
      </div>

      <SetupGuide />
    </main>
  );
}
