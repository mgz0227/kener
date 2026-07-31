import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
  GetUserByEmail,
  GetUsersCount,
  GetUserPasswordHashById,
  CreateFirstUser,
} from "$lib/server/controllers/userController";
import { VerifyPassword, GenerateToken, CookieConfig } from "$lib/server/controllers/commonController";
import constants from "$lib/global-constants";
import serverResolve from "$lib/server/resolver.js";

const signupErrorMessages: Record<string, string> = {
  "Please enter a valid email address": "请输入有效的邮箱地址",
  "Name must be at least 2 characters": "姓名至少需要 2 个字符",
  "Name must be less than 100 characters": "姓名不能超过 100 个字符",
  "Password must contain at least one digit, one lowercase letter, one uppercase letter, and have a minimum length of 8 characters":
    "密码至少需要 8 个字符，并包含一个大写字母、一个小写字母和一个数字",
};

export const load: PageServerLoad = async ({ parent }) => {
  const parentData = await parent();

  if (!!parentData.loggedInUser && parentData.isSetupComplete) {
    throw redirect(302, serverResolve("/manage/app/site-configurations"));
  }

  return {
    ...parentData,
  };
};

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return fail(400, { error: "邮箱和密码不能为空", values: { email } });
    }

    const userCount = await GetUsersCount();
    if (!userCount || Number(userCount.count) === 0) {
      return fail(400, { error: constants.ERROR_NO_SETUP, values: { email } });
    }

    const userDB = await GetUserByEmail(email);
    if (!userDB) {
      return fail(401, { error: "用户不存在", values: { email } });
    }

    const passwordStored = await GetUserPasswordHashById(userDB.id);
    if (!passwordStored) {
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
    } catch (e) {
      const errorMessage = e instanceof Error ? signupErrorMessages[e.message] || "注册时发生错误" : "注册时发生错误";
      return fail(400, { error: errorMessage, values: { name, email } });
    }
  },
};
