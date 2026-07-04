interface Option {
  value: string;
  label: string;
}

interface TechsFilterBarProps {
  modeOptions: Option[];
  mode: string;
  onModeChange: (value: string) => void;
  categoryOptions: Option[];
  category: string;
  onCategoryChange: (value: string) => void;
}

export function TechsFilterBar({
  modeOptions,
  mode,
  onModeChange,
  categoryOptions,
  category,
  onCategoryChange,
}: TechsFilterBarProps) {
  return (
    <>
      <div className="mb-3 flex w-full flex-wrap overflow-hidden rounded-lg border border-[#c9e7f7] text-sm md:w-fit">
        {modeOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`flex-1 cursor-pointer px-4 py-2 font-bold transition-colors md:flex-none ${
              mode === opt.value
                ? 'bg-[#003d92] text-white'
                : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
            }`}
            onClick={() => onModeChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {categoryOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`cursor-pointer rounded-lg border px-3.5 py-1.5 font-bold transition-colors ${
              category === opt.value
                ? 'border-[#003d92] bg-[#003d92] text-white'
                : 'border-[#c9e7f7] bg-white text-[#434653] hover:bg-[#d9f2ff]'
            }`}
            onClick={() => onCategoryChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
