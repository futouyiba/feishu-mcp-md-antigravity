import { z } from "zod";

const EnvSchema = z.object({
  FEISHU_APP_ID: z.string().min(1, "FEISHU_APP_ID is required"),
  FEISHU_APP_SECRET: z.string().min(1, "FEISHU_APP_SECRET is required"),
  FEISHU_BASE_URL: z
    .string()
    .url()
    .default("https://open.larkoffice.com"),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env = process.env): AppConfig {
  return EnvSchema.parse({
    FEISHU_APP_ID: env.FEISHU_APP_ID,
    FEISHU_APP_SECRET: env.FEISHU_APP_SECRET,
    FEISHU_BASE_URL: env.FEISHU_BASE_URL ?? "https://open.larkoffice.com",
  });
}
