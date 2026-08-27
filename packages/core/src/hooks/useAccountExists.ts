import { useState, useEffect, useCallback, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isValidStellarAddress } from "../utils"
import { toStellarError } from "../errors"
import type { UseAccountExistsOptions, UseAccountExistsReturn } from "../types"

export function useAccountExists({
  address,
}: UseAccountExistsOptions = {}): UseAccountExistsReturn {
  const { network } = useStellarContext()

  const [exists, setExists] = useState<boolean | null>(null)
  const [reason, setReason] = useState<UseAccountExistsReturn["reason"]>("idle")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<UseAccountExistsReturn["error"]>(null)

  const requestRef = useRef(0)

  const fetchExists = useCallback(async () => {
    const fetchId = ++requestRef.current

    if (!address) {
      setExists(null)
      setReason("idle")
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setExists(null) // Reset while loading, or keep previous? Instructions say: "null while loading / idle"

    if (!isValidStellarAddress(address)) {
      setExists(false)
      setReason("invalid_format")
      setLoading(false)
      return
    }

    try {
      const server = getHorizonServer(network)
      await server.loadAccount(address)

      if (fetchId !== requestRef.current) return

      setExists(true)
      setReason("exists")
    } catch (err: unknown) {
      if (fetchId !== requestRef.current) return

      const stellarError = toStellarError(err)

      // toStellarError may return null for abort errors
      if (!stellarError) {
        return
      }

      if (stellarError.code === "ACCOUNT_NOT_FOUND") {
        setExists(false)
        setReason("not_funded")
        setError(null)
      } else {
        setExists(null)
        // reason doesn't explicitly have an error state, but let's leave it as is or change it?
        // Wait, if it fails, what is the reason? The requirements say:
        // "Any other failure (network, rate-limit) → error via toStellarError, and leave exists as null."
        // We probably don't need to change reason, but let's set it to whatever it was or keep it.
        // Actually, if we just set error, it's fine.
        setError(stellarError)
      }
    } finally {
      if (fetchId === requestRef.current) {
        setLoading(false)
      }
    }
  }, [address, network])

  useEffect(() => {
    fetchExists()
    return () => {
      requestRef.current = -1
    }
  }, [fetchExists])

  return { exists, reason, loading, error, refetch: fetchExists }
}
