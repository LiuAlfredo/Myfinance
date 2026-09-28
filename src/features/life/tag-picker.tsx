export function TagPicker({
  value,
  suggestions,
  onChange,
}: {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
}) {
  const tags = value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const toggle = (tag: string) =>
    onChange(
      tags.includes(tag)
        ? tags.filter((t) => t !== tag).join(", ")
        : [...tags, tag].join(", "),
    );
  return (
    <div>
      <input
        className="form-control"
        aria-label="笔记标签"
        placeholder="标签，用逗号分隔"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {[...new Set([...tags, ...suggestions])].slice(0, 30).map((tag) => (
          <button
            type="button"
            key={tag}
            className={`rounded-full border px-2 py-1 text-xs ${tags.includes(tag) ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}
            onClick={() => toggle(tag)}
          >
            {tags.includes(tag) ? "✓ " : ""}
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
