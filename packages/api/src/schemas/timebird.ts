import { z } from "zod";

export const idSchema = z.string().min(1);

export const payCycleSchema = z.enum([
  "weekly",
  "bi_weekly",
  "four_weekly",
  "monthly",
]);

export const roundingModeSchema = z.enum(["nearest", "floor", "ceil"]);

export const breakSchema = z.object({
  minutes: z.number().int().nonnegative(),
  paid: z.boolean().optional().default(false),
});

export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3).default("GBP"),
});

export const roundingRuleSchema = z.object({
  minutes: z.number().int().positive(),
  mode: roundingModeSchema,
});

export const overtimeRuleSchema = z.object({
  dailyThresholdMinutes: z.number().int().nonnegative().optional(),
  weeklyThresholdMinutes: z.number().int().nonnegative().optional(),
  multiplier: z.number().min(1).max(5).optional(),
});

export const payPeriodAnchorSchema = z.object({
  weekday: z.number().int().min(0).max(6).optional(),
  monthday: z.number().int().min(1).max(31).optional(),
  startDateUtc: z.string().datetime().optional(),
});

export const jobCreateInputSchema = z
  .object({
    name: z.string().min(1).max(100),
    hourlyRate: moneySchema,
    contractedMinutesPerWeek: z.number().int().positive().optional(),
    payCycle: payCycleSchema,
    payPeriodAnchor: payPeriodAnchorSchema,
    standardBreak: breakSchema.optional(),
    rounding: roundingRuleSchema.optional(),
    overtimeRule: overtimeRuleSchema.optional(),
    timezone: z.string().min(1).default("Europe/London"),
  })
  .superRefine((value, ctx) => {
    if (value.payCycle === "monthly" && !value.payPeriodAnchor.monthday) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Monthly pay cycle requires payPeriodAnchor.monthday",
        path: ["payPeriodAnchor", "monthday"],
      });
    }
    if (
      (value.payCycle === "weekly" ||
        value.payCycle === "bi_weekly" ||
        value.payCycle === "four_weekly") &&
      value.payPeriodAnchor.weekday === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Weekly pay cycles require payPeriodAnchor.weekday",
        path: ["payPeriodAnchor", "weekday"],
      });
    }
    if (
      (value.payCycle === "bi_weekly" || value.payCycle === "four_weekly") &&
      !value.payPeriodAnchor.startDateUtc
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bi-weekly/four-weekly requires payPeriodAnchor.startDateUtc",
        path: ["payPeriodAnchor", "startDateUtc"],
      });
    }
  });

export const jobUpdateInputSchema = z.object({
  jobId: idSchema,
  patch: z.object({
    name: z.string().min(1).max(100).optional(),
    hourlyRate: moneySchema.optional(),
    contractedMinutesPerWeek: z.number().int().positive().nullable().optional(),
    payCycle: payCycleSchema.optional(),
    payPeriodAnchor: payPeriodAnchorSchema.optional(),
    standardBreak: breakSchema.nullable().optional(),
    rounding: roundingRuleSchema.nullable().optional(),
    overtimeRule: overtimeRuleSchema.nullable().optional(),
    timezone: z.string().min(1).optional(),
  }),
});

export const jobOutputSchema = z.object({
  jobId: idSchema,
  name: z.string(),
  hourlyRate: moneySchema,
  contractedMinutesPerWeek: z.number().int().nullable(),
  payCycle: payCycleSchema,
  payPeriodAnchor: payPeriodAnchorSchema,
  standardBreak: breakSchema.nullable(),
  rounding: roundingRuleSchema.nullable(),
  overtimeRule: overtimeRuleSchema.nullable(),
  timezone: z.string(),
});

export const jobListInputSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(50).default(20),
  activeOnly: z.boolean().optional(),
});

export const jobListOutputSchema = z.object({
  items: z.array(
    z.object({
      jobId: idSchema,
      name: z.string(),
      hourlyRate: moneySchema,
      payCycle: payCycleSchema,
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const shiftCreateInputSchema = z.object({
  jobId: idSchema,
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  breaks: z.array(breakSchema).optional(),
  roleTag: z.string().max(50).optional(),
  siteTag: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  worksiteId: idSchema.optional(),
});

export const shiftUpdateInputSchema = z.object({
  shiftId: idSchema,
  patch: z.object({
    startUtc: z.string().datetime().optional(),
    endUtc: z.string().datetime().optional(),
    breaks: z.array(breakSchema).nullable().optional(),
    roleTag: z.string().max(50).nullable().optional(),
    siteTag: z.string().max(50).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    worksiteId: idSchema.nullable().optional(),
  }),
});

export const shiftDeleteInputSchema = z.object({
  shiftId: idSchema,
});

export const shiftDeleteOutputSchema = z.object({
  shiftId: idSchema,
});

export const shiftOutputSchema = z.object({
  shiftId: idSchema,
  jobId: idSchema,
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  breaks: z.array(breakSchema),
  payableMinutes: z.number().int(),
  roleTag: z.string().nullable(),
  siteTag: z.string().nullable(),
  notes: z.string().nullable(),
  worksiteId: idSchema.nullable(),
});

export const shiftListInputSchema = z.object({
  jobId: idSchema.optional(),
  fromUtc: z.string().datetime().optional(),
  toUtc: z.string().datetime().optional(),
  roleTag: z.string().optional(),
  siteTag: z.string().optional(),
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
  sort: z.enum(["startAsc", "startDesc"]).default("startDesc"),
});

export const shiftListOutputSchema = z.object({
  items: z.array(
    z.object({
      shiftId: idSchema,
      jobId: idSchema,
      startUtc: z.string().datetime(),
      endUtc: z.string().datetime(),
      payableMinutes: z.number().int(),
      roleTag: z.string().nullable(),
      siteTag: z.string().nullable(),
      worksiteId: idSchema.nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const payPeriodInputSchema = z.object({
  jobId: idSchema,
  atUtc: z.string().datetime().optional(),
});

export const payPeriodListInputSchema = z.object({
  jobId: idSchema,
  fromUtc: z.string().datetime().optional(),
  toUtc: z.string().datetime().optional(),
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(50).default(12),
});

export const payPeriodOutputSchema = z.object({
  jobId: idSchema,
  periodStartUtc: z.string().datetime(),
  periodEndUtc: z.string().datetime(),
  payCycle: payCycleSchema,
});

export const payPeriodListOutputSchema = z.object({
  items: z.array(
    z.object({
      periodStartUtc: z.string().datetime(),
      periodEndUtc: z.string().datetime(),
      payCycle: payCycleSchema,
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const summaryPayPeriodInputSchema = z.object({
  jobId: idSchema,
  periodStartUtc: z.string().datetime(),
  periodEndUtc: z.string().datetime(),
});

export const summaryPayPeriodOutputSchema = z.object({
  totalMinutes: z.number().int(),
  overtimeMinutes: z.number().int(),
  grossEarnings: moneySchema,
  projectedEarnings: moneySchema,
  contractedMinutesPerWeek: z.number().int().nullable(),
});

export const summaryMonthInputSchema = z.object({
  jobId: idSchema,
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const summaryMonthOutputSchema = z.object({
  month: z.string(),
  totalMinutes: z.number().int(),
  overtimeMinutes: z.number().int(),
  grossEarnings: moneySchema,
});

export const summaryRangeInputSchema = z.object({
  jobId: idSchema,
  fromUtc: z.string().datetime(),
  toUtc: z.string().datetime(),
  bucket: z.enum(["day", "week", "month"]),
});

export const summaryRangeOutputSchema = z.object({
  buckets: z.array(
    z.object({
      startUtc: z.string().datetime(),
      endUtc: z.string().datetime(),
      totalMinutes: z.number().int(),
      overtimeMinutes: z.number().int(),
      grossEarnings: moneySchema,
    }),
  ),
});

export const summaryCompareInputSchema = z.object({
  jobId: idSchema,
  fromUtc: z.string().datetime(),
  toUtc: z.string().datetime(),
});

export const summaryCompareOutputSchema = z.object({
  contractedMinutes: z.number().int().nullable(),
  actualMinutes: z.number().int(),
  deltaMinutes: z.number().int().nullable(),
});

export const exportCsvInputSchema = z.object({
  jobId: idSchema,
  fromUtc: z.string().datetime(),
  toUtc: z.string().datetime(),
  type: z.enum(["shifts", "summaries"]).default("shifts"),
});

export const exportCsvOutputSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  csv: z.string(),
});

export const userSettingsOutputSchema = z.object({
  currency: z.string().length(3),
  hourlyRate: moneySchema.nullable(),
  contractedMinutesPerWeek: z.number().int().nullable(),
  payCycle: payCycleSchema,
  payPeriodAnchor: payPeriodAnchorSchema,
  standardBreak: breakSchema.nullable(),
  rounding: roundingRuleSchema.nullable(),
  overtimeRule: overtimeRuleSchema.nullable(),
  timezone: z.string(),
});

export const userSettingsUpdateInputSchema = z.object({
  patch: z.object({
    currency: z.string().length(3).optional(),
    hourlyRate: moneySchema.nullable().optional(),
    contractedMinutesPerWeek: z.number().int().positive().nullable().optional(),
    payCycle: payCycleSchema.optional(),
    payPeriodAnchor: payPeriodAnchorSchema.optional(),
    standardBreak: breakSchema.nullable().optional(),
    rounding: roundingRuleSchema.nullable().optional(),
    overtimeRule: overtimeRuleSchema.nullable().optional(),
    timezone: z.string().min(1).optional(),
  }),
});
