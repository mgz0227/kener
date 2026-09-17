<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
  import XCircleIcon from "@lucide/svelte/icons/x-circle";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import { toast } from "svelte-sonner";
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import type { OidcSettings } from "$lib/types/site.js";

  // ============ Types ============

  interface GroupRoleMapping {
    id: number;
    oidc_group: string;
    role_id: string;
    created_at: string;
    updated_at: string;
  }

  interface RoleRecord {
    id: string;
    role_name: string;
    readonly: number;
    status: string;
  }

  // ============ State ============

  let loading = $state(true);
  let saving = $state(false);
  let testing = $state(false);
  let showSecret = $state(false);

  let settings = $state<OidcSettings>({
    enabled: false,
    provider_name: "",
    issuer_url: "",
    client_id: "",
    client_secret: "",
    scopes: "openid profile email",
    groups_claim: "groups",
    allow_local_login: true,
    auto_create_users: false,
    default_role_id: "member"
  });

  let originalMaskedSecret = $state("");

  let testResult = $state<{
    success: boolean;
    issuer?: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    userinfoEndpoint?: string;
    error?: string;
  } | null>(null);

  // Group-Role Mappings
  let mappings = $state<GroupRoleMapping[]>([]);
  let loadingMappings = $state(true);
  let newMappingGroup = $state("");
  let newMappingRoleId = $state("");
  let addingMapping = $state(false);
  let deleteDialogOpen = $state(false);
  let mappingToDelete = $state<GroupRoleMapping | null>(null);
  let deletingMapping = $state(false);

  // Available roles
  let roles = $state<RoleRecord[]>([]);

  // ============ API Helpers ============

  async function apiCall(action: string, data: Record<string, unknown> = {}): Promise<unknown> {
    const response = await fetch(clientResolver(resolve, "/manage/api"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as Record<string, string>).error || `请求失败，状态码：${response.status}`);
    }
    return await response.json();
  }

  // ============ Settings ============

  async function loadSettings() {
    loading = true;
    try {
      const result = (await apiCall("getOidcSettingsMasked")) as OidcSettings | { error: string };
      if (result && !("error" in result)) {
        settings = { ...settings, ...result };
        originalMaskedSecret = settings.client_secret;
      }
    } catch {
      toast.error("加载 OIDC 设置失败");
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      // Only include client_secret if it was changed from the masked value
      const settingsToSave = { ...settings };
      if (settingsToSave.client_secret === originalMaskedSecret) {
        delete (settingsToSave as Record<string, unknown>).client_secret;
      }
      const result = (await apiCall("storeSiteData", { oidcSettings: JSON.stringify(settingsToSave) })) as {
        error?: string;
      };
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("OIDC 设置已保存");
      }
    } catch {
      toast.error("保存 OIDC 设置失败");
    } finally {
      saving = false;
    }
  }

  async function testConnection() {
    testing = true;
    testResult = null;
    try {
      const result = (await apiCall("testOidcConnection", { settings })) as {
        success: boolean;
        issuer?: string;
        authorizationEndpoint?: string;
        tokenEndpoint?: string;
        userinfoEndpoint?: string;
        error?: string;
      };
      testResult = result;
      if (result.success) {
        toast.success("连接成功");
      } else {
        toast.error(result.error || "连接失败");
      }
    } catch {
      toast.error("连接测试失败");
      testResult = { success: false, error: "网络错误" };
    } finally {
      testing = false;
    }
  }

  // ============ Group-Role Mappings ============

  async function loadMappings() {
    loadingMappings = true;
    try {
      const result = (await apiCall("getOidcGroupRoleMappings")) as GroupRoleMapping[] | { error: string };
      if (Array.isArray(result)) {
        mappings = result;
      }
    } catch {
      toast.error("加载用户组映射失败");
    } finally {
      loadingMappings = false;
    }
  }

  async function loadRoles() {
    try {
      const result = (await apiCall("getRoles")) as RoleRecord[] | { error: string };
      if (Array.isArray(result)) {
        roles = result.filter((r) => r.status === "ACTIVE");
      }
    } catch {
      // Roles list is non-critical
    }
  }

  async function addMapping() {
    if (!newMappingGroup.trim()) {
      toast.error("请输入 OIDC 用户组名称");
      return;
    }
    if (!newMappingRoleId) {
      toast.error("请选择 Kener 角色");
      return;
    }

    addingMapping = true;
    try {
      const result = (await apiCall("upsertOidcGroupRoleMapping", {
        oidc_group: newMappingGroup.trim(),
        role_id: newMappingRoleId
      })) as { error?: string };
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`已添加映射：“${newMappingGroup}” → “${getRoleName(newMappingRoleId)}”`);
        newMappingGroup = "";
        newMappingRoleId = "";
        await loadMappings();
      }
    } catch {
      toast.error("添加映射失败");
    } finally {
      addingMapping = false;
    }
  }

  function openDeleteMappingDialog(mapping: GroupRoleMapping) {
    mappingToDelete = mapping;
    deleteDialogOpen = true;
  }

  async function deleteMapping() {
    if (!mappingToDelete) return;
    deletingMapping = true;
    try {
      const result = (await apiCall("deleteOidcGroupRoleMapping", {
        id: mappingToDelete.id
      })) as { error?: string };
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("映射已删除");
        await loadMappings();
      }
    } catch {
      toast.error("删除映射失败");
    } finally {
      deletingMapping = false;
      deleteDialogOpen = false;
      mappingToDelete = null;
    }
  }

  // ============ Helpers ============

  const roleDisplayNames: Record<string, string> = { admin: "管理员", editor: "编辑者", member: "成员" };

  function getRoleName(roleId: string): string {
    const role = roles.find((r) => r.id === roleId);
    return (role?.readonly === 1 && roleDisplayNames[role.id]) || role?.role_name || roleId;
  }

  // ============ Lifecycle ============

  onMount(async () => {
    await Promise.all([loadSettings(), loadMappings(), loadRoles()]);
  });
</script>

<div class="flex w-full flex-col gap-6 p-4">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner class="h-6 w-6" />
    </div>
  {:else}
    <!-- ============ OIDC Settings Card ============ -->
    <Card.Root>
      <Card.Header>
        <Card.Title>OpenID Connect 设置</Card.Title>
        <Card.Description>
          配置 OIDC 身份提供方（例如 Keycloak、Azure AD、Authentik），让用户通过单点登录访问。
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="grid gap-6">
          <!-- Enable/Disable -->
          <div class="flex items-center justify-between">
            <div>
              <Label for="oidc_enabled">启用 OpenID Connect</Label>
              <p class="text-muted-foreground text-sm">允许用户通过外部身份提供方登录。</p>
            </div>
            <Switch id="oidc_enabled" bind:checked={settings.enabled} />
          </div>

          <Separator />

          {#if settings.enabled}
            <!-- Provider Name -->
            <div class="grid gap-2">
              <Label for="provider_name">身份提供方名称</Label>
              <Input
                id="provider_name"
                bind:value={settings.provider_name}
                placeholder="例如 Keycloak、Azure AD、Authentik"
              />
              <p class="text-muted-foreground text-xs">
                登录按钮将显示：“使用 {settings.provider_name || "..."} 登录”
              </p>
            </div>

            <!-- Issuer URL -->
            <div class="grid gap-2">
              <Label for="issuer_url">签发方 URL</Label>
              <Input
                id="issuer_url"
                bind:value={settings.issuer_url}
                placeholder="https://keycloak.example.com/realms/myrealm"
              />
              <p class="text-muted-foreground text-xs">
                OIDC 身份提供方的基础 URL，必须支持
                <code>.well-known/openid-configuration</code> 自动发现。
              </p>
            </div>

            <!-- Client ID -->
            <div class="grid gap-2">
              <Label for="client_id">客户端 ID</Label>
              <Input id="client_id" bind:value={settings.client_id} placeholder="kener-client" />
            </div>

            <!-- Client Secret -->
            <div class="grid gap-2">
              <Label for="client_secret">客户端密钥</Label>
              <div class="relative">
                <Input
                  id="client_secret"
                  type={showSecret ? "text" : "password"}
                  bind:value={settings.client_secret}
                  placeholder="••••••••"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  class="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                  aria-label={showSecret ? "隐藏客户端密钥" : "显示客户端密钥"}
                  onclick={() => (showSecret = !showSecret)}
                >
                  {#if showSecret}
                    <EyeOffIcon class="h-4 w-4" />
                  {:else}
                    <EyeIcon class="h-4 w-4" />
                  {/if}
                </Button>
              </div>
            </div>

            <!-- Scopes -->
            <div class="grid gap-2">
              <Label for="scopes">授权范围</Label>
              <Input id="scopes" bind:value={settings.scopes} placeholder="openid profile email" />
              <p class="text-muted-foreground text-xs">
                使用空格分隔 OIDC 授权范围。按需添加身份提供方的用户组范围，例如 “openid profile email groups”。
              </p>
            </div>

            <!-- Groups Claim -->
            <div class="grid gap-2">
              <Label for="groups_claim">用户组声明名称</Label>
              <Input id="groups_claim" bind:value={settings.groups_claim} placeholder="groups" />
              <p class="text-muted-foreground text-xs">
                ID 令牌中包含用户所属用户组的声明字段。常见值：“groups”（Keycloak、Authentik）、“roles”、
                “cognito:groups”（AWS）。
              </p>
            </div>

            <Separator />

            <!-- Allow Local Login -->
            <div class="flex items-center justify-between">
              <div>
                <Label for="allow_local_login">允许本地登录</Label>
                <p class="text-muted-foreground text-sm">
                  关闭后，用户只能通过 OIDC 身份提供方登录，密码登录表单将隐藏。
                </p>
              </div>
              <Switch id="allow_local_login" bind:checked={settings.allow_local_login} />
            </div>

            <!-- Auto-Create Users -->
            <div class="flex items-center justify-between">
              <div>
                <Label for="auto_create_users">首次登录时自动创建用户</Label>
                <p class="text-muted-foreground text-sm">
                  启用后，首次通过 OIDC 登录时自动创建 Kener 用户；关闭时，需要提前创建用户。
                </p>
              </div>
              <Switch id="auto_create_users" bind:checked={settings.auto_create_users} />
            </div>

            <!-- Default Role -->
            <div class="grid gap-2">
              <Label for="default_role_id">默认角色</Label>
              <Select.Root
                type="single"
                value={settings.default_role_id}
                onValueChange={(val) => {
                  if (val) settings.default_role_id = val;
                }}
              >
                <Select.Trigger id="default_role_id" class="w-full">
                  {getRoleName(settings.default_role_id) || "请选择角色..."}
                </Select.Trigger>
                <Select.Content>
                  {#each roles as role (role.id)}
                    <Select.Item value={role.id}>
                      {getRoleName(role.id)}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
              <p class="text-muted-foreground text-xs">用户的 OIDC 用户组未匹配下方任何映射时，将分配此角色。</p>
            </div>

            <Separator />

            <!-- Test Connection -->
            {#if testResult}
              <div
                class="rounded-lg border p-4 {testResult.success
                  ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                  : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'}"
              >
                <div class="mb-2 flex items-center gap-2">
                  {#if testResult.success}
                    <CheckCircleIcon class="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span class="font-medium text-green-800 dark:text-green-200">连接成功</span>
                  {:else}
                    <XCircleIcon class="h-5 w-5 text-red-600 dark:text-red-400" />
                    <span class="font-medium text-red-800 dark:text-red-200">连接失败</span>
                  {/if}
                </div>
                {#if testResult.success}
                  <div class="space-y-1 text-sm text-green-700 dark:text-green-300">
                    <p>签发方：<code class="text-xs">{testResult.issuer}</code></p>
                    <p>授权端点：<code class="text-xs">{testResult.authorizationEndpoint}</code></p>
                    <p>令牌端点：<code class="text-xs">{testResult.tokenEndpoint}</code></p>
                    {#if testResult.userinfoEndpoint}
                      <p>用户信息端点：<code class="text-xs">{testResult.userinfoEndpoint}</code></p>
                    {/if}
                  </div>
                {:else}
                  <p class="text-sm text-red-700 dark:text-red-300">{testResult.error}</p>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-between">
        {#if settings.enabled}
          <Button
            variant="outline"
            disabled={testing || !settings.issuer_url || !settings.client_id}
            onclick={testConnection}
          >
            {#if testing}
              <Spinner class="mr-2 h-4 w-4" />
            {:else}
              <PlayIcon class="mr-2 h-4 w-4" />
            {/if}
            测试连接
          </Button>
        {:else}
          <div></div>
        {/if}
        <Button disabled={saving} onclick={saveSettings}>
          {#if saving}
            <Spinner class="mr-2 h-4 w-4" />
          {:else}
            <SaveIcon class="mr-2 h-4 w-4" />
          {/if}
          保存设置
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- ============ Group-Role Mapping Card ============ -->
    {#if settings.enabled}
      <Card.Root>
        <Card.Header>
          <Card.Title>用户组 → 角色映射</Card.Title>
          <Card.Description>
            将 OIDC 用户组名称映射到 Kener 角色。用户通过 OIDC 登录时，根据所属用户组分配 Kener 角色，
            每次登录都会同步角色。
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <!-- Add new mapping -->
          <div class="mb-6 flex items-end gap-3">
            <div class="grid flex-1 gap-2">
              <Label for="new_group">OIDC 用户组</Label>
              <Input id="new_group" bind:value={newMappingGroup} placeholder="例如 Windows-Admins" />
            </div>
            <div class="grid flex-1 gap-2">
              <Label for="new_mapping_role">Kener 角色</Label>
              <Select.Root
                type="single"
                value={newMappingRoleId}
                onValueChange={(val) => {
                  if (val) newMappingRoleId = val;
                }}
              >
                <Select.Trigger id="new_mapping_role" class="w-full">
                  {newMappingRoleId ? getRoleName(newMappingRoleId) : "请选择角色..."}
                </Select.Trigger>
                <Select.Content>
                  {#each roles as role (role.id)}
                    <Select.Item value={role.id}>
                      {getRoleName(role.id)}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
            <Button disabled={addingMapping} onclick={addMapping}>
              {#if addingMapping}
                <Spinner class="mr-2 h-4 w-4" />
              {:else}
                <PlusIcon class="mr-2 h-4 w-4" />
              {/if}
              添加映射
            </Button>
          </div>

          <!-- Mappings table -->
          {#if loadingMappings}
            <div class="flex items-center justify-center py-8">
              <Spinner class="h-6 w-6" />
            </div>
          {:else if mappings.length === 0}
            <div class="text-muted-foreground rounded-lg border border-dashed py-8 text-center">
              <p>尚未配置用户组映射。</p>
              <p class="mt-1 text-sm">在上方添加映射，根据 OIDC 用户组分配 Kener 角色。</p>
            </div>
          {:else}
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head class="pl-4">OIDC 用户组</Table.Head>
                  <Table.Head>Kener 角色</Table.Head>
                  <Table.Head class="pr-4 text-right">操作</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each mappings as mapping (mapping.id)}
                  <Table.Row>
                    <Table.Cell class="pl-4">
                      <code class="text-sm">{mapping.oidc_group}</code>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="outline">{getRoleName(mapping.role_id)}</Badge>
                    </Table.Cell>
                    <Table.Cell class="pr-4 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        aria-label={`删除 ${mapping.oidc_group} 的映射`}
                        onclick={() => openDeleteMappingDialog(mapping)}
                      >
                        <TrashIcon class="h-4 w-4" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- ============ Info Card ============ -->
      <Card.Root>
        <Card.Header>
          <Card.Title>工作原理</Card.Title>
        </Card.Header>
        <Card.Content>
          <div class="text-muted-foreground space-y-3 text-sm">
            <p>
              <strong>每次通过 OIDC 登录时</strong>，Kener 都会使用上方配置的声明名称，从 ID
              令牌读取用户所属用户组，并据此更新角色。
            </p>
            <p>
              <strong>OIDC 映射分配的角色</strong>会完全同步：用户被移出 OIDC 用户组后，下次登录时会失去对应的 Kener
              角色。
            </p>
            <p>
              <strong>手动分配的角色</strong>（未出现在上述映射中，且未设为默认角色）会保留，不受 OIDC 同步影响。
            </p>
            <p>
              <strong>没有匹配的用户组时</strong>，将分配上方配置的默认角色。
            </p>
            <p>
              请在 OIDC 身份提供方中配置以下<strong>回调 URL</strong>：<br />
              <code class="bg-muted rounded px-2 py-1 text-xs">
                {typeof window !== "undefined" ? window.location.origin : "https://your-kener-domain"}{resolve(
                  "/account/oidc/callback"
                )}
              </code>
            </p>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</div>

<!-- Delete Mapping Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>删除用户组映射</AlertDialog.Title>
      <AlertDialog.Description>
        确定删除 OIDC 用户组“{mappingToDelete?.oidc_group}”的映射吗？该组用户下次登录时，将不再通过此映射获得 “{mappingToDelete
          ? getRoleName(mappingToDelete.role_id)
          : ""}”角色。
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={deletingMapping}>取消</AlertDialog.Cancel>
      <AlertDialog.Action onclick={deleteMapping} disabled={deletingMapping}>
        {#if deletingMapping}
          <Spinner class="h-4 w-4" />
        {/if}
        删除
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
