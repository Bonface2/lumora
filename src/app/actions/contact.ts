"use server";

import { z } from "zod";
import { sendContactFormMessage } from "@/lib/email";

const schema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  email: z.string().email("Enter a valid email address."),
  subject: z.string().min(1, "Subject is required.").max(200),
  message: z.string().min(10, "Message must be at least 10 characters.").max(5000),
});

export async function submitContactForm(
  _: unknown,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await sendContactFormMessage(parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to send your message. Please try again." };
  }
}
