type Operator = 'and' | 'or';

interface OperatorToggleProps {
  value: Operator;
  onChange: (value: Operator) => void;
}

const OPTIONS: { value: Operator; label: string }[] = [
  { value: 'and', label: 'AND' },
  { value: 'or', label: 'OR' },
];

// Shared AND/OR operator toggle (task 4.3).
export function OperatorToggle({ value, onChange }: OperatorToggleProps) {
  return (
    <div className="border-surface-container-highest flex overflow-hidden rounded border">
      {OPTIONS.map(op => (
        <button
          key={op.value}
          type="button"
          className={`flex-1 cursor-pointer px-2 py-0.5 text-sm font-bold transition-colors ${
            value === op.value
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
          onClick={() => {
            if (op.value !== value) onChange(op.value);
          }}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
