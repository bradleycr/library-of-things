/**
 * The spinning Foresight mark.
 *
 * Same icon the Foresight map uses while a page is loading. The wheel turns
 * on a wrapper, so the image itself stays a plain bitmap.
 */

interface NanowheelSpinnerProps {
  /** Tailwind size, e.g. `size-8`. The mark fills that box. */
  className?: string
}

export function NanowheelSpinner({ className = "size-8" }: NanowheelSpinnerProps) {
  return (
    <span className={`inline-flex animate-spin ${className}`} aria-hidden>
      <img
        src="/foresight-icon.png"
        alt=""
        className="h-full w-full object-contain opacity-80"
        draggable={false}
      />
    </span>
  )
}
