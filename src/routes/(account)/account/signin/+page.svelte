<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import MailIcon from "@lucide/svelte/icons/mail";
  import LockIcon from "@lucide/svelte/icons/lock";
  import UserIcon from "@lucide/svelte/icons/user";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import EyeClosedIcon from "@lucide/svelte/icons/eye-closed";
  import EyeOpenIcon from "@lucide/svelte/icons/eye";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import type { PageProps } from "./$types";
  import { resolve } from "$app/paths";

  let { data, form }: PageProps = $props();
  const isAdminAccountCreated: boolean = $derived(data.isAdminAccountCreated);
  const isSetupComplete: boolean = $derived(data.isSetupComplete);
  const authActionPath = $derived(!isAdminAccountCreated ? "?/signup" : "?/login");
  const emailValue = $derived(form?.values?.email ?? "");
  const nameValue = $derived(form?.values && "name" in form.values ? form.values.name : "");

  const oidcEnabled: boolean = $derived(data.oidc?.enabled ?? false);
  const oidcProviderName: string = $derived(data.oidc?.providerName ?? "SSO");
  const allowLocalLogin: boolean = $derived(data.oidc?.allowLocalLogin ?? true);
  const oidcError: string | null = $derived(data.oidcError ?? null);

  const showLocalLogin: boolean = $derived(!isAdminAccountCreated || allowLocalLogin || !oidcEnabled);

  let loading = $state(false);
  let showPassword = $state(false);
  let password = $state("");
</script>

<svelte:head>
  <title>{!isAdminAccountCreated ? "创建管理员账户" : "登录"}</title>
</svelte:head>
<div class="flex min-h-screen items-center justify-center p-4">
  <Card.Root class="kener-card w-full max-w-md">
    <Card.Header>
      <Card.Title>{!isAdminAccountCreated ? "创建管理员账户" : "登录"}</Card.Title>
      <Card.Description>
        {!isAdminAccountCreated ? "创建管理员账户以开始使用" : "输入账户信息以进入管理后台"}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      {#if !isSetupComplete}
        <Alert.Root variant="destructive">
          <AlertCircleIcon />
          <Alert.Title>初始化尚未完成。</Alert.Title>
          <Alert.Description>
            <p>请确认已设置以下环境变量：</p>
            <ul class="list-inside list-disc text-sm">
              <li>KENER_SECRET_KEY</li>
              <li>ORIGIN</li>
              <li>REDIS_URL</li>
            </ul>
            <Button
              variant="link"
              size="sm"
              class="text-destructive w-full justify-start underline"
              href="https://kener.ing/docs/v4/setup/environment-variables"
            >
              查看文档
            </Button>
          </Alert.Description>
        </Alert.Root>
      {:else}
        {#if oidcError}
          <Alert.Root variant="destructive" class="mb-4">
            <AlertCircleIcon />
            <Alert.Title>身份验证失败</Alert.Title>
            <Alert.Description>{oidcError}</Alert.Description>
          </Alert.Root>
        {/if}

        {#if oidcEnabled && isAdminAccountCreated}
          <div class="mb-4">
            <Button variant="outline" class="w-full" href={resolve("/account/oidc/login")}>
              <LogInIcon class="mr-2 h-4 w-4" />
              使用 {oidcProviderName} 登录
            </Button>
          </div>

          {#if showLocalLogin}
            <div class="relative my-6">
              <div class="absolute inset-0 flex items-center">
                <span class="border-border w-full border-t"></span>
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-card text-muted-foreground px-2">或</span>
              </div>
            </div>
          {/if}
        {/if}

        {#if showLocalLogin}
          <form
            method="POST"
            action={authActionPath}
            onsubmit={() => {
              loading = true;
            }}
          >
            {#if form?.error}
              <Alert.Root variant="destructive" class="mb-4">
                <AlertCircleIcon />
                <Alert.Title>{!isAdminAccountCreated ? "注册失败" : "登录失败"}</Alert.Title>
                <Alert.Description>{form.error}</Alert.Description>
              </Alert.Root>
            {/if}

            <Field.Group>
              {#if !isAdminAccountCreated}
                <Field.Field>
                  <Field.Label for="name">姓名</Field.Label>
                  <InputGroup.Root>
                    <InputGroup.Addon>
                      <UserIcon />
                    </InputGroup.Addon>
                    <InputGroup.Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="你的姓名"
                      value={nameValue}
                      required
                    />
                  </InputGroup.Root>
                </Field.Field>
              {/if}

              <Field.Field class="relative flex flex-col gap-1">
                <Field.Label for="email">邮箱</Field.Label>
                <InputGroup.Root>
                  <InputGroup.Addon>
                    <MailIcon />
                  </InputGroup.Addon>
                  <InputGroup.Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={emailValue}
                    required
                  />
                </InputGroup.Root>
              </Field.Field>

              <Field.Field class="relative flex flex-col gap-1">
                <Field.Label for="password" class="relative">
                  密码
                  <Button
                    variant="link"
                    size="sm"
                    class="text-muted-foreground absolute top-0 right-0 h-auto p-0 text-xs"
                    href={resolve("/account/forgot")}
                  >
                    忘记密码？
                  </Button>
                </Field.Label>
                <InputGroup.Root>
                  <InputGroup.Addon>
                    <LockIcon />
                  </InputGroup.Addon>
                  <InputGroup.Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    bind:value={password}
                    required
                  />
                  <InputGroup.Addon align="inline-end">
                    <InputGroup.Button
                      type="button"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      title={showPassword ? "隐藏密码" : "显示密码"}
                      size="icon-xs"
                      onclick={() => (showPassword = !showPassword)}
                    >
                      {#if showPassword}
                        <EyeClosedIcon class="size-4" />
                      {:else}
                        <EyeOpenIcon class="size-4" />
                      {/if}
                    </InputGroup.Button>
                  </InputGroup.Addon>
                </InputGroup.Root>
                {#if !isAdminAccountCreated}
                  <Field.Description>
                    密码至少需要 8 个字符，并包含一个大写字母、一个小写字母和一个数字。
                  </Field.Description>
                {/if}
              </Field.Field>
            </Field.Group>

            <div class="mt-6">
              <Button type="submit" class="w-full" disabled={loading}>
                {#if loading}
                  {!isAdminAccountCreated ? "正在创建账户……" : "正在登录……"}
                {:else}
                  {!isAdminAccountCreated ? "创建账户" : "登录"}
                {/if}
              </Button>
            </div>
          </form>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>
</div>
