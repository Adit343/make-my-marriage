"use client";

// Last-resort page for an error in the root layout itself (the normal error page needs the layout
// to work). It replaces the whole document, so it carries its own minimal styling and shows
// nothing about the error: only the reference the server logged.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#FAF6F0",
          color: "#2A2622",
          fontFamily: "system-ui, sans-serif",
          padding: "16px",
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", color: "#4A5350" }}>
            That didn&apos;t work on our side. Your information is safe — please try again.
            {error.digest ? ` If it keeps happening, quote reference ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#1F4D3C",
              color: "#FAF6F0",
              border: 0,
              borderRadius: 8,
              padding: "12px 20px",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
