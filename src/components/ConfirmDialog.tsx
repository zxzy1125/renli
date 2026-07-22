// 确认对话框组件
import { useState } from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  requireNote?: boolean; // 是否需要备注输入
  noteLabel?: string;
  notePlaceholder?: string;
  onConfirm: (note?: string) => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  requireNote = false,
  noteLabel = '备注',
  notePlaceholder = '请输入备注（可选）',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    onConfirm(requireNote ? note : undefined);
    setNote('');
  };

  const handleCancel = () => {
    setNote('');
    onCancel();
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={handleCancel}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={handleCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-forest-700 dark:text-cream-200">{message}</p>
      {requireNote && (
        <div className="mt-3">
          <label className="label">{noteLabel}</label>
          <textarea
            className="input"
            rows={3}
            placeholder={notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
