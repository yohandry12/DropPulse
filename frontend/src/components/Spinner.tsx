// Small inline spinner for async button labels. Sized in em so it scales with
// the button's font-size; currentColor so it inherits the button's text colour.
export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block h-[1em] w-[1em] animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] ${className}`}
    />
  );
}
