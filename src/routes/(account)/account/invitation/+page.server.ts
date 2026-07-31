import type { PageServerLoad } from "./$types";
import { VerifyToken } from "$lib/server/controllers/commonController.js";
import db from "$lib/server/db/db.js";
import { GetUserPasswordHashById } from "$lib/server/controllers/userController.js";

export const load: PageServerLoad = async ({ url, cookies }) => {
  // Clear any existing session
  cookies.delete("kener-user", { path: "/" });

  const view = url.searchParams.get("view") || "";
  const token = url.searchParams.get("token") || "";

  // If no token or not confirm_token view, show error
  if (view !== "confirm_token" || !token) {
    return {
      valid: false,
      error: "邀请链接无效或缺失。",
      token: "",
    };
  }

  // Verify the token
  const tokenData = await VerifyToken(token);
  if (!tokenData) {
    return {
      valid: false,
      error: "邀请链接无效或已过期。",
      token: "",
    };
  }

  const email = tokenData.email;
  if (!email) {
    return {
      valid: false,
      error: "邀请链接无效。",
      token: "",
    };
  }

  // Check if token has expired (validTill)
  const validTill = tokenData.validTill;
  if (!validTill || Date.now() > validTill) {
    return {
      valid: false,
      error: "此邀请链接已过期，请联系管理员重新发送。",
      token: "",
    };
  }

  // Check if user exists with empty password (invited but not yet activated)
  const user = await db.getUserByEmail(email);
  if (!user) {
    return {
      valid: false,
      error: "未找到此邮箱对应的邀请。",
      token: "",
    };
  }

  const passwordData = await GetUserPasswordHashById(user.id);
  if (passwordData && passwordData.password_hash !== "") {
    return {
      valid: false,
      error: "此邀请已接受，请直接登录。",
      token: "",
    };
  }

  return {
    valid: true,
    error: "",
    token,
    email: user.email,
    name: user.name,
  };
};
