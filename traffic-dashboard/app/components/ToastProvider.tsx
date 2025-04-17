"use client";

import React, { createContext, useContext, ReactNode, useState } from "react";
import { AlertData } from "../types";
import { AlertCircle, Info, AlertTriangle, CheckCircle } from "lucide-react";

interface ToastContextType {
  showToast: (
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => void;
  showAlertToast: (alert: AlertData) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const showAlertToast = (alert: AlertData) => {
    if (!alert) return;

    // Convert alert severity to toast type
    let type: "info" | "success" | "warning" | "error" = "info";
    switch (alert.alert_severity.toLowerCase()) {
      case "high":
        type = "error";
        break;
      case "medium":
        type = "warning";
        break;
      case "low":
        type = "info";
        break;
      default:
        type = "info";
    }

    showToast(alert.alert_message, type);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const getToastIcon = (type: "info" | "success" | "warning" | "error") => {
    switch (type) {
      case "info":
        return <Info className="h-5 w-5" />;
      case "success":
        return <CheckCircle className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      case "error":
        return <AlertCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getToastColor = (type: "info" | "success" | "warning" | "error") => {
    switch (type) {
      case "info":
        return "bg-blue-100 border-blue-400 text-blue-700";
      case "success":
        return "bg-green-100 border-green-400 text-green-700";
      case "warning":
        return "bg-yellow-100 border-yellow-400 text-yellow-700";
      case "error":
        return "bg-red-100 border-red-400 text-red-700";
      default:
        return "bg-gray-100 border-gray-400 text-gray-700";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showAlertToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${getToastColor(
              toast.type
            )} border-l-4 p-4 rounded shadow-md flex items-start`}
            role="alert"
          >
            <div className="mr-2">{getToastIcon(toast.type)}</div>
            <div className="flex-grow">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Helper function to show an alert toast (can be imported directly)
export const showAlertToast = (alert: AlertData) => {
  // This is a helper function that will be available for direct imports
  // It will attempt to find the toast context, but if it's not available, it will
  // fallback to console.log to avoid errors
  try {
    const { showAlertToast: contextShowAlertToast } = useToast();
    contextShowAlertToast(alert);
  } catch (error) {
    console.warn("ToastProvider not found, logging alert instead:", alert);
    console.log(alert.alert_message);
  }
};
