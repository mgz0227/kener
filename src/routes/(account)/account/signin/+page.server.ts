import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
  GetUserByEmail,
  GetUsersCount,
  GetUserPasswordHashById,
  CreateFirstUser,
} from "$lib/server/controllers/userController";
import { VerifyPassword, GenerateToken, CookieConfig } from "$lib/server/controllers/commonController";
import { GetOidcSettings } from "$lib/server/controllers/oidcController";
import serverResolve from "$lib/server/resolver.js";
import GC from "$lib/global-constants";

const signupErrorMessages: Record<string, string> = {
  "Please enter a valid email address": "请输入有效的邮箱地址",
  "Name must be at least 2 characters": "姓名至少需要 2 个字符",
  "Name must be less than 100 characters": "姓名不能超过 100 个字符",
  "Password must contain at least one digit, one lowercase letter, one uppercase letter, and have a minimum length of 8 characters":
    "密码至少需要 8 个字符，并包含一个大写字母、一个小写字母和一个数字",
};

// oidc_error carries a code, never free text; anything unknown gets the generic message.
const OIDC_ERROR_MESSAGES: Record<string, string> = {
  provider_error: "身份提供商返回错误，请重试。",
  account_deactivated: "你的账户已被停用，请联系管理员。",
  no_roles: "你的账户没有分配有效角色，请联系管理员。",
  not_provisioned: "系统尚未为你开通账户，请联系管理员。",
  email_conflict: "此邮箱已有账户。OIDC 账户与本地账户相互独立，请联系管理员。",
  auth_failed: "身份验证失败，请重试或联系管理员。",
};

export const load: PageServerLoad = async ({ parent, url }) => {
  const parentData = await parent();

  if (!!parentData.loggedInUser && parentData.isSetupComplete) {
    throw redirect(302, serverResolve("/manage/app/site-configurations"));
  }

  const oidcSettings = await GetOidcSettings();
  const oidcErrorCode = url.searchParams.get("oidc_error");
  const oidcError = oidcErrorCode ? (OIDC_ERROR_MESSAGES[oidcErrorCode] ?? OIDC_ERROR_MESSAGES.auth_failed) : null;
  const forceLocalLogin = process.env.KENER_FORCE_LOCAL_LOGIN === "true";

  return {
    ...parentData,
    oidc: oidcSettings
      ? {
          enabled: true,
          providerName: oidcSettings.provider_name || "SSO",
          allowLocalLogin: oidcSettings.allow_local_login || forceLocalLogin,
        }
      : {
          enabled: false,
          providerName: "",
          allowLocalLogin: true,
        },
    oidcError,
  };
};

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const oidcSettings = await GetOidcSettings();

    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return fail(400, { error: "邮箱和密码不能为空", values: { email } });
    }

    const userCount = await GetUsersCount();
    if (!userCount || Number(userCount.count) === 0) {
      return fail(400, { error: GC.ERROR_NO_SETUP, values: { email } });
    }

    // Local login can be enabled by setting Env-Variable "KENER_FORCE_LOCAL_LOGIN" == "true".
    // This prevents lockout when the IdP is misconfigured or unreachable.
    // Checked before the user lookup so the response does not reveal whether the email exists.
    const forceLocalLogin = process.env.KENER_FORCE_LOCAL_LOGIN === "true";
    if (oidcSettings && !oidcSettings.allow_local_login && !forceLocalLogin) {
      return fail(403, {
        error: "本地登录已禁用，请使用单点登录。",
        values: { email },
      });
    }

    const userDB = await GetUserByEmail(email);
    if (!userDB) {
      return fail(401, { error: "用户不存在", values: { email } });
    }
    if (userDB.auth_provider === GC.AUTH_PROVIDER_OIDC) {
      return fail(403, {
        error: "此账户使用单点登录，请点击单点登录按钮。",
        values: { email },
      });
    }

    const passwordStored = await GetUserPasswordHashById(userDB.id);
    if (!passwordStored || !passwordStored.password_hash) {
      return fail(401, { error: "邮箱或密码错误", values: { email } });
    }

    const isMatch = await VerifyPassword(password, passwordStored.password_hash);
    if (!isMatch) {
      return fail(401, { error: "邮箱或密码错误", values: { email } });
    }

    if (!userDB.is_active) {
      return fail(403, {
        error: "你的账户已被停用，请联系管理员。",
        values: { email },
      });
    }

    if (!userDB.role_ids || userDB.role_ids.length === 0) {
      return fail(403, {
        error: "你的账户没有分配有效角色，请联系管理员。",
        values: { email },
      });
    }

    const token = await GenerateToken(userDB);
    const cookieConfig = CookieConfig();
    cookies.set(cookieConfig.name, token, {
      path: cookieConfig.path,
      maxAge: cookieConfig.maxAge,
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
    });

    throw redirect(302, serverResolve("/manage/app/site-configurations"));
  },
  signup: async ({ request, cookies }) => {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!name || !email || !password) {
      return fail(400, { error: "姓名、邮箱和密码不能为空", values: { name, email } });
    }

    const userCount = await GetUsersCount();
    if (userCount && Number(userCount.count) !== 0) {
      return fail(400, {
        error: "初始化已完成，请使用已设置的邮箱和密码登录。",
        values: { name, email },
      });
    }

    try {
      await CreateFirstUser({ email, name, password });
    } catch (e) {
      const errorMessage = e instanceof Error ? signupErrorMessages[e.message] || "注册时发生错误" : "注册时发生错误";
      return fail(400, { error: errorMessage, values: { name, email } });
    }

    const userDB = await GetUserByEmail(email);
    if (!userDB) {
      return fail(500, { error: "创建用户失败", values: { name, email } });
    }

    const token = await GenerateToken(userDB);
    const cookieConfig = CookieConfig();
    cookies.set(cookieConfig.name, token, {
      path: cookieConfig.path,
      maxAge: cookieConfig.maxAge,
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
    });

    throw redirect(302, serverResolve("/manage/app/site-configurations"));
  },
};
