import {
  HashPassword,
  GenerateToken,
  VerifyToken,
  GetAllSiteData,
  ValidatePassword,
} from "$lib/server/controllers/controller.js";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import db from "$lib/server/db/db.js";
import { GetGeneralEmailTemplateById } from "$lib/server/controllers/generalTemplateController";
import { siteDataToVariables } from "$lib/server/notification/notification_utils";
import sendEmail from "$lib/server/notification/email_notification.js";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { receivedToken, newPassword } = body;

  if (!receivedToken) {
    return json({ error: "令牌不能为空" }, { status: 400 });
  }
  let data = await VerifyToken(receivedToken);
  if (!data) {
    return json({ error: "令牌无效或已过期" }, { status: 400 });
  }
  let email = data.email;
  if (!email) {
    return json({ error: "令牌数据无效" }, { status: 400 });
  }
  let generatedAt = data.generatedAt;
  if (!generatedAt) {
    return json({ error: "令牌数据无效" }, { status: 400 });
  }
  let currentTime = Date.now();
  // Check if token is expired (1 hour = 3600000 milliseconds)
  if (currentTime - generatedAt > 3600000) {
    return json({ error: "令牌已过期" }, { status: 400 });
  }

  let userDB = await db.getUserByEmail(email);
  if (!!!userDB) {
    let errorMessage = "用户不存在";
    return json({ error: errorMessage }, { status: 401 });
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
  let password_hash = await HashPassword(newPassword);
  await db.updateUserPassword({
    id: userDB.id,
    password_hash: password_hash,
  });
  //also update updateIsVerified
  await db.updateIsVerified(userDB.id, 1);
  return json({ success: true });
};
