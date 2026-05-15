export function Background() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Primary blob - top left */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,142,247,0.14) 0%, transparent 65%)",
          top: -300,
          left: -200,
          filter: "blur(80px)",
          animation: "blob-drift-1 14s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Secondary blob - bottom right */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 65%)",
          bottom: -250,
          right: -150,
          filter: "blur(100px)",
          animation: "blob-drift-2 18s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Accent blob - center */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,142,247,0.06) 0%, transparent 70%)",
          top: "40%",
          left: "55%",
          filter: "blur(120px)",
          animation: "blob-drift-3 22s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
