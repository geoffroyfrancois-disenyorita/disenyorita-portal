interface MetricCardProps {
  title: string;
  value: string;
  helper?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneColors: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "#e2e8f0",
  success: "#4ade80",
  warning: "#facc15",
  danger: "#f87171"
};

export function MetricCard({ title, value, helper, tone = "default" }: MetricCardProps): JSX.Element {
  return (
    <div className="card">
      <p className="text-muted" style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>
        {title}
      </p>
      <p style={{ fontSize: "2rem", margin: "0.25rem 0", color: toneColors[tone] }}>{value}</p>
      {helper && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>{helper}</p>}
    </div>
  );
}
