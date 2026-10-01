import { useAsync } from './useAsync'
import { fetchOrganization } from '../services/organization'

/** Arborescence régiments / compagnies / sections. */
export function useOrganization() {
  const { data, ...rest } = useAsync(fetchOrganization)
  return { org: data ?? { regiments: [], companies: [], sections: [] }, ...rest }
}
