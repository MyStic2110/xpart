import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import {
  completeJobCardAndGenerateInvoice,
  listInvoices,
  getInvoiceDetail,
  recordPayment,
  redeemPoints,
  InvoiceError,
  PaymentError,
} from "./service";

const paymentSchema = z.object({
  mode: z.enum(["cash", "upi", "card", "wallet"]),
  amount: z.coerce.number().positive(), // rupees from the client, converted below
  txnRef: z.string().optional().or(z.literal("")),
});

const redeemSchema = z.object({
  points: z.coerce.number().int().positive(),
});

export async function invoiceRoutes(app: FastifyInstance) {
  app.post("/job-cards/:id/complete", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    try {
      const result = await completeJobCardAndGenerateInvoice(auth.orgId, id);
      return reply.code(result.alreadyExisted ? 200 : 201).send(result);
    } catch (err) {
      if (err instanceof InvoiceError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get("/invoices", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId } = req.query as { branchId?: string };
    const rows = await listInvoices(auth.orgId, branchId && branchId !== "all" ? branchId : null);
    return reply.send(rows);
  });

  app.get("/invoices/:id", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    try {
      const detail = await getInvoiceDetail(auth.orgId, id);
      return reply.send(detail);
    } catch (err) {
      if (err instanceof InvoiceError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/invoices/:id/payments", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await recordPayment(auth.orgId, id, {
        mode: parsed.data.mode,
        amount: Math.round(parsed.data.amount * 100),
        txnRef: parsed.data.txnRef || undefined,
      });
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof PaymentError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/invoices/:id/redeem-points", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await redeemPoints(auth.orgId, id, parsed.data.points);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof PaymentError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
