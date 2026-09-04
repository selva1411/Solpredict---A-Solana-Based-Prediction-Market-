"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 "
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative surface rounded-[8px] p-8 max-w-md w-full space-y-6 z-10"
          >
            <div className="flex items-start space-x-4">
              <div
                className={`p-3 rounded-[4px] ${
                  destructive
                    ? "bg-no/10 text-no"
                    : "bg-magenta/10 text-magenta"
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-[21px] font-bold font-display text-ink">
                  {title}
                </h3>
                <p className="text-[13px] text-ash leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 text-xs font-semibold rounded-[4px] border-2 border-ink text-ink hover:bg-yellow hover:text-ink-static transition-all cursor-pointer snap"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-5 py-2.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer snap ${
                  destructive
                    ? "bg-no-fill text-white hover:bg-no-fill/90"
                    : "bg-ink-fill text-white hover:bg-ink-fill-soft"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
