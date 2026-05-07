/* RESALE:
import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { connection, QUEUES, type ResaleExpiryJob } from "@/lib/queue";

const worker = new Worker<ResaleExpiryJob>(
  QUEUES.RESALE_EXPIRY,
  async (job) => {
    const { resaleListingId } = job.data;

    const listing = await db.resaleListing.findUnique({
      where: { id: resaleListingId },
    });

    if (!listing || listing.status !== "ACTIVE") return;

    await db.resaleListing.update({
      where: { id: resaleListingId },
      data: { status: "REVOKED" },
    });
  },
  { connection: connection() }
);

worker.on("failed", (job, err) => {
  console.error(`Resale expiry job ${job?.id} failed:`, err.message);
});

export default worker;
*/
