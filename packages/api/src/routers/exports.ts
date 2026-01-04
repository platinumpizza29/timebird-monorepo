import { ORPCError } from "@orpc/server";
import prisma from "@timebird/db";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { protectedProcedure } from "../index";
import { exportCsvInputSchema, exportCsvOutputSchema } from "../schemas/timebird";

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export const exportRouter = {
  csv: protectedProcedure
    .input(exportCsvInputSchema)
    .output(exportCsvOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, userId },
      });
      if (!job) {
        throw new ORPCError("NOT_FOUND");
      }

      const fromUtc = new Date(input.fromUtc);
      const toUtc = new Date(input.toUtc);
      const shifts = await prisma.shift.findMany({
        where: {
          userId,
          jobId: job.id,
          startUtc: { lt: toUtc },
          endUtc: { gt: fromUtc },
        },
        orderBy: { startUtc: "asc" },
      });

      if (input.type === "summaries") {
        const totals = new Map<string, number>();
        for (const shift of shifts) {
          const localDate = toZonedTime(shift.startUtc, job.timezone);
          const dateKey = format(localDate, "yyyy-MM-dd");
          totals.set(dateKey, (totals.get(dateKey) ?? 0) + shift.payableMinutes);
        }
        const rows = Array.from(totals.entries()).sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
        const header = ["date", "payable_minutes"];
        const lines = [
          header.join(","),
          ...rows.map(([dateKey, minutes]) =>
            [dateKey, minutes.toString()].map(escapeCsv).join(","),
          ),
        ];
        return {
          filename: `timebird-summary-${input.fromUtc}-${input.toUtc}.csv`,
          contentType: "text/csv",
          csv: lines.join("\n"),
        };
      }

      const header = [
        "start_utc",
        "end_utc",
        "payable_minutes",
        "role_tag",
        "site_tag",
        "notes",
      ];
      const lines = [
        header.join(","),
        ...shifts.map((shift) =>
          [
            shift.startUtc.toISOString(),
            shift.endUtc.toISOString(),
            shift.payableMinutes.toString(),
            shift.roleTag ?? "",
            shift.siteTag ?? "",
            shift.notes ?? "",
          ]
            .map(escapeCsv)
            .join(","),
        ),
      ];
      return {
        filename: `timebird-shifts-${input.fromUtc}-${input.toUtc}.csv`,
        contentType: "text/csv",
        csv: lines.join("\n"),
      };
    }),
};
