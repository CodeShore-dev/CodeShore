interface SearchInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

// Shared search input (task 4.2). Controlled value with a clear button.
export function SearchInput({
  value,
  placeholder,
  onChange,
}: SearchInputProps) {
  return (
    <div className="relative">
      <span className="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
        search
      </span>
      <input
        value={value}
        type="text"
        placeholder={placeholder}
        className="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-xl border py-2.5 pr-8 pl-9 text-sm font-bold focus:outline-none"
        onChange={event => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-3 flex -translate-y-1/2 cursor-pointer"
          onClick={() => onChange('')}
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      )}
    </div>
  );
}
