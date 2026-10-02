import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { Alert, Button, Card, PageHeader, Select } from '../../components/ui'
import { SERVICES, SERVICE_LABELS } from '../../lib/constants'
import { errorMessage } from '../../lib/errors'
import { checkInMeal } from '../../services/checkin'

export default function MealCheckinPage() {
  const video = useRef(null)
  const scanner = useRef(null)
  const processing = useRef(false)
  const [service, setService] = useState('dejeuner')
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const stop = () => {
    scanner.current?.destroy()
    scanner.current = null
    setScanning(false)
  }
  useEffect(() => {
    const pause = () => {
      if (document.hidden) {
        scanner.current?.destroy()
        scanner.current = null
        setScanning(false)
      }
    }
    document.addEventListener('visibilitychange', pause)
    return () => {
      document.removeEventListener('visibilitychange', pause)
      scanner.current?.destroy()
      scanner.current = null
    }
  }, [])

  const validate = async (content) => {
    if (processing.current) return
    processing.current = true
    stop()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await checkInMeal(content, service)
      setSuccess(`Passage validé — ${SERVICE_LABELS[service]} du jour.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      processing.current = false
      setBusy(false)
    }
  }

  const start = async () => {
    setError(null)
    setSuccess(null)
    setScanning(true)
    const instance = new QrScanner(video.current, (result) => {
      if (scanner.current === instance) void validate(result.data)
    }, {
      preferredCamera: 'environment', returnDetailedScanResult: true,
      highlightScanRegion: true,
    })
    scanner.current = instance
    try {
      await instance.start()
    } catch (err) {
      if (scanner.current === instance) {
        stop()
        setError(`Caméra indisponible : autorisez son accès et réessayez. ${errorMessage(err)}`)
      }
    }
  }

  return (
    <>
      <PageHeader title="Scanner mon passage" subtitle="Choisissez votre repas du jour puis scannez le QR code affiché à l’établissement." />
      <Alert tone="error">{error}</Alert>
      <Alert tone="success">{success}</Alert>
      <Card title="Repas du jour">
        <div className="space-y-4">
          <Select label="Service" value={service} disabled={scanning || busy}
            options={SERVICES.map((value) => ({ value, label: SERVICE_LABELS[value] }))}
            onChange={(event) => { setService(event.target.value); setSuccess(null); setError(null) }} />
          <p className="text-sm text-steel-600">Seule une réservation confirmée pour aujourd’hui (heure de Paris) peut être pointée. Un passage ne peut être validé qu’une fois par repas.</p>
          <video ref={video} muted playsInline className={`w-full rounded-md ${scanning ? '' : 'hidden'}`} aria-label="Caméra du lecteur QR code" />
          {scanning
            ? <Button onClick={stop} variant="outline">Arrêter le lecteur</Button>
            : <Button onClick={start} loading={busy}>Scanner le QR code</Button>}
        </div>
      </Card>
    </>
  )
}
