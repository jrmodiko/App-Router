'use server';
import { z } from 'zod';
import postgres from 'postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { createClient } from '@/lib/supabase/server';
import { fromDateTimeLocal } from '@/app/lib/time'

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

   if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];
  // Test it out:
//   console.log(rawFormData);

try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    // We'll also log the error to the console for now
    console.error(error);
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }
 
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
 
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }
 
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

const PatientSchema = z.object({
  full_name: z.string().min(1, { message: 'Please enter the patient\'s full name.' }),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
});

export type PatientState = {
  errors?: {
    full_name?: string[];
    phone?: string[];
    date_of_birth?: string[];
  };
  message?: string | null;
};

export async function createPatient(prevState: PatientState, formData: FormData) {
  const validated = PatientSchema.safeParse({
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
    date_of_birth: formData.get('date_of_birth'),
  });
  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
      message: 'Missing fields. Failed to create patient.',
    };
  }
  const { full_name, phone, date_of_birth } = validated.data;

  const supabase = await createClient();
  const { error } = await supabase.from('patients').insert({
    full_name,
    phone: phone || null,
    date_of_birth: date_of_birth || null,
    // user_id is not sent: the column default auth.uid() fills it
  });
  if (error) {
    console.error('Supabase error:', error);
    return { message: `Database error ${error.code}: failed to create patient.` };
  }

  revalidatePath('/dashboard/patients');
  redirect('/dashboard/patients');
}

export async function updatePatient(
  id: string,
  prevState: PatientState,
  formData: FormData,
) {
  const validated = PatientSchema.safeParse({
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
    date_of_birth: formData.get('date_of_birth'),
  });
  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
      message: 'Missing fields. Failed to update patient.',
    };
  }
  const { full_name, phone, date_of_birth } = validated.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from('patients')
    .update({ full_name, phone: phone || null, date_of_birth: date_of_birth || null })
    .eq('id', id);
  if (error) {
    console.error('Supabase error:', error);
    return { message: `Database error ${error.code}: failed to update patient.` };
  }

  revalidatePath('/dashboard/patients');
  redirect('/dashboard/patients');
}

export async function deletePatient(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('patients').delete().eq('id', id);
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(`Database error ${error.code}: failed to delete patient.`);
  }
  revalidatePath('/dashboard/patients');
}

/**
 * Resolve the Supabase user id (auth.uid() / auth.jwt()->>'sub') from the
 * access token NextAuth keeps on the session — the same token
 * lib/supabase/server.ts sends as the Authorization header.
 *
 * supabase.auth.getClaims()/getUser() cannot be used in a server action: they
 * read the session from storage, and the server client is created with
 * persistSession: false, so they always resolve to "Auth session missing!"
 * and the upload would silently no-op.
 */
function getSupabaseUserId(session: { supabaseAccessToken?: string } | null): string | null {
  const token = session?.supabaseAccessToken;
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function uploadPatientFile(patientId: string, formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return

  const userId = getSupabaseUserId(await auth())
  if (!userId) return

  const supabase = await createClient()
  const path = `${userId}/${patientId}/${file.name}`
  const { data, error } = await supabase.storage.from('patient-files').upload(path, file)
  if (error) throw new Error(error.message)

  const { error: updateError } = await supabase
    .from('patients')
    .update({ file_path: data.path })
    .eq('id', patientId)
  if (updateError) {
    console.error('Supabase error:', updateError)
    throw new Error(`Database error ${updateError.code}: failed to save file path.`)
  }

  revalidatePath(`/dashboard/patients/${patientId}/edit`)
}

const AppointmentSchema = z.object({
  patient_id: z.string().min(1),
  starts_at: z.string().min(16),
  status: z.enum(['booked', 'done', 'no_show']),
})

function parseAppointment(formData: FormData) {
  return AppointmentSchema.parse({
    patient_id: formData.get('patient_id'),
    starts_at: formData.get('starts_at'),
    status: formData.get('status'),
  })
}

export async function createAppointment(formData: FormData) {
  const a = parseAppointment(formData)
  const supabase = await createClient()
  const { error } = await supabase.from('appointments').insert({
    patient_id: a.patient_id,
    starts_at: fromDateTimeLocal(a.starts_at),
    status: a.status,
  })
  if (error) throw new Error(`${error.code}: ${error.message}`)
  revalidatePath('/dashboard/appointments')
  redirect('/dashboard/appointments')
}

export async function updateAppointment(id: string, formData: FormData) {
  const a = parseAppointment(formData)
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ patient_id: a.patient_id, starts_at: fromDateTimeLocal(a.starts_at), status: a.status })
    .eq('id', id)
  if (error) throw new Error(`${error.code}: ${error.message}`)
  revalidatePath('/dashboard/appointments')
  redirect('/dashboard/appointments')
}

export async function deleteAppointment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('appointments').delete().eq('id', id)
  if (error) throw new Error(`${error.code}: ${error.message}`)
  revalidatePath('/dashboard/appointments')
}