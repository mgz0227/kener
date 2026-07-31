import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { VerifyToken } from "$lib/server/controllers/commonController.js";
import db from "$lib/server/db/db.js";
import serverResolve from "$lib/server/resolver.js";

export const load: PageServerLoad = async ({ url }) => {
  const view = url.searchParams.get("view") || "";
  const token = url.searchParams.get("token") || "";

  if (view !== "confirm_token" || !token) {
    return {
      valid: false,
      error: "验证链接无效或缺失。",
    };
  }

  const tokenData = await VerifyToken(token);
  if (!tokenData) {
    return {
      valid: false,
      error: "验证链接无效或已过期。",
    };
  }

  const email = tokenData.email;
  if (!email) {
    return {
      valid: false,
      error: "验证链接无效。",
    };
  }

  const validTill = tokenData.validTill;
  if (!validTill || Date.now() > validTill) {
    return {
      valid: false,
      error: "此验证链接已过期，请重新申请。",
    };
  }

  const user = await db.getUserByEmail(email);
  if (!user) {
    return {
      valid: false,
      error: "未找到此验证链接对应的用户。",
    };
  }

  if (!user.is_verified) {
    await db.updateIsVerified(user.id, 1);
  }

  throw redirect(302, serverResolve("/manage/app/users"));
};
