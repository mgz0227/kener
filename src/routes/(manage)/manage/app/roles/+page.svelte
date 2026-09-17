<script lang="ts">
  import * as Accordion from "$lib/components/ui/accordion/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import * as Checkbox from "$lib/components/ui/checkbox/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import LockIcon from "@lucide/svelte/icons/lock";
  import KeyIcon from "@lucide/svelte/icons/key";
  import UsersIcon from "@lucide/svelte/icons/users";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import { toast } from "svelte-sonner";
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import type { UserRecordPublic, RoleRecord } from "$lib/server/types/db.js";

  interface Permission {
    id: string;
    permission_name: string;
  }

  interface RoleUser extends UserRecordPublic {
    roles_id: string;
  }

  interface PageData {
    userDb: UserRecordPublic;
    userPermissions: string[];
  }

  let { data }: { data: PageData } = $props();
  let currentUser = $derived(data.userDb);
  let userPermissions = $derived(data.userPermissions);

  function hasPermission(perm: string): boolean {
    return userPermissions.includes(perm);
  }

  // State
  let loading = $state(true);
  let roles = $state<RoleRecord[]>([]);
  let allPermissions = $state<Permission[]>([]);
  let allUsers = $state<UserRecordPublic[]>([]);

  // Create role dialog
  let showCreateDialog = $state(false);
  let creatingRole = $state(false);
  let createError = $state("");
  let newRole = $state({ role_id: "", name: "" });
  let createPermissionMode = $state<"pick" | "clone">("pick");
  let cloneFromRoleId = $state("");

  // Delete role dialog
  let showDeleteDialog = $state(false);
  let deletingRole = $state(false);
  let roleToDelete = $state<RoleRecord | null>(null);
  let deleteAction = $state<"migrate" | "remove">("remove");
  let deleteTargetRoleId = $state("");

  // Edit role dialog
  let showEditDialog = $state(false);
  let editingRole = $state(false);
  let editError = $state("");
  let roleToEdit = $state<RoleRecord | null>(null);
  let editRole = $state({ name: "", status: "ACTIVE" });

  // Permissions sheet
  let showPermissionsSheet = $state(false);
  let permissionsRole = $state<RoleRecord | null>(null);
  let rolePermissionIds = $state<Set<string>>(new Set());
  let savingPermissions = $state(false);
  let loadingPermissions = $state(false);

  // Users sheet
  let showUsersSheet = $state(false);
  let usersRole = $state<RoleRecord | null>(null);
  let roleUsers = $state<RoleUser[]>([]);
  let loadingUsers = $state(false);
  let addingUserId = $state<number | null>(null);
  let removingUserId = $state<number | null>(null);

  const apiUrl = clientResolver(resolve, "/manage/api");
  const permissionGroupLabels: Record<string, string> = {
    monitors: "监控项",
    incidents: "故障事件",
    maintenances: "维护计划",
    pages: "页面",
    triggers: "触发器",
    alerts: "告警",
    api_keys: "API 密钥",
    users: "用户",
    settings: "站点设置",
    subscribers: "订阅者",
    email_templates: "邮件模板",
    images: "图片",
    roles: "角色"
  };
  const permissionLabels: Record<string, string> = {
    "monitors.read": "查看监控项和监控数据",
    "monitors.write": "创建、更新、删除和克隆监控项",
    "incidents.read": "查看故障事件和评论",
    "incidents.write": "创建、更新和删除故障事件及评论",
    "maintenances.read": "查看维护计划和事件",
    "maintenances.write": "创建、更新和删除维护计划及事件",
    "pages.read": "查看页面",
    "pages.write": "创建、更新和删除页面",
    "triggers.read": "查看触发器",
    "triggers.write": "创建、更新、删除和测试触发器",
    "alerts.read": "查看告警配置和告警历史",
    "alerts.write": "创建、更新和删除告警配置",
    "api_keys.read": "查看 API 密钥",
    "api_keys.write": "创建和更新 API 密钥",
    "api_keys.delete": "删除 API 密钥",
    "users.read": "查看用户",
    "users.write": "管理用户、邀请和验证",
    "settings.read": "查看站点设置和订阅配置",
    "settings.write": "更新站点设置和订阅配置",
    "subscribers.read": "查看订阅者",
    "subscribers.write": "管理订阅者和订阅",
    "email_templates.read": "查看邮件模板",
    "email_templates.write": "更新邮件模板",
    "images.write": "上传和删除图片",
    "roles.read": "查看角色、权限和用户分配",
    "roles.write": "创建、更新和删除角色",
    "roles.assign_permissions": "为角色添加或移除权限",
    "roles.assign_users": "为角色添加或移除用户"
  };
  const roleDisplayNames: Record<string, string> = {
    admin: "管理员",
    editor: "编辑者",
    member: "成员"
  };

  function getRoleDisplayName(role: RoleRecord | null | undefined): string {
    return (role?.readonly === 1 && roleDisplayNames[role.id]) || role?.role_name || "";
  }

  async function apiCall(action: string, data: Record<string, unknown> = {}) {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data })
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result;
  }

  async function fetchRoles() {
    loading = true;
    try {
      const result = await apiCall("getRoles");
      roles = result;
    } catch {
      toast.error("加载角色失败");
    } finally {
      loading = false;
    }
  }

  async function fetchAllPermissions() {
    try {
      allPermissions = await apiCall("getAllPermissions");
    } catch {
      toast.error("加载权限失败");
    }
  }

  async function fetchAllUsers() {
    try {
      const result = await apiCall("getUsers", { page: 1, limit: 1000 });
      allUsers = result.users || [];
    } catch {
      toast.error("加载用户失败");
    }
  }

  function openCreateDialog(prefill?: { role_id: string; name: string; cloneFromRoleId: string }) {
    if (prefill) {
      newRole = { role_id: prefill.role_id, name: prefill.name };
      createPermissionMode = "clone";
      cloneFromRoleId = prefill.cloneFromRoleId;
    } else {
      newRole = { role_id: "", name: "" };
      createPermissionMode = "pick";
      cloneFromRoleId = "";
    }
    createError = "";
    showCreateDialog = true;
  }

  // Create role
  async function handleCreateRole() {
    createError = "";
    if (!newRole.role_id.trim()) {
      createError = "角色 ID 不能为空";
      return;
    }
    if (!newRole.name.trim()) {
      createError = "角色名称不能为空";
      return;
    }
    if (createPermissionMode === "clone" && !cloneFromRoleId) {
      createError = "请选择要复制权限的角色";
      return;
    }
    creatingRole = true;
    try {
      const created = await apiCall("createRole", { role_id: newRole.role_id, name: newRole.name });

      // Clone permissions if selected
      if (createPermissionMode === "clone" && cloneFromRoleId) {
        const sourcePerms = await apiCall("getRolePermissions", { roleId: cloneFromRoleId });
        const permIds = sourcePerms.map((p: { permissions_id: string }) => p.permissions_id);
        if (permIds.length > 0) {
          await apiCall("updateRolePermissions", {
            roleId: newRole.role_id.trim().toLowerCase().replace(/\s+/g, "_"),
            permissionIds: permIds
          });
        }
      }

      toast.success("角色已创建");
      showCreateDialog = false;
      const createdRoleId = newRole.role_id.trim().toLowerCase().replace(/\s+/g, "_");
      newRole = { role_id: "", name: "" };
      cloneFromRoleId = "";
      createPermissionMode = "pick";
      await fetchRoles();

      // Open permissions sheet for the newly created role
      const createdRole = roles.find((r) => r.id === createdRoleId);
      if (createdRole) {
        openPermissions(createdRole);
      }
    } catch (e: unknown) {
      createError = e instanceof Error ? e.message : "创建角色失败";
    } finally {
      creatingRole = false;
    }
  }

  // Delete role
  async function handleDeleteRole() {
    if (!roleToDelete) return;
    deletingRole = true;
    try {
      const options =
        deleteAction === "migrate"
          ? { action: "migrate" as const, targetRoleId: deleteTargetRoleId }
          : { action: "remove" as const };
      await apiCall("deleteRole", { roleId: roleToDelete.id, options });
      toast.success("角色已删除");
      showDeleteDialog = false;
      roleToDelete = null;
      await fetchRoles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除角色失败");
    } finally {
      deletingRole = false;
    }
  }

  // Edit role
  function openEditDialog(role: RoleRecord) {
    roleToEdit = role;
    editRole = { name: role.role_name, status: role.status };
    editError = "";
    showEditDialog = true;
  }

  async function handleEditRole() {
    if (!roleToEdit) return;
    editError = "";
    if (!editRole.name.trim()) {
      editError = "角色名称不能为空";
      return;
    }
    editingRole = true;
    try {
      await apiCall("updateRole", {
        roleId: roleToEdit.id,
        name: editRole.name,
        status: editRole.status
      });
      toast.success("角色已更新");
      showEditDialog = false;
      roleToEdit = null;
      await fetchRoles();
    } catch (e: unknown) {
      editError = e instanceof Error ? e.message : "更新角色失败";
    } finally {
      editingRole = false;
    }
  }

  // Open permissions sheet
  async function openPermissions(role: RoleRecord) {
    permissionsRole = role;
    rolePermissionIds = new Set();
    showPermissionsSheet = true;
    loadingPermissions = true;
    try {
      const perms = await apiCall("getRolePermissions", { roleId: role.id });
      rolePermissionIds = new Set(perms.map((p: { permissions_id: string }) => p.permissions_id));
    } catch {
      toast.error("加载权限失败");
    } finally {
      loadingPermissions = false;
    }
  }

  // Save permissions
  async function savePermissions() {
    if (!permissionsRole) return;
    savingPermissions = true;
    try {
      await apiCall("updateRolePermissions", {
        roleId: permissionsRole.id,
        permissionIds: Array.from(rolePermissionIds)
      });
      toast.success("权限已更新");
      showPermissionsSheet = false;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "更新权限失败");
    } finally {
      savingPermissions = false;
    }
  }

  function togglePermission(permId: string) {
    const next = new Set(rolePermissionIds);
    if (next.has(permId)) {
      next.delete(permId);
    } else {
      next.add(permId);
    }
    rolePermissionIds = next;
  }

  // Open users sheet
  async function openUsers(role: RoleRecord) {
    usersRole = role;
    roleUsers = [];
    showUsersSheet = true;
    loadingUsers = true;
    try {
      const canAssign = hasPermission("roles.assign_users");
      const [users] = await Promise.all([
        apiCall("getRoleUsers", { roleId: role.id }),
        canAssign ? fetchAllUsers() : Promise.resolve()
      ]);
      roleUsers = users;
    } catch {
      toast.error("加载角色用户失败");
    } finally {
      loadingUsers = false;
    }
  }

  // Add user to role
  async function addUser(userId: number) {
    if (!usersRole) return;
    addingUserId = userId;
    try {
      await apiCall("addUserToRole", { roleId: usersRole.id, userId });
      toast.success("用户已添加到角色");
      roleUsers = await apiCall("getRoleUsers", { roleId: usersRole.id });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "添加用户失败");
    } finally {
      addingUserId = null;
    }
  }

  // Remove user from role
  async function removeUser(userId: number) {
    if (!usersRole) return;
    removingUserId = userId;
    try {
      await apiCall("removeUserFromRole", { roleId: usersRole.id, userId });
      toast.success("用户已从角色移除");
      roleUsers = await apiCall("getRoleUsers", { roleId: usersRole.id });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "移除用户失败");
    } finally {
      removingUserId = null;
    }
  }

  let groupedPermissions = $derived.by(() => {
    const groups: Array<{ group: string; label: string; permissions: Permission[] }> = [];
    const groupMap = new Map<string, Permission[]>();
    for (const perm of allPermissions) {
      const dotIndex = perm.id.indexOf(".");
      const group = dotIndex > -1 ? perm.id.substring(0, dotIndex) : perm.id;
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group)!.push(perm);
    }
    for (const [group, perms] of groupMap) {
      const label = permissionGroupLabels[group] ?? group.replace(/_/g, " ");
      groups.push({ group, label, permissions: perms });
    }
    return groups;
  });

  function groupGrantedCount(perms: Permission[]): number {
    return perms.filter((p) => rolePermissionIds.has(p.id)).length;
  }

  let availableUsersToAdd = $derived(allUsers.filter((u) => !roleUsers.some((ru) => ru.id === u.id)));

  onMount(async () => {
    await Promise.all([fetchRoles(), fetchAllPermissions()]);
  });
</script>

<div class="kener-manage flex flex-1 flex-col gap-4 p-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <ShieldIcon class="h-5 w-5" />
      <h2 class="text-xl font-semibold">角色</h2>
    </div>
    {#if hasPermission("roles.write")}
      <Button size="sm" onclick={() => openCreateDialog()}>
        <PlusIcon class="mr-1 h-4 w-4" />
        创建角色
      </Button>
    {/if}
  </div>

  <!-- Roles Table -->
  <div class="">
    {#if loading}
      <div class="flex items-center justify-center p-8">
        <Spinner class="h-6 w-6" />
      </div>
    {:else if roles.length === 0}
      <div class="text-muted-foreground p-8 text-center text-sm">暂无角色</div>
    {:else}
      <div class="ktable overflow-hidden rounded-xl border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>角色 ID</Table.Head>
              <Table.Head>名称</Table.Head>
              <Table.Head>状态</Table.Head>
              <Table.Head>类型</Table.Head>
              <Table.Head class="text-right"></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each roles as role (role.id)}
              <Table.Row>
                <Table.Cell class="font-mono text-sm">{role.id}</Table.Cell>
                <Table.Cell>{getRoleDisplayName(role)}</Table.Cell>
                <Table.Cell>
                  <Badge variant={role.status === "ACTIVE" ? "default" : "secondary"}>
                    {role.status === "ACTIVE" ? "已启用" : "已停用"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {#if role.readonly === 1}
                    <Badge variant="outline">
                      <LockIcon class="mr-1 h-3 w-3" />
                      只读
                    </Badge>
                  {:else}
                    <Badge variant="outline">自定义</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onclick={() => openPermissions(role)}>
                      <KeyIcon class="mr-1 h-4 w-4" />
                      权限
                    </Button>
                    <Button variant="ghost" size="sm" onclick={() => openUsers(role)}>
                      <UsersIcon class="mr-1 h-4 w-4" />
                      用户
                    </Button>
                    {#if hasPermission("roles.write")}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="复制"
                        onclick={() =>
                          openCreateDialog({
                            role_id: role.id + "-copy",
                            name: role.role_name + " 副本",
                            cloneFromRoleId: role.id
                          })}
                      >
                        <CopyIcon class="h-4 w-4" />
                      </Button>
                    {/if}
                    {#if role.readonly !== 1 && hasPermission("roles.write")}
                      <Button variant="ghost" size="sm" onclick={() => openEditDialog(role)}>
                        <PencilIcon class="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => {
                          roleToDelete = role;
                          deleteAction = "remove";
                          deleteTargetRoleId = "";
                          showDeleteDialog = true;
                        }}
                      >
                        <TrashIcon class="text-destructive h-4 w-4" />
                      </Button>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}
  </div>
</div>

<!-- Edit Role Dialog -->
<Dialog.Root bind:open={showEditDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>编辑角色</Dialog.Title>
      <Dialog.Description>
        更新角色 <span class="font-semibold">{getRoleDisplayName(roleToEdit)}</span>。
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="grid gap-2">
        <Label for="edit-role-name">角色名称</Label>
        <Input id="edit-role-name" bind:value={editRole.name} />
      </div>
      <div class="grid gap-2">
        <Label for="edit-role-status">状态</Label>
        <select
          id="edit-role-status"
          class="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
          bind:value={editRole.status}
        >
          <option value="ACTIVE">已启用</option>
          <option value="INACTIVE">已停用</option>
        </select>
      </div>
      {#if editError}
        <p class="text-destructive text-sm">{editError}</p>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showEditDialog = false)}>取消</Button>
      <Button onclick={handleEditRole} disabled={editingRole}>
        {#if editingRole}
          <Spinner class="mr-2 h-4 w-4" />
        {/if}
        保存
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Create Role Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>创建角色</Dialog.Title>
      <Dialog.Description>创建拥有独立权限的自定义角色。</Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="grid gap-2">
        <Label for="role-id">角色 ID</Label>
        <Input id="role-id" placeholder="例如 viewer" bind:value={newRole.role_id} />
        <p class="text-muted-foreground text-xs">仅允许小写字母、数字、下划线和连字符。</p>
      </div>
      <div class="grid gap-2">
        <Label for="role-name">角色名称</Label>
        <Input id="role-name" placeholder="例如 访客" bind:value={newRole.name} />
      </div>
      <div class="grid gap-2">
        <Label>权限</Label>
        <div class="flex gap-2">
          <Button
            variant={createPermissionMode === "pick" ? "default" : "outline"}
            size="sm"
            onclick={() => {
              createPermissionMode = "pick";
              cloneFromRoleId = "";
            }}
          >
            创建后选择
          </Button>
          <Button
            variant={createPermissionMode === "clone" ? "default" : "outline"}
            size="sm"
            onclick={() => (createPermissionMode = "clone")}
          >
            从现有角色复制
          </Button>
        </div>
      </div>
      {#if createPermissionMode === "clone"}
        <div class="grid gap-2">
          <Label for="clone-role">复制权限来源</Label>
          <select
            id="clone-role"
            class="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            bind:value={cloneFromRoleId}
          >
            <option value="">选择角色...</option>
            {#each roles.filter((r) => r.status === "ACTIVE") as r (r.id)}
              <option value={r.id}>{getRoleDisplayName(r)}</option>
            {/each}
          </select>
        </div>
      {/if}
      {#if createError}
        <p class="text-destructive text-sm">{createError}</p>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showCreateDialog = false)}>取消</Button>
      <Button onclick={handleCreateRole} disabled={creatingRole}>
        {#if creatingRole}
          <Spinner class="mr-2 h-4 w-4" />
        {/if}
        创建
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Role Dialog -->
<Dialog.Root bind:open={showDeleteDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>删除角色</Dialog.Title>
      <Dialog.Description>
        确定要删除角色 <span class="font-semibold">{getRoleDisplayName(roleToDelete)}</span> 吗？
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="grid gap-2">
        <Label>如何处理此角色中的用户？</Label>
        <div class="flex gap-2">
          <Button
            variant={deleteAction === "remove" ? "default" : "outline"}
            size="sm"
            onclick={() => (deleteAction = "remove")}
          >
            移除角色分配
          </Button>
          <Button
            variant={deleteAction === "migrate" ? "default" : "outline"}
            size="sm"
            onclick={() => (deleteAction = "migrate")}
          >
            迁移到其他角色
          </Button>
        </div>
      </div>
      {#if deleteAction === "migrate"}
        <div class="grid gap-2">
          <Label for="target-role">目标角色</Label>
          <select
            id="target-role"
            class="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            bind:value={deleteTargetRoleId}
          >
            <option value="">选择角色...</option>
            {#each roles.filter((r) => r.id !== roleToDelete?.id && r.status === "ACTIVE") as r (r.id)}
              <option value={r.id}>{getRoleDisplayName(r)}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showDeleteDialog = false)}>取消</Button>
      <Button
        variant="destructive"
        onclick={handleDeleteRole}
        disabled={deletingRole || (deleteAction === "migrate" && !deleteTargetRoleId)}
      >
        {#if deletingRole}
          <Spinner class="mr-2 h-4 w-4" />
        {/if}
        删除
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Permissions Sheet -->
<Sheet.Root bind:open={showPermissionsSheet}>
  <Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-lg">
    <Sheet.Header>
      <Sheet.Title>
        权限 - {getRoleDisplayName(permissionsRole)}
      </Sheet.Title>
      <Sheet.Description>
        {#if permissionsRole?.readonly === 1}
          这是只读角色，无法修改权限。
        {:else}
          为此角色选择权限。
        {/if}
      </Sheet.Description>
    </Sheet.Header>
    <div class=" p-4">
      {#if loadingPermissions}
        <div class="flex items-center justify-center p-8">
          <Spinner class="h-6 w-6" />
        </div>
      {:else}
        <div class="rounded-xl border">
          <Accordion.Root type="multiple">
            {#each groupedPermissions as group (group.group)}
              {@const granted = groupGrantedCount(group.permissions)}
              <Accordion.Item value={group.group}>
                <Accordion.Trigger class="px-4">
                  <div>
                    <span class="capitalize">{group.label}</span>
                    <Badge
                      variant={granted === group.permissions.length ? "default" : granted > 0 ? "secondary" : "outline"}
                      class="ml-2"
                    >
                      {granted}/{group.permissions.length}
                    </Badge>
                  </div>
                </Accordion.Trigger>
                <Accordion.Content class="px-4">
                  <div class="flex flex-col gap-2 pt-0">
                    {#each group.permissions as perm (perm.id)}
                      <Button
                        variant={rolePermissionIds.has(perm.id) ? "outline" : "ghost"}
                        class="h-auto justify-start gap-3 p-3 text-left {rolePermissionIds.has(perm.id)
                          ? 'border-primary bg-primary/5'
                          : ''}"
                        disabled={permissionsRole?.readonly === 1 || !hasPermission("roles.assign_permissions")}
                        onclick={() => togglePermission(perm.id)}
                      >
                        <Checkbox.Root
                          checked={rolePermissionIds.has(perm.id)}
                          disabled={permissionsRole?.readonly === 1 || !hasPermission("roles.assign_permissions")}
                        />
                        <div class="flex flex-col">
                          <span class="text-sm font-medium">{permissionLabels[perm.id] ?? perm.permission_name}</span>
                        </div>
                      </Button>
                    {/each}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            {/each}
          </Accordion.Root>
        </div>

        {#if permissionsRole?.readonly !== 1 && hasPermission("roles.assign_permissions")}
          <div class="flex justify-end gap-2 p-4">
            <Button variant="outline" onclick={() => (showPermissionsSheet = false)}>取消</Button>
            <Button onclick={savePermissions} disabled={savingPermissions}>
              {#if savingPermissions}
                <Spinner class="mr-2 h-4 w-4" />
              {/if}
              保存权限
            </Button>
          </div>
        {/if}
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>

<!-- Users Sheet -->
<Sheet.Root bind:open={showUsersSheet}>
  <Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-lg">
    <Sheet.Header>
      <Sheet.Title>
        用户 - {getRoleDisplayName(usersRole)}
      </Sheet.Title>
      <Sheet.Description>管理分配到此角色的用户。</Sheet.Description>
    </Sheet.Header>

    {#if loadingUsers}
      <div class="flex items-center justify-center p-8">
        <Spinner class="h-6 w-6" />
      </div>
    {:else}
      <!-- Current users in role -->
      <div class="p-4">
        <h4 class="mb-2 text-sm font-medium">当前用户（{roleUsers.length}）</h4>
        {#if roleUsers.length === 0}
          <p class="text-muted-foreground text-sm">此角色尚未分配用户。</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each roleUsers as user (user.id)}
              <div class="flex items-center justify-between rounded-md border p-3">
                <div class="flex flex-col">
                  <span class="text-sm font-medium">{user.name}</span>
                  <span class="text-muted-foreground text-xs">{user.email}</span>
                </div>
                {#if hasPermission("roles.assign_users")}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removingUserId === user.id}
                    onclick={() => removeUser(user.id)}
                  >
                    {#if removingUserId === user.id}
                      <Spinner class="h-4 w-4" />
                    {:else}
                      <UserMinusIcon class="text-destructive h-4 w-4" />
                    {/if}
                  </Button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if hasPermission("roles.assign_users")}
        <Separator />

        <!-- Add users -->
        <div class="p-4">
          <h4 class="mb-2 text-sm font-medium">添加用户</h4>
          {#if availableUsersToAdd.length === 0}
            <p class="text-muted-foreground text-sm">所有用户都已属于此角色。</p>
          {:else}
            <div class="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {#each availableUsersToAdd as user (user.id)}
                <div class="flex items-center justify-between rounded-md border p-3">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{user.name}</span>
                    <span class="text-muted-foreground text-xs">{user.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={addingUserId === user.id}
                    onclick={() => addUser(user.id)}
                  >
                    {#if addingUserId === user.id}
                      <Spinner class="h-4 w-4" />
                    {:else}
                      <UserPlusIcon class="h-4 w-4" />
                    {/if}
                  </Button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </Sheet.Content>
</Sheet.Root>
