<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import GC from "$lib/global-constants";

  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import UsersIcon from "@lucide/svelte/icons/users";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CheckCheckIcon from "@lucide/svelte/icons/check-check";
  import MailWarningIcon from "@lucide/svelte/icons/mail-warning";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import EyeClosedIcon from "@lucide/svelte/icons/eye-closed";
  import EyeOpenIcon from "@lucide/svelte/icons/eye";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { toast } from "svelte-sonner";
  import LocalTime from "$lib/components/LocalTime.svelte";
  import { onMount } from "svelte";
  import type { UserRecordDashboard, UserRecordPublic, RoleRecord } from "$lib/server/types/db.js";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";

  // Types
  interface NewUser {
    name: string;
    email: string;
    role_ids: string[];
  }

  interface EditUser extends UserRecordDashboard {
    actions: {
      sendingVerificationEmail: boolean;
      resendingInvitation: boolean;
      updatingRole: boolean;
      deactivatingUser: boolean;
      activatingUser: boolean;
    };
  }

  interface PageData {
    userDb: UserRecordPublic;
    userPermissions: string[];
    canSendEmail: boolean;
  }

  let { data }: { data: PageData } = $props();

  // Derived from data
  let currentUser = $derived(data.userDb);
  let userPermissions = $derived(data.userPermissions);
  let canSendEmail = $derived(data.canSendEmail);

  function hasPermission(perm: string): boolean {
    return userPermissions.includes(perm);
  }

  const roleDisplayNames: Record<string, string> = {
    Administrator: "管理员",
    Editor: "编辑者",
    Member: "成员"
  };

  function getRoleDisplayName(name: string): string {
    return roleDisplayNames[name] ?? name;
  }

  // State
  let loading = $state(true);
  let users = $state<UserRecordDashboard[]>([]);
  let roles = $state<RoleRecord[]>([]);
  let page = $state(1);
  let limit = $state(10);
  let total = $state(0);
  let totalPages = $state(0);
  let statusFilter = $state<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Add user modal state
  let showAddUserDialog = $state(false);
  let creatingUser = $state(false);
  let creatingUserError = $state("");
  let newUser = $state<NewUser>({
    name: "",
    email: "",
    role_ids: []
  });

  // Edit user sheet state
  let showSettingsSheet = $state(false);
  let toEditUser = $state<EditUser | null>(null);
  let manualUpdateError = $state("");
  let manualSuccess = $state("");
  let sendingSelfVerification = $state(false);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  function normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }

  // Fetch users
  async function fetchUsers() {
    loading = true;
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getUsers",
          data: { page, limit, is_active: statusFilter === "ACTIVE" ? 1 : 0 }
        })
      });
      const result = await res.json();
      if (!result.error) {
        users = result.users || [];
        total = result.total || 0;
        totalPages = Math.ceil(total / limit);
      }
    } catch (error) {
      console.error("获取用户失败：", error);
      toast.error("加载用户失败");
    } finally {
      loading = false;
    }
  }

  // Create new user
  async function createNewUser() {
    creatingUserError = "";

    const normalizedName = normalizeName(newUser.name);
    const normalizedEmail = normalizeEmail(newUser.email);

    if (!normalizedName) {
      creatingUserError = "姓名不能为空";
      return;
    }
    if (normalizedName.length < 2) {
      creatingUserError = "姓名至少需要 2 个字符";
      return;
    }
    if (normalizedName.length > 100) {
      creatingUserError = "姓名不能超过 100 个字符";
      return;
    }
    if (!normalizedEmail) {
      creatingUserError = "邮箱不能为空";
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      creatingUserError = "请输入有效的邮箱地址";
      return;
    }
    if (newUser.role_ids.length === 0) {
      creatingUserError = "至少选择一个角色";
      return;
    }

    creatingUser = true;

    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createNewUser",
          data: {
            ...newUser,
            name: normalizedName,
            email: normalizedEmail
          }
        })
      });
      const result = await res.json();

      if (result.error) {
        creatingUserError = result.error;
      } else {
        users = [...users, result];
        showAddUserDialog = false;
        resetNewUser();
        toast.success("用户邀请已发送");
      }
    } catch (error) {
      creatingUserError = "创建用户时出错";
    } finally {
      creatingUser = false;
    }
  }

  function resetNewUser() {
    newUser = {
      name: "",
      email: "",
      role_ids: []
    };
  }

  // Open settings for a user
  function openSettingsSheet(user: UserRecordDashboard) {
    toEditUser = {
      ...JSON.parse(JSON.stringify(user)),
      actions: {
        sendingVerificationEmail: false,
        resendingInvitation: false,
        updatingRole: false,
        deactivatingUser: false,
        activatingUser: false
      }
    };
    manualUpdateError = "";
    manualSuccess = "";
    showSettingsSheet = true;
  }

  // Resend invitation email
  async function resendInvitationEmail(email: string) {
    try {
      await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resendInvitation",
          data: { email }
        })
      });
      toast.success("邀请邮件已重新发送");
    } catch (error) {
      toast.error("重新发送邀请邮件失败");
    }
  }

  // Send verification email
  async function sendVerificationEmail(id: number) {
    sendingSelfVerification = true;
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendVerificationEmail",
          data: { toId: id }
        })
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "发送验证邮件失败");
      }
      toast.success("验证邮件已发送");
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送验证邮件失败";
      toast.error(message);
    } finally {
      sendingSelfVerification = false;
    }
  }

  // Manual update user data
  async function manualUpdateData(updateType: string) {
    if (!toEditUser) return;

    manualUpdateError = "";
    manualSuccess = "";

    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manualUpdate",
          data: { ...toEditUser, updateType }
        })
      });
      const result = await res.json();

      if (result.error) {
        manualUpdateError = result.error;
      } else {
        users = users.map((user) => (user.id === toEditUser!.id ? result : user));
        manualSuccess = updateType === "role" ? "用户角色已更新" : "用户状态已更新";

        // Update toEditUser with the result
        toEditUser = {
          ...result,

          actions: toEditUser.actions
        };
      }
    } catch (error) {
      manualUpdateError = "更新用户时出错";
    }
  }

  // Pagination
  function goToPage(newPage: number) {
    page = newPage;
    fetchUsers();
  }

  // Role badge variant by precedence: admin > editor > others
  function getRoleBadgeVariant(roleIds: string[]): "default" | "secondary" | "outline" {
    if (roleIds.includes("admin")) return "default";
    if (roleIds.includes("editor")) return "secondary";
    return "outline";
  }

  let activeRoles = $derived(roles.filter((r) => r.status === "ACTIVE"));

  // Fetch roles
  async function fetchRoles() {
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getRoles", data: {} })
      });
      const result = await res.json();
      if (!result.error) {
        roles = result;
      }
    } catch {
      toast.error("加载角色失败");
    }
  }

  function toggleRole(roleId: string, currentList: string[]): string[] {
    if (currentList.includes(roleId)) {
      return currentList.filter((r) => r !== roleId);
    } else {
      return [...currentList, roleId];
    }
  }

  // Initial load
  onMount(() => {
    fetchUsers();
    fetchRoles();
  });
</script>

<div class="container mx-auto space-y-6 py-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-1">
      <Button
        variant={statusFilter === "ACTIVE" ? "default" : "outline"}
        size="sm"
        onclick={() => {
          statusFilter = "ACTIVE";
          page = 1;
          fetchUsers();
        }}
      >
        已启用
      </Button>
      <Button
        variant={statusFilter === "INACTIVE" ? "default" : "outline"}
        size="sm"
        onclick={() => {
          statusFilter = "INACTIVE";
          page = 1;
          fetchUsers();
        }}
      >
        已停用
      </Button>
    </div>
    <div class="flex items-center gap-2">
      {#if loading}
        <Spinner class="size-5" />
      {/if}
      {#if hasPermission("users.write")}
        {#if !canSendEmail}
          <p class="text-muted-foreground max-w-xs text-xs">
            邮件服务尚未配置，无法邀请新用户。请前往
            <a href={`${GC.DOCS_URL}/v4/setup/email-setup`} target="_blank" class="text-blue-500 underline">
              配置邮件
            </a>
            查看详情。
          </p>
        {/if}
        <Button onclick={() => (showAddUserDialog = true)} disabled={!canSendEmail}>
          <PlusIcon class="h-4 w-4" />
          添加用户
        </Button>
      {/if}
    </div>
  </div>

  <!-- Users Table -->
  <div class="ktable rounded-xl border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>姓名</Table.Head>
          <Table.Head>邮箱</Table.Head>
          <Table.Head class="text-center">登录方式</Table.Head>
          <Table.Head class="text-center">已验证</Table.Head>
          <Table.Head>角色</Table.Head>
          <Table.Head>状态</Table.Head>
          <Table.Head class="w-20 text-center">操作</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if loading && users.length === 0}
          <Table.Row>
            <Table.Cell colspan={7} class="py-8 text-center">
              <div class="flex items-center justify-center gap-2">
                <Spinner class="size-4" />
                <span class="text-muted-foreground text-sm">正在加载用户...</span>
              </div>
            </Table.Cell>
          </Table.Row>
        {:else if users.length === 0}
          <Table.Row>
            <Table.Cell colspan={7} class="text-muted-foreground py-8 text-center">暂无用户。</Table.Cell>
          </Table.Row>
        {:else}
          {#each users as user (user.id)}
            <Table.Row class={currentUser.id === user.id ? "bg-muted/50" : ""}>
              <Table.Cell class="font-medium"
                >{user.name}{#if currentUser.id === user.id}
                  <Badge variant="outline" class="ml-1 text-[10px]">你</Badge>{/if}</Table.Cell
              >
              <Table.Cell>{user.email}</Table.Cell>
              <Table.Cell class="text-center">
                <Badge variant={user.auth_provider === GC.AUTH_PROVIDER_OIDC ? "default" : "outline"}>
                  {user.auth_provider === GC.AUTH_PROVIDER_OIDC ? "OIDC" : "本地"}
                </Badge>
              </Table.Cell>
              <Table.Cell class="text-center">
                {#if user.is_verified || user.auth_provider === GC.AUTH_PROVIDER_OIDC}
                  <CheckCheckIcon class="mx-auto h-4 w-4 text-blue-500" />
                {:else}
                  <MailWarningIcon class="mx-auto h-4 w-4 text-yellow-500" />
                {/if}
              </Table.Cell>
              <Table.Cell>
                <Badge variant={getRoleBadgeVariant(user.role_ids)} class="uppercase">
                  {user.role_ids.join(", ")}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                {#if user.is_active}
                  <span class="text-sm font-semibold text-green-500">已启用</span>
                {:else}
                  <span class="text-sm font-semibold text-pink-500">已停用</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-center">
                {#if hasPermission("users.write") && currentUser.id !== user.id}
                  <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => openSettingsSheet(user)}>
                    <SettingsIcon class="h-4 w-4" />
                  </Button>
                {:else if currentUser.id === user.id && !!!currentUser.is_verified}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendingSelfVerification}
                    onclick={() => sendVerificationEmail(user.id)}
                  >
                    {#if sendingSelfVerification}
                      <Spinner class="size-4" />
                    {/if}
                    验证邮箱
                  </Button>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- Pagination -->
  {#if total > 0}
    {@const startItem = (page - 1) * limit + 1}
    {@const endItem = Math.min(page * limit, total)}
    <div class="flex items-center justify-between">
      <span class="text-muted-foreground text-sm">显示第 {startItem}-{endItem} 条，共 {total} 条</span>
      {#if totalPages > 1}
        <div class="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={page === 1} onclick={() => goToPage(page - 1)}>
            <ChevronLeftIcon class="size-4" />
          </Button>
          <div class="flex items-center gap-1">
            {#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNum (pageNum)}
              {#if pageNum === 1 || pageNum === totalPages || (pageNum >= page - 1 && pageNum <= page + 1)}
                <Button variant={pageNum === page ? "default" : "ghost"} size="sm" onclick={() => goToPage(pageNum)}>
                  {pageNum}
                </Button>
              {:else if pageNum === page - 2 || pageNum === page + 2}
                <span class="text-muted-foreground px-1">...</span>
              {/if}
            {/each}
          </div>
          <Button variant="outline" size="icon" disabled={page === totalPages} onclick={() => goToPage(page + 1)}>
            <ChevronRightIcon class="size-4" />
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Add User Dialog -->
<Dialog.Root bind:open={showAddUserDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>添加新用户</Dialog.Title>
      <Dialog.Description>为项目添加新用户</Dialog.Description>
    </Dialog.Header>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        createNewUser();
      }}
    >
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="name">姓名</Label>
          <Input id="name" type="text" placeholder="张三" bind:value={newUser.name} required />
        </div>
        <div class="space-y-2">
          <Label for="email">邮箱</Label>
          <Input id="email" type="email" placeholder="email@example.com" bind:value={newUser.email} required />
        </div>

        <div class="space-y-2">
          <Label>角色</Label>
          <div class="space-y-2">
            {#each activeRoles as role (role.id)}
              <label class="flex items-center gap-2">
                <Checkbox
                  checked={newUser.role_ids.includes(role.id)}
                  onCheckedChange={() => {
                    newUser.role_ids = toggleRole(role.id, newUser.role_ids);
                  }}
                />
                <span class="text-sm uppercase">{getRoleDisplayName(role.role_name)}</span>
              </label>
            {/each}
            {#if activeRoles.length === 0}
              <p class="text-muted-foreground text-sm">暂无可用角色</p>
            {/if}
          </div>
        </div>
        {#if creatingUserError}
          <p class="text-destructive text-sm font-medium">{creatingUserError}</p>
        {/if}
      </div>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (showAddUserDialog = false)}>取消</Button>
        <Button type="submit" disabled={creatingUser}>
          {#if creatingUser}
            <Spinner class="size-4" />
          {/if}
          添加用户
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<!-- Edit User Sheet -->
<Sheet.Root bind:open={showSettingsSheet}>
  <Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-xl">
    <Sheet.Header>
      <Sheet.Title>设置 - {toEditUser?.name}</Sheet.Title>
      <Sheet.Description>管理用户设置和权限</Sheet.Description>
    </Sheet.Header>
    <div class="px-4">
      {#if toEditUser}
        <div class="space-y-6 py-6">
          <!-- User Info -->
          <div class="space-y-2 text-sm">
            <p>
              <strong>创建时间：</strong>
              <LocalTime value={toEditUser.created_at} format="yyyy年M月d日 HH:mm" />
            </p>
            <p>
              <strong>更新时间：</strong>
              <LocalTime value={toEditUser.updated_at} format="yyyy年M月d日 HH:mm" />
            </p>
            <p>
              <strong>姓名：</strong>
              {toEditUser.name}
            </p>
          </div>
          <!-- Resend Invitation -->
          {#if !toEditUser.has_password && toEditUser.auth_provider !== GC.AUTH_PROVIDER_OIDC}
            <Card.Root>
              <Card.Content class="">
                <p class="mb-3 text-sm">
                  此用户尚未设置密码，可向 {toEditUser.email} 重新发送邀请邮件。
                </p>
                {#if !canSendEmail}
                  <Alert.Root variant="destructive" class="mb-4">
                    <Alert.Description>邮件服务尚未配置，无法重新发送邀请邮件。</Alert.Description>
                  </Alert.Root>
                {/if}
                <Button
                  variant="secondary"
                  disabled={toEditUser.actions.resendingInvitation || !canSendEmail}
                  onclick={async () => {
                    toEditUser!.actions.resendingInvitation = true;
                    manualSuccess = "";
                    await resendInvitationEmail(toEditUser!.email);
                    toEditUser!.actions.resendingInvitation = false;
                    manualSuccess = "邀请邮件已重新发送";
                  }}
                >
                  {#if toEditUser.actions.resendingInvitation}
                    <Spinner class="size-4" />
                  {/if}
                  重新发送邀请
                </Button>
              </Card.Content>
            </Card.Root>
          {/if}

          <!-- Update Role -->
          <Card.Root>
            <Card.Content class="p-4">
              <p class="mb-3 text-sm">修改用户角色，用户将根据分配的角色获得相应权限。</p>
              <div class="space-y-2">
                {#each activeRoles as role (role.id)}
                  <label class="flex items-center gap-2">
                    <Checkbox
                      checked={toEditUser.role_ids.includes(role.id)}
                      disabled={toEditUser.actions.updatingRole}
                      onCheckedChange={() => {
                        toEditUser!.role_ids = toggleRole(role.id, toEditUser!.role_ids);
                      }}
                    />
                    <span class="text-sm uppercase">{getRoleDisplayName(role.role_name)}</span>
                  </label>
                {/each}
                {#if activeRoles.length === 0}
                  <p class="text-muted-foreground text-sm">暂无可用角色</p>
                {/if}
              </div>
              <Button
                variant="secondary"
                class="mt-3"
                disabled={toEditUser.actions.updatingRole || toEditUser.role_ids.length === 0}
                onclick={() => {
                  toEditUser!.actions.updatingRole = true;
                  manualUpdateData("role").then(() => {
                    toEditUser!.actions.updatingRole = false;
                  });
                }}
              >
                {#if toEditUser.actions.updatingRole}
                  <Spinner class="size-4" />
                {/if}
                更新角色
              </Button>
            </Card.Content>
          </Card.Root>

          <!-- Activate/Deactivate User -->
          {#if toEditUser.is_active}
            <Card.Root class="border-destructive">
              <Card.Content class="p-4">
                <p class="mb-3 text-sm">停用用户后，该用户将无法登录，现有会话也会失效。</p>
                <Button
                  variant="destructive"
                  disabled={toEditUser.actions.deactivatingUser}
                  onclick={() => {
                    toEditUser!.actions.deactivatingUser = true;
                    toEditUser!.is_active = 0;
                    manualUpdateData("is_active").then(() => {
                      toEditUser!.actions.deactivatingUser = false;
                    });
                  }}
                >
                  {#if toEditUser.actions.deactivatingUser}
                    <Spinner class="size-4" />
                  {/if}
                  停用用户
                </Button>
              </Card.Content>
            </Card.Root>
          {:else}
            <Card.Root>
              <Card.Content class="p-4">
                <p class="mb-3 text-sm">启用用户后，该用户可以正常登录。</p>
                <Button
                  variant="secondary"
                  disabled={toEditUser.actions.activatingUser}
                  onclick={() => {
                    toEditUser!.actions.activatingUser = true;
                    toEditUser!.is_active = 1;
                    manualUpdateData("is_active").then(() => {
                      toEditUser!.actions.activatingUser = false;
                    });
                  }}
                >
                  {#if toEditUser.actions.activatingUser}
                    <Spinner class="size-4" />
                  {/if}
                  启用用户
                </Button>
              </Card.Content>
            </Card.Root>
          {/if}

          <!-- Status Messages -->
          {#if manualUpdateError}
            <Alert.Root variant="destructive">
              <Alert.Description>{manualUpdateError}</Alert.Description>
            </Alert.Root>
          {/if}
          {#if manualSuccess}
            <Alert.Root class="border-green-500 text-green-500">
              <Alert.Description>{manualSuccess}</Alert.Description>
            </Alert.Root>
          {/if}
        </div>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
