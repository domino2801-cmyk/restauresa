/** Emblème de l'application. */
export function Logo({ className = 'h-10 w-10' }) {
  return <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" aria-hidden="true" className={className} />
}
