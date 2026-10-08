/**
 * Linear progress. The fill is a transformed layer (scaleX), so continuous
 * updates never trigger layout.
 */
export function Meter({
  value,
  max,
  label,
  tone = "accent",
  size = "md",
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "accent" | "success" | "danger" | "neutral";
  size?: "sm" | "md";
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`meter meter-${size} meter-${tone} ${className}`}
    >
      <span className="meter-fill" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}
