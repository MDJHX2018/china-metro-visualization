export default function StatCard({ label, value = "--", unit = "", hint = "" }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
