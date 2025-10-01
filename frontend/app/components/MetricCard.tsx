interface MetricCardProps {
  title: string;
  value: string;
  helper?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneColors: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "#8b3921",
  success: "#2f7d4f",
  warning: "#c1611a",
  danger: "#b3321b"
};

export function MetricCard({ title, value, helper, tone = "default" }: MetricCardProps): JSX.Element {
  return (
    <div className="card">
      <p className="text-muted" style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>
        {title}
      </p>
      <p style={{ fontSize: "2.15rem", margin: "0.35rem 0", color: toneColors[tone], fontWeight: 600 }}>{value}</p>
      {helper && <p style={{ margin: 0, color: "#8c6f63", fontSize: "0.85rem" }}>{helper}</p>}
    </div>
  );
}
