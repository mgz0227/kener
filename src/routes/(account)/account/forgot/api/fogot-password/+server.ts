import { HashPassword, GenerateToken, VerifyToken, GetAllSiteData } from "$lib/server/controllers/controller.js";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import db from "$lib/server/db/db.js";
import { GetGeneralEmailTemplateById } from "$lib/server/controllers/generalTemplateController";
import { siteDataToVariables } from "$lib/server/notification/notification_utils";
import sendEmail from "$lib/server/notification/email_notification.js";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return json({ error: "邮箱不能为空" }, { status: 400 });
  }

  let userDB = await db.getUserByEmail(email);
  if (!!!userDB) {
    let errorMessage = "用户不存在";
    return json({ error: errorMessage }, { status: 401 });
  }

  // Generate token
  const token = await GenerateToken({
    email: userDB.email,
    generatedAt: Date.now(),
  });

  const siteData = await GetAllSiteData();
  const siteVars = siteDataToVariables(siteData);
  const siteUrl = siteVars.site_url || "";
  let link = `${siteUrl}account/forgot?view=confirm_token&token=${token}`;

  const template = await GetGeneralEmailTemplateById("forgot_password");
  if (!template) {
    return json({ error: "未找到邮件模板" }, { status: 404 });
  }

  // Prepare variables
  const emailVars = {
    ...siteVars,
    reset_link: link,
  };

  // Send email
  try {
    await sendEmail(
      template.template_html_body || "",
      template.template_subject || "密码重置请求",
      emailVars,
      [email],
      undefined,
      template.template_text_body || "",
    );
    return json({ success: true });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return json({ success: false, error: "发送密码重置邮件失败" }, { status: 500 });
  }
};
