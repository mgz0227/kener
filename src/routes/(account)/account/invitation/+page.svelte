<script lang="ts">
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import LockIcon from "@lucide/svelte/icons/lock";
  import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import EyeClosedIcon from "@lucide/svelte/icons/eye-closed";
  import EyeOpenIcon from "@lucide/svelte/icons/eye";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  const { data } = $props();

  const valid: boolean = $derived(data.valid);
  const error: string = $derived(data.error);
  const token: string = $derived(data.token);
  const email: string = $derived(data.email || "");
  const name: string = $derived(data.name || "");

  let loading = $state(false);
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let accountActivated = $state(false);

  let newPassword = $state("");
  let confirmPassword = $state("");

  async function handleAcceptInvitation() {
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
      const response = await fetch(clientResolver(resolve, "/account/invitation/api/accept-invitation"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedToken: token, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "设置密码失败");
        return;
      }

      accountActivated = true;
      toast.success("账户激活成功！");
    } catch (e) {
      toast.error("发生错误，请重试。");
    } finally {
      loading = false;
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    handleAcceptInvitation();
  }
</script>

<svelte:head>
  <title>接受邀请</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center p-4">
  <Card.Root class="kener-card w-full max-w-md">
    {#if !valid}
      <!-- Error View -->
      <Card.Header class="text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircleIcon class="h-8 w-8 text-red-600" />
        </div>
        <Card.Title>邀请无效</Card.Title>
        <Card.Description>{error}</Card.Description>
      </Card.Header>
      <Card.Content>
        <Button href={clientResolver(resolve, "/account/signin")} class="w-full">
          <ArrowLeftIcon class="mr-2 h-4 w-4" />
          前往登录
        </Button>
      </Card.Content>
    {:else if accountActivated}
      <!-- Success View -->
      <Card.Header class="text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircleIcon class="h-8 w-8 text-green-600" />
        </div>
        <Card.Title>账户已激活</Card.Title>
        <Card.Description>账户已成功设置，现在可以使用新密码登录。</Card.Description>
      </Card.Header>
      <Card.Content>
        <Button href={clientResolver(resolve, "/account/signin")} class="w-full">
          <ArrowLeftIcon class="mr-2 h-4 w-4" />
          前往登录
        </Button>
      </Card.Content>
    {:else}
      <!-- Set Password View -->
      <Card.Header>
        <Card.Title>欢迎，{name}！</Card.Title>
        <Card.Description>
          你已受邀以 <strong>{email}</strong> 加入。请创建密码以激活账户并开始使用。
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <form onsubmit={handleSubmit}>
          <Field.Group>
            <Field.Field class="relative flex flex-col gap-1">
              <Field.Label for="newPassword">密码</Field.Label>
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
              <Field.Description>密码至少需要 8 个字符，并包含一个大写字母、一个小写字母和一个数字。</Field.Description>
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
                正在激活账户……
              {:else}
                激活账户
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
  </Card.Root>
</div>
