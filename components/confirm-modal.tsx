"use client";

import { useEffect, useRef } from "react";
import Modal from "@/components/modal";

export default function ConfirmModal({
  labelledBy,
  title,
  subject,
  description,
  confirmLabel,
  busyLabel = "Saving…",
  busy = false,
  error = "",
  danger = false,
  onCancel,
  onConfirm,
}: {
  labelledBy: string;
  title: string;
  subject?: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  error?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <Modal
      labelledBy={labelledBy}
      onClose={() => {
        if (!busy) onCancel();
      }}
      className="w-full max-w-md rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl"
    >
      <div className="px-5 py-5 text-sm text-[#193956]">
        <h2 id={labelledBy} className="text-lg font-semibold">
          {title}
        </h2>
        {subject ? <p className="mt-1 font-medium">{subject}</p> : null}
        <p className="mt-2 text-[#5c6b7a]">{description}</p>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-xs text-[#9b2c2c]">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-[#e6edf3] px-5 py-3">
        <button
          ref={cancelRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-[#385875] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            danger ? "bg-[#9b2c2c] hover:bg-[#7f2222]" : "bg-[#193956] hover:bg-[#385875]"
          }`}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </footer>
    </Modal>
  );
}
