<script lang="ts">
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import { goto } from "$app/navigation";
  import MailIcon from "@lucide/svelte/icons/mail";
  import LockIcon from "@lucide/svelte/icons/lock";
  import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
  import EyeClosedIcon from "@lucide/svelte/icons/eye-closed";
  import EyeOpenIcon from "@lucide/svelte/icons/eye";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  const { data } = $props();

  const view: string = $derived(data.view);
  const token: string = $derived(data.token);

  let loading = $state(false);
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let emailSent = $state(false);
  let passwordReset = $state(false);

  let email = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");

  async function handleRequestReset() {
    if (!email) {
      toast.error("请输入邮箱地址");
      return;
    }

    loading = true;
    try {
      const response = await fetch(clientResolver(resolve, "/account/forgot/api/fogot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "发送重置邮件失败");
        return;
      }

      emailSent = true;
      toast.success("密码重置邮件已发送！");
    } catch (e) {
      toast.error("发生错误，请重试。");
    } finally {
      loading = false;
    }
  }

  async function handlePasswordReset() {
    if (!newPassword || !confirmPassword) {
      toast.error("请填写所有字段");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("两次密码不一致");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("密码至少需要 8 个字符");
      return;
    }

    loading = true;
    try {
      const response = await fetch(clientResolver(resolve, "/account/forgot/api/password-reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedToken: token, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "重置密码失败");
        return;
      }

      passwordReset = true;
      toast.success("密码重置成功！");
    } catch (e) {
      toast.error("发生错误，请重试。");
    } finally {
      loading = false;
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (view === "confirm_token") {
      handlePasswordReset();
    } else {
      handleRequestReset();
    }
  }
</script>

<svelte:head>
  <title>{view === "confirm_token" ? "重置密码" : "忘记密码"}</title>
</svelte:head>
<div class="flex min-h-screen items-center justify-center p-4">
  <Card.Root class="kener-card w-full max-w-md">
    {#if view === "confirm_token"}
      <!-- Reset Password View -->
      {#if passwordReset}
        <Card.Header class="text-center">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircleIcon class="h-8 w-8 text-green-600" />
          </div>
          <Card.Title>密码重置完成</Card.Title>
          <Card.Description>密码已成功重置，现在可以使用新密码登录。</Card.Description>
        </Card.Header>
        <Card.Content>
          <Button href={clientResolver(resolve, "/account/signin")} class="w-full">
            <ArrowLeftIcon class="mr-2 h-4 w-4" />
            返回登录
          </Button>
        </Card.Content>
      {:else}
        <Card.Header>
          <Card.Title>设置新密码</Card.Title>
          <Card.Description>请输入新密码以完成重置。</Card.Description>
        </Card.Header>
        <Card.Content>
          <form onsubmit={handleSubmit}>
            <Field.Group>
              <Field.Field class="relative flex flex-col gap-1">
                <Field.Label for="newPassword">新密码</Field.Label>
                <InputGroup.Root>
                  <InputGroup.Addon>
                    <LockIcon />
                  </InputGroup.Addon>
                  <InputGroup.Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    bind:value={newPassword}
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
                <Field.Description>密码至少需要 8 个字符。</Field.Description>
              </Field.Field>

              <Field.Field class="relative flex flex-col gap-1">
                <Field.Label for="confirmPassword">确认密码</Field.Label>
                <InputGroup.Root>
                  <InputGroup.Addon>
                    <LockIcon />
                  </InputGroup.Addon>
                  <InputGroup.Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    bind:value={confirmPassword}
                    required
                  />
                  <InputGroup.Addon align="inline-end">
                    <InputGroup.Button
                      type="button"
                      aria-label={showConfirmPassword ? "隐藏密码" : "显示密码"}
                      title={showConfirmPassword ? "隐藏密码" : "显示密码"}
                      size="icon-xs"
                      onclick={() => (showConfirmPassword = !showConfirmPassword)}
                    >
                      {#if showConfirmPassword}
                        <EyeClosedIcon class="size-4" />
                      {:else}
                        <EyeOpenIcon class="size-4" />
                      {/if}
                    </InputGroup.Button>
                  </InputGroup.Addon>
                </InputGroup.Root>
              </Field.Field>
            </Field.Group>

            <div class="mt-6">
              <Button type="submit" class="w-full" disabled={loading}>
                {#if loading}
                  正在重置密码……
                {:else}
                  重置密码
                {/if}
              </Button>
            </div>

            <div class="mt-4 text-center">
              <Button variant="link" href={clientResolver(resolve, "/account/signin")} class="text-sm">
                <ArrowLeftIcon class="mr-1 h-3 w-3" />
                返回登录
              </Button>
            </div>
          </form>
        </Card.Content>
      {/if}
    {:else}
      <!-- Request Reset View -->
      {#if emailSent}
        <Card.Header class="text-center">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <MailIcon class="h-8 w-8 text-blue-600" />
          </div>
          <Card.Title>请检查邮箱</Card.Title>
          <Card.Description>
            我们已将密码重置链接发送到 <strong>{email}</strong>，请检查收件箱并点击链接重置密码。
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-muted-foreground mb-4 text-center text-sm">没有收到邮件？请检查垃圾邮件文件夹，或重试。</p>
          <Button variant="outline" class="w-full" onclick={() => (emailSent = false)}>重试</Button>
          <div class="mt-4 text-center">
            <Button variant="link" href={clientResolver(resolve, "/account/signin")} class="text-sm">
              <ArrowLeftIcon class="mr-1 h-3 w-3" />
              返回登录
            </Button>
          </div>
        </Card.Content>
      {:else}
        <Card.Header>
          <Card.Title>忘记密码</Card.Title>
          <Card.Description>输入邮箱地址，我们会向你发送密码重置链接。</Card.Description>
        </Card.Header>
        <Card.Content>
          <form onsubmit={handleSubmit}>
            <Field.Group>
              <Field.Field class="relative flex flex-col gap-1">
                <Field.Label for="email">邮箱</Field.Label>
                <InputGroup.Root>
                  <InputGroup.Addon>
                    <MailIcon />
                  </InputGroup.Addon>
                  <InputGroup.Input id="email" type="email" placeholder="you@example.com" bind:value={email} required />
                </InputGroup.Root>
              </Field.Field>
            </Field.Group>

            <div class="mt-6">
              <Button type="submit" class="w-full" disabled={loading}>
                {#if loading}
                  正在发送重置链接……
                {:else}
                  发送重置链接
                {/if}
              </Button>
            </div>

            <div class="mt-4 text-center">
              <Button variant="link" href={clientResolver(resolve, "/account/signin")} class="text-sm">
                <ArrowLeftIcon class="mr-1 h-3 w-3" />
                返回登录
              </Button>
            </div>
          </form>
        </Card.Content>
      {/if}
    {/if}
  </Card.Root>
</div>
