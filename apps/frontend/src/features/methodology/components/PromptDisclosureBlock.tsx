export interface PromptDisclosureBlockProps {
  label: string;
  toolName: string;
  systemPrompt: string;
  inputSchema: Record<string, unknown>;
}

// Shared presentational block for disclosing an AI workflow's actual
// system prompt and tool input schema, mirroring the visual convention of
// the existing "資料來源 SQL" dark <pre>/<code> block on MethodologyPage.
export function PromptDisclosureBlock({
  label,
  toolName,
  systemPrompt,
  inputSchema,
}: PromptDisclosureBlockProps) {
  return (
    <div className="mb-6">
      <h4 className="font-bold text-[#001f2a]">{label}</h4>
      <p className="mb-2 font-mono text-xs text-[#434653]">{toolName}</p>
      <pre className="mb-2 overflow-x-auto rounded-lg bg-[#001f2a] p-4 text-xs leading-relaxed text-[#d9f2ff]">
        <code>{systemPrompt}</code>
      </pre>
      <pre className="overflow-x-auto rounded-lg bg-[#001f2a] p-4 text-xs leading-relaxed text-[#d9f2ff]">
        <code>{JSON.stringify(inputSchema, null, 2)}</code>
      </pre>
    </div>
  );
}
