"use client";

import { genUploader } from "uploadthing/client";
import type { OurFileRouter } from "./uploadthing";

export const { uploadFiles } = genUploader<OurFileRouter>();
