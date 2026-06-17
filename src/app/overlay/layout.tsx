import { Suspense } from "react";

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ background: "transparent" }}>
      <body
        style={{ background: "transparent", margin: 0, overflow: "hidden" }}
      >
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </body>
    </html>
  );
}
