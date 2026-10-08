import { uploadPatientFile } from '@/app/lib/actions'

export function UploadForm({ patientId }: { patientId: string }) {
  const upload = uploadPatientFile.bind(null, patientId)
  return (
    <form action={upload}>
      <input type="file" name="file" required />
      <button type="submit">Upload</button>
    </form>
  )
}