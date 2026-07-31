import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import db from "$lib/server/db/db.js";
import { HashPassword, ValidatePassword, VerifyToken } from "$lib/server/controllers/commonController.js";
import { GetUserPasswordHashById } from "$lib/server/controllers/userController.js";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { receivedToken, newPassword } = body;

  if (!receivedToken) {
    return json({ error: "令牌不能为空" }, { status: 400 });
  }

  if (!newPassword) {
    return json({ error: "密码不能为空" }, { status: 400 });
  }

  // Verify token
  const tokenData = await VerifyToken(receivedToken);
  if (!tokenData) {
    return json({ error: "邀请链接无效或已过期" }, { status: 400 });
  }

  const email = tokenData.email;
  if (!email) {
    return json({ error: "令牌数据无效" }, { status: 400 });
  }

  // Check token expiry
  const validTill = tokenData.validTill;
  if (!validTill || Date.now() > validTill) {
    return json({ error: "此邀请链接已过期" }, { status: 400 });
  }

  // Check user exists with empty password
  const user = await db.getUserByEmail(email);
  if (!user) {
    return json({ error: "用户不存在" }, { status: 401 });
  }

  const passwordData = await GetUserPasswordHashById(user.id);
  if (passwordData && passwordData.password_hash !== "") {
    return json({ error: "此邀请已接受" }, { status: 400 });
  }

  // Validate password strength
  if (!ValidatePassword(newPassword)) {
    return json(
      {
        error: "密码至少需要 8 个字符，并包含一个大写字母、一个小写字母和一个数字",
      },
      { status: 400 },
    );
  }

  // Hash and set password
  const passwordHash = await HashPassword(newPassword);
  await db.updateUserPassword({
    id: user.id,
    password_hash: passwordHash,
  });

  // Activate user and mark as verified
  await db.updateUserIsActive(user.id, 1);
  await db.updateIsVerified(user.id, 1);

  return json({ success: true });
};
