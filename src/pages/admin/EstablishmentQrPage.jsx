import { useCallback } from 'react'
import QRCode from 'qrcode'
import { Alert, Card, PageHeader, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { errorMessage } from '../../lib/errors'
import { getEstablishmentQr } from '../../services/checkin'

export default function EstablishmentQrPage() {
  const load = useCallback(async () => {
    const content = await getEstablishmentQr()
    return QRCode.toDataURL(content, { width: 600, margin: 4, errorCorrectionLevel: 'M' })
  }, [])
  const { data, error, loading } = useAsync(load)
  return (
    <>
      <PageHeader title="QR code établissement" subtitle="QR permanent commun à RestauResa, à afficher à l’entrée du mess." />
      <Alert tone="error">{errorMessage(error)}</Alert>
      <Alert tone="warning">Un QR permanent peut être copié. Il ne prouve pas à lui seul la présence physique sur place.</Alert>
      {loading ? <Spinner /> : data && (
        <Card title="Validation du passage">
          <img src={data} alt="QR code établissement pour valider le passage" className="mx-auto w-full max-w-sm" />
          <p className="my-3 text-sm">Sur votre compte : « Scanner mon passage », choisissez votre repas du jour, puis scannez ce code.</p>
          <a href={data} download="restauresa-qr-etablissement.png" className="font-semibold text-olive-700 underline">Télécharger le QR code</a>
        </Card>
      )}
    </>
  )
}
