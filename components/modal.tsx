"use client";

import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

let scrollLocks = 0;
let savedOverflow: { node: HTMLElement; overflow: string }[] = [];

function lockBackgroundScroll() {
  if (scrollLocks === 0) {
    const nodes = [document.documentElement, document.body, document.getElementById("app-main")].filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    savedOverflow = nodes.map((node) => ({ node, overflow: node.style.overflow }));
    for (const node of nodes) node.style.overflow = "hidden";
  }
  scrollLocks += 1;
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks > 0) return;
    for (const item of savedOverflow) item.node.style.overflow = item.overflow;
    savedOverflow = [];
  };
}

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
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => lockBackgroundScroll(), []);

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#193956]/45 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
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
      </div>
    </motion.div>
  );
}
