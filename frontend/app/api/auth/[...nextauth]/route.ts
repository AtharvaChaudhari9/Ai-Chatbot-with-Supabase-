import { handlers } from "@/auth";
import { NextRequest } from "next/server";

export const GET = (req: NextRequest) => handlers.GET(req as any);
export const POST = (req: NextRequest) => handlers.POST(req as any);
