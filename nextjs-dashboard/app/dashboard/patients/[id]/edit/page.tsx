import { notFound } from 'next/navigation';
import { fetchPatientById } from '@/app/lib/data';
import { createClient } from '@/lib/supabase/server';
import EditForm from '@/app/ui/patients/edit-form';
import { UploadForm } from '@/app/ui/patients/upload-form';

/** Signed URLs are deliberately short-lived; the link stops working after this. */
const FILE_URL_TTL_SECONDS = 60;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const patient = await fetchPatientById(id);

  if (!patient) {
    notFound();
  }

  // The `patient-files` bucket is private, so we mint a short-lived signed URL
  // per request instead of exposing a permanent public link.
  let fileUrl: string | null = null;
  if (patient.file_path) {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from('patient-files')
      .createSignedUrl(patient.file_path, FILE_URL_TTL_SECONDS);

    if (error) {
      console.error('Failed to sign patient file URL:', error.message);
    } else {
      fileUrl = data?.signedUrl ?? null;
    }
  }

  return (
    <main>
      <h1 className="mb-6 text-2xl">Edit patient</h1>
      <EditForm patient={patient} />

      <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-medium">Patient file</h2>
        {fileUrl ? (
          <a
            href={fileUrl}
            className="text-sm font-medium text-blue-600 underline hover:text-blue-500"
          >
            Open file
          </a>
        ) : (
          <p className="text-sm text-gray-500">No file yet.</p>
        )}
        <div className="mt-4">
          <UploadForm patientId={patient.id} />
        </div>
      </section>
    </main>
  );
}