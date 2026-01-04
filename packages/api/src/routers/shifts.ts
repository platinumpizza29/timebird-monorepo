import { ORPCError } from "@orpc/server";
import prisma from "@timebird/db";

import { calculatePayableMinutes } from "../lib/calculations";
import { protectedProcedure } from "../index";
import {
  shiftCreateInputSchema,
  shiftDeleteInputSchema,
  shiftDeleteOutputSchema,
  shiftListInputSchema,
  shiftListOutputSchema,
  shiftOutputSchema,
  shiftUpdateInputSchema,
} from "../schemas/timebird";

function toShiftOutput(shift: {
  id: string;
  jobId: string;
  startUtc: Date;
  endUtc: Date;
  payableMinutes: number;
  roleTag: string | null;
  siteTag: string | null;
  notes: string | null;
  worksiteId: string | null;
  breaks: { minutes: number; paid: boolean }[];
}) {
  return {
    shiftId: shift.id,
    jobId: shift.jobId,
    startUtc: shift.startUtc.toISOString(),
    endUtc: shift.endUtc.toISOString(),
    breaks: shift.breaks.map((item) => ({
      minutes: item.minutes,
      paid: item.paid,
    })),
    payableMinutes: shift.payableMinutes,
    roleTag: shift.roleTag,
    siteTag: shift.siteTag,
    notes: shift.notes,
    worksiteId: shift.worksiteId,
  };
}

export const shiftRouter = {
  create: protectedProcedure
    .input(shiftCreateInputSchema)
    .output(shiftOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }

      const startUtc = new Date(input.startUtc);
      const endUtc = new Date(input.endUtc);
      if (endUtc <= startUtc) {
        throw new ORPCError("BAD_REQUEST");
      }

      const breaks =
        input.breaks ??
        (job.standardBreakMinutes
          ? [{ minutes: job.standardBreakMinutes, paid: job.standardBreakPaid }]
          : []);
      const payableMinutes = calculatePayableMinutes(
        startUtc,
        endUtc,
        breaks,
        job.roundingMinutes && job.roundingMode
          ? { minutes: job.roundingMinutes, mode: job.roundingMode }
          : null,
      );

      const created = await prisma.shift.create({
        data: {
          userId,
          jobId: input.jobId,
          startUtc,
          endUtc,
          payableMinutes,
          roleTag: input.roleTag ?? null,
          siteTag: input.siteTag ?? null,
          notes: input.notes ?? null,
          worksiteId: input.worksiteId ?? null,
          breaks: breaks.length
            ? {
                create: breaks.map((item) => ({
                  minutes: item.minutes,
                  paid: item.paid ?? false,
                })),
              }
            : undefined,
        },
        include: {
          breaks: true,
        },
      });

      return toShiftOutput({
        ...created,
        breaks: created.breaks.map((item) => ({
          minutes: item.minutes,
          paid: item.paid,
        })),
      });
    }),
  update: protectedProcedure
    .input(shiftUpdateInputSchema)
    .output(shiftOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const existing = await prisma.shift.findFirst({
        where: { id: input.shiftId, userId },
        include: { breaks: true, job: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND");
      }

      const startUtc = input.patch.startUtc
        ? new Date(input.patch.startUtc)
        : existing.startUtc;
      const endUtc = input.patch.endUtc
        ? new Date(input.patch.endUtc)
        : existing.endUtc;
      if (endUtc <= startUtc) {
        throw new ORPCError("BAD_REQUEST");
      }

      const breaksInput =
        input.patch.breaks !== undefined
          ? input.patch.breaks ?? []
          : existing.breaks.map((item) => ({
              minutes: item.minutes,
              paid: item.paid,
            }));

      const payableMinutes = calculatePayableMinutes(
        startUtc,
        endUtc,
        breaksInput,
        existing.job.roundingMinutes && existing.job.roundingMode
          ? { minutes: existing.job.roundingMinutes, mode: existing.job.roundingMode }
          : null,
      );

      const result = await prisma.$transaction(async (tx) => {
        if (input.patch.breaks !== undefined) {
          await tx.shiftBreak.deleteMany({
            where: { shiftId: existing.id },
          });
          if (breaksInput.length) {
            await tx.shiftBreak.createMany({
              data: breaksInput.map((item) => ({
                shiftId: existing.id,
                minutes: item.minutes,
                paid: item.paid ?? false,
              })),
            });
          }
        }

        const updated = await tx.shift.update({
          where: { id: existing.id },
          data: {
            startUtc,
            endUtc,
            payableMinutes,
            roleTag:
              input.patch.roleTag !== undefined
                ? input.patch.roleTag
                : existing.roleTag,
            siteTag:
              input.patch.siteTag !== undefined
                ? input.patch.siteTag
                : existing.siteTag,
            notes:
              input.patch.notes !== undefined
                ? input.patch.notes
                : existing.notes,
            worksiteId:
              input.patch.worksiteId !== undefined
                ? input.patch.worksiteId
                : existing.worksiteId,
          },
          include: { breaks: true },
        });

        return updated;
      });

      return toShiftOutput({
        ...result,
        breaks: result.breaks.map((item) => ({
          minutes: item.minutes,
          paid: item.paid,
        })),
      });
    }),
  delete: protectedProcedure
    .input(shiftDeleteInputSchema)
    .output(shiftDeleteOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const shift = await prisma.shift.findFirst({
        where: { id: input.shiftId, userId },
      });
      if (!shift) {
        throw new ORPCError("NOT_FOUND");
      }
      await prisma.shift.delete({
        where: { id: shift.id },
      });
      return { shiftId: shift.id };
    }),
  get: protectedProcedure
    .input(
      shiftOutputSchema.pick({
        shiftId: true,
      }),
    )
    .output(shiftOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const shift = await prisma.shift.findFirst({
        where: { id: input.shiftId, userId },
        include: { breaks: true },
      });
      if (!shift) {
        throw new ORPCError("NOT_FOUND");
      }
      return toShiftOutput({
        ...shift,
        breaks: shift.breaks.map((item) => ({
          minutes: item.minutes,
          paid: item.paid,
        })),
      });
    }),
  list: protectedProcedure
    .input(shiftListInputSchema)
    .output(shiftListOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const shifts = await prisma.shift.findMany({
        where: {
          userId,
          ...(input.jobId ? { jobId: input.jobId } : {}),
          ...(input.fromUtc ? { startUtc: { gte: new Date(input.fromUtc) } } : {}),
          ...(input.toUtc ? { endUtc: { lte: new Date(input.toUtc) } } : {}),
          ...(input.roleTag ? { roleTag: input.roleTag } : {}),
          ...(input.siteTag ? { siteTag: input.siteTag } : {}),
        },
        orderBy: { startUtc: input.sort === "startAsc" ? "asc" : "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const items = shifts.slice(0, input.limit).map((shift) => ({
        shiftId: shift.id,
        jobId: shift.jobId,
        startUtc: shift.startUtc.toISOString(),
        endUtc: shift.endUtc.toISOString(),
        payableMinutes: shift.payableMinutes,
        roleTag: shift.roleTag,
        siteTag: shift.siteTag,
        worksiteId: shift.worksiteId,
      }));
      const nextCursor =
        shifts.length > input.limit ? shifts[input.limit]?.id ?? null : null;
      return {
        items,
        nextCursor,
      };
    }),
};
