import { type ButtonHTMLAttributes, forwardRef } from "react";

const variants = {
  primary: "bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300",
  secondary: "bg-white text-violet-600 border border-violet-600 hover:bg-violet-50 disabled:opacity-50",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, children, className = "", disabled, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button };
