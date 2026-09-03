import { eq } from "drizzle-orm";
import { db } from "@/db";
import { careers } from "@/db/schema";

async function test() {
  const [row] = await db.select().from(careers).where(eq(careers.id, 6)).limit(1);
  console.log("before:", { id: row.id, week: row.week, status: row.status });
  
  const result = await db.update(careers)
    .set({ week: 99, updatedAt: new Date() })
    .where(eq(careers.id, 6))
    .returning({ id: careers.id, week: careers.week });
  console.log("update result:", result);
  
  const [after] = await db.select().from(careers).where(eq(careers.id, 6)).limit(1);
  console.log("after:", { id: after.id, week: after.week, status: after.status });
}

test().catch(e => { console.error("ERR", e); process.exit(1); });
