/** Emblème de l'application (écusson + couverts). */
export function Logo({ className = 'h-10 w-10' }) {
  return <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" aria-hidden="true" className={className} />
}
