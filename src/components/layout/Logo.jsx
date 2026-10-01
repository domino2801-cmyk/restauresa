/** Emblème de l'application (écusson + couverts). */
export function Logo({ className = 'h-10 w-10' }) {
  return <img src="/favicon.svg" alt="" aria-hidden="true" className={className} />
}
