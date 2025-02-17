import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";

// Define the schema without using the File API
const FileSchema = z.object({
  type: z.string().refine(
    (type) => ["image/jpeg", "image/png", "application/pdf"].includes(type),
    {
      message: "File type should be JPEG, PNG, or PDF",
    }
  ),
  size: z.number().refine((size) => size <= 5 * 1024 * 1024, {
    message: "File size should be less than 5MB",
  }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file without using File type
    const validatedFile = FileSchema.safeParse({
      type: (file as any).type,
      size: (file as any).size,
    });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    try {
      // Convert file to buffer
      const buffer = await (file as any).arrayBuffer();
      const filename = (file as any).name;

      const data = await put(filename, buffer, {
        access: "public",
      });

      return NextResponse.json(data);
    } catch (error) {
      console.error("Upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
