import { useState, type FormEvent } from 'react';

import { Modal } from '../../../components/Modal';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useCreateTechMutation } from '../mutations';

interface CreateTechModalProps {
  open: boolean;
  onClose: () => void;
}

const FIRST_CATEGORY = Object.keys(CATEGORY_LABEL_MAP)[0];

// Create-tech form (task 5.2), wiring TechManagerPage's previously-dead
// showCreateModal state to the real useCreateTechMutation. Fields map
// directly onto CreateTechDto: id (required), category, tags (comma-
// separated -> keywords[]), parent (free-text existing tech id, no
// autocomplete -- out of scope per the task).
//
// `category` is a required <select> defaulting to the first known category
// rather than an optional field that can send `null`: the backend's
// tech.category column is NOT NULL (task 4.1's Implementation Notes), so a
// create form has no reason to ever attempt a null category -- unlike
// update, which legitimately needs to represent "leave unchanged".
export function CreateTechModal({ open, onClose }: CreateTechModalProps) {
  const createTech = useCreateTechMutation();
  const [id, setId] = useState('');
  const [category, setCategory] = useState(FIRST_CATEGORY);
  const [tags, setTags] = useState('');
  const [parent, setParent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setId('');
    setCategory(FIRST_CATEGORY);
    setTags('');
    setParent('');
    setError(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!id.trim()) {
      setError('請輸入技術 ID');
      return;
    }
    try {
      await createTech.mutateAsync({
        id: id.trim(),
        keywords: tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
        category,
        parent: parent.trim() || null,
      });
      handleClose();
    } catch {
      setError('建立失敗，請確認 ID 是否重複。');
    }
  };

  return (
    <Modal open={open} title="建立技術" onClose={handleClose}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm font-bold text-[#434653]">
          技術 ID
          <input
            value={id}
            type="text"
            placeholder="例如：react"
            className="rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm font-normal text-[#001f2a] focus:border-[#003d92] focus:outline-none"
            onChange={e => setId(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-[#434653]">
          分類
          <select
            value={category}
            className="rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm font-normal text-[#001f2a] focus:border-[#003d92] focus:outline-none"
            onChange={e => setCategory(e.target.value)}
          >
            {Object.entries(CATEGORY_LABEL_MAP).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-[#434653]">
          關鍵字（以逗號分隔，可留空）
          <input
            value={tags}
            type="text"
            placeholder="react, reactjs"
            className="rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm font-normal text-[#001f2a] focus:border-[#003d92] focus:outline-none"
            onChange={e => setTags(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-[#434653]">
          父技術 ID（可留空）
          <input
            value={parent}
            type="text"
            placeholder="例如：javascript"
            className="rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm font-normal text-[#001f2a] focus:border-[#003d92] focus:outline-none"
            onChange={e => setParent(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#f4faff]"
            onClick={handleClose}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={createTech.isPending}
            className="cursor-pointer rounded-lg bg-[#003d92] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9] disabled:opacity-50"
          >
            建立
          </button>
        </div>
      </form>
    </Modal>
  );
}
