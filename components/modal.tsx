"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export default function Modal({
  labelledBy,
  onClose,
  children,
  className,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#193956]/45 p-5 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        className={className}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
