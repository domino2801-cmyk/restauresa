import { useCallback, useState } from 'react'
import QRCode from 'qrcode'
import { Alert, Button, Card, PageHeader, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { errorMessage } from '../../lib/errors'
import { getEstablishmentQr, rotateEstablishmentQr } from '../../services/checkin'

export default function EstablishmentQrPage() {
  const [content, setContent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [success, setSuccess] = useState(null)
  const load = useCallback(async () => {
    const current = content ?? await getEstablishmentQr()
    return QRCode.toDataURL(current, { width: 600, margin: 4, errorCorrectionLevel: 'M' })
  }, [content])
  const { data, error, loading, reload } = useAsync(load)
  const generate = async () => {
    if (!window.confirm('Générer un nouveau QR code ? L’ancien sera immédiatement invalidé. Les passages enregistrés seront conservés. Remplacez le code affiché au mess.')) return
    setBusy(true)
    setReplacing(true)
    setActionError(null)
    setSuccess(null)
    try {
      const next = await rotateEstablishmentQr()
      setContent(next)
      setReplacing(false)
      setSuccess('Nouveau QR code généré. L’ancien est invalidé. Remplacez le code affiché au mess.')
    } catch (err) {
      setActionError(`${errorMessage(err)} Rechargez le QR actuel pour vérifier le code actif avant de l’afficher.`)
    } finally {
      setBusy(false)
    }
  }
  const recover = async () => {
    setContent(null)
    // When content changes, useAsync fetches the current server code.
    if (content === null) await reload()
    setActionError(null)
    setReplacing(false)
  }
  return (
    <>
      <PageHeader title="QR code établissement" subtitle="QR permanent commun à RestauResa, à afficher à l’entrée du mess." />
      <Alert tone="error">{actionError ?? errorMessage(error)}</Alert>
      <Alert tone="success">{!loading && !error && !replacing ? success : null}</Alert>
      <Alert tone="warning">Un QR permanent peut être copié. Il ne prouve pas à lui seul la présence physique sur place.</Alert>
      <div className="my-4 flex flex-wrap gap-3">
        <Button onClick={generate} loading={busy} disabled={loading || replacing}>Générer un nouveau QR code</Button>
        {replacing && !busy && <Button onClick={recover} variant="outline">Recharger le QR actuel</Button>}
      </div>
      {loading || busy ? <Spinner /> : !error && !replacing && data && (
        <Card title="Validation du passage">
          <img src={data} alt="QR code établissement pour valider le passage" className="mx-auto w-full max-w-sm" />
          <p className="my-3 text-sm">Sur votre compte : « Scanner mon passage », choisissez votre repas du jour, puis scannez ce code.</p>
          <a href={data} download="restauresa-qr-etablissement.png" className="font-semibold text-olive-700 underline">Télécharger le QR code</a>
        </Card>
      )}
    </>
  )
}
