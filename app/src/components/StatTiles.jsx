export default function StatTiles({ items, className }) {
  return (
    <div className={className}>
      {items.map(([n, label]) => (
        <div className="stat" key={label}>
          <span className="n">{n}</span>
          <span className="label">{label}</span>
        </div>
      ))}
    </div>
  );
}
