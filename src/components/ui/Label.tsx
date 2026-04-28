import { type LabelHTMLAttributes } from "react";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, children, className = "", ...props }: LabelProps) {
  return (
    <label
      className={`block text-sm font-medium text-gray-700 ${className}`}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}
