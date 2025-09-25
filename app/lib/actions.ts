"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

export type State = {
  message?: string;
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
};

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ message: "Please select a customer." }),
  amount: z.coerce.number().gt(0, "Please enter an amount greater than $0."),
  status: z.enum(["paid", "pending"], {
    message: "Please select an invoice status.",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(
  _: State,
  formData: FormData
): Promise<State> {
  const validatedFields = CreateInvoice.safeParse(Object.fromEntries(formData));

  if (!validatedFields.success) {
    return {
      message: "Missing Fields. Failed to Create Invoice.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { amount, customerId, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error) {
    console.error("Database Error:", error);
    return {
      message: "Database Error: Failed to Create Invoice.",
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  _: State,
  formData: FormData
): Promise<State> {
  const validatedFields = UpdateInvoice.safeParse(Object.fromEntries(formData));

  if (!validatedFields.success) {
    return {
      message: "Missing Fields. Failed to Update Invoice.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { amount, customerId, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    console.error("Database Error:", error);
    return {
      message: "Database Error: Failed to Update Invoice.",
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string, _: State): Promise<State> {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;

    revalidatePath("/dashboard/invoices");
    return { message: "Invoice deleted successfully." };
  } catch (error) {
    console.error("Database Error:", error);
    return {
      message: "Database Error: Failed to Delete Invoice.",
    };
  }
}
