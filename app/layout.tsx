import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TBA Wallet UI",
  description:
    "A pre-built UI for letting NFT holders activate and use their ERC-6551 Token Bound Accounts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
