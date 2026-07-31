<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import Plus from "@lucide/svelte/icons/plus";
  import Loader from "@lucide/svelte/icons/loader";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import KeyIcon from "@lucide/svelte/icons/key";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { toast } from "svelte-sonner";
  import { format } from "date-fns";
  import { zhCN } from "date-fns/locale";
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { page } from "$app/state";
  interface ApiKey {
    id: number;
    name: string;
    masked_key: string;
    status: string;
    created_at: string;
  }

  // State
  let apiKeys = $state<ApiKey[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let showCreateDialog = $state(false);
  let newAPIKeyName = $state("");
  let newKeyResp = $state<{ apiKey?: string }>({});
  let copied = $state(false);
  let deleteDialogOpen = $state(false);
  let keyToDelete = $state<ApiKey | null>(null);
  let deleting = $state(false);

  async function loadAPIKeys() {
    loading = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getAPIKeys", data: {} })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        apiKeys = result;
      }
    } catch (e) {
      toast.error("加载 API 密钥失败");
    } finally {
      loading = false;
    }
  }

  async function createNewAPIKey() {
    if (!newAPIKeyName.trim()) {
      toast.error("请输入 API 密钥名称");
      return;
    }

    creating = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createNewApiKey",
          data: { name: newAPIKeyName }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        newKeyResp = result;
        toast.success("API 密钥创建成功");
        loadAPIKeys();
        showCreateDialog = false;
        newAPIKeyName = "";
      }
    } catch (e) {
      toast.error("创建 API 密钥失败");
    } finally {
      creating = false;
    }
  }

  async function updateStatus(apiKey: ApiKey) {
    const newStatus = apiKey.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateApiKeyStatus",
          data: { id: apiKey.id, status: newStatus }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        apiKey.status = newStatus;
        apiKeys = [...apiKeys];
        toast.success(`API 密钥已${newStatus === "ACTIVE" ? "启用" : "停用"}`);
      }
    } catch (e) {
      toast.error("更新 API 密钥状态失败");
    }
  }

  function openDeleteDialog(apiKey: ApiKey) {
    keyToDelete = apiKey;
    deleteDialogOpen = true;
  }

  async function deleteApiKey() {
    if (!keyToDelete) return;

    deleting = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteApiKey",
          data: { id: keyToDelete.id }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("API 密钥已删除");
        await loadAPIKeys();
      }
    } catch (e) {
      toast.error("删除 API 密钥失败");
    } finally {
      deleting = false;
      deleteDialogOpen = false;
      keyToDelete = null;
    }
  }

  function copyKey() {
    if (newKeyResp.apiKey) {
      navigator.clipboard.writeText(newKeyResp.apiKey);
      copied = true;
      toast.success("API 密钥已复制到剪贴板");
      setTimeout(() => {
        copied = false;
      }, 2000);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return format(new Date(dateStr), "yyyy年M月d日 HH:mm", { locale: zhCN });
    } catch {
      return dateStr;
    }
  }

  function dismissNewKey() {
    newKeyResp = {};
  }

  onMount(() => {
    loadAPIKeys();
  });
</script>

<div class="flex w-full flex-col gap-4 p-4">
  <!-- Breadcrumb -->

  <!-- Header with Create Button -->
  <div class="flex items-center justify-end">
    <Button onclick={() => (showCreateDialog = true)}>
      <Plus class="h-4 w-4" />
      新建 API 密钥
    </Button>
  </div>

  <!-- New Key Alert -->
  {#if newKeyResp.apiKey}
    <Card.Root class="border-green-600 bg-green-50 dark:bg-green-950/20">
      <Card.Content class="">
        <div class="flex items-start gap-3">
          <div class="flex-1">
            <p class="font-medium text-green-800 dark:text-green-200">API 密钥创建成功</p>
            <div class="relative mt-2">
              <code class="bg-background block rounded-md border px-4 py-2 pr-12 font-mono text-sm">
                {newKeyResp.apiKey}
              </code>
              <Button
                size="icon"
                variant="ghost"
                class="absolute top-1/2 right-2 h-7 w-7 -translate-y-1/2"
                onclick={copyKey}
              >
                {#if copied}
                  <Check class="h-4 w-4 text-green-500" />
                {:else}
                  <Copy class="h-4 w-4" />
                {/if}
              </Button>
            </div>
            <p class="text-muted-foreground mt-2 text-xs">
              新 API 密钥已创建，之后将<strong class="underline">不再显示</strong>，请立即妥善保存。
            </p>
          </div>
          <Button size="sm" variant="ghost" onclick={dismissNewKey}>关闭</Button>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- API Keys Table -->
  <Card.Root>
    <Card.Content class="p-0">
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <Spinner class="h-6 w-6" />
        </div>
      {:else if apiKeys.length === 0}
        <div class="text-muted-foreground py-12 text-center">
          <KeyIcon class="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>暂无 API 密钥</p>
          <p class="text-sm">创建第一个 API 密钥以开始使用</p>
        </div>
      {:else}
        <Table.Root class="p-4">
          <Table.Header>
            <Table.Row>
              <Table.Head class="pl-4">名称</Table.Head>
              <Table.Head>密钥</Table.Head>
              <Table.Head>创建时间</Table.Head>
              <Table.Head class="pr-4 text-right">状态</Table.Head>
              <Table.Head class="pr-4 text-right">操作</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each apiKeys as apiKey (apiKey.id)}
              <Table.Row>
                <Table.Cell class="pl-4 font-medium">{apiKey.name}</Table.Cell>
                <Table.Cell>
                  <code class="text-muted-foreground text-xs">
                    {apiKey.masked_key.slice(-32)}
                  </code>
                </Table.Cell>
                <Table.Cell class="text-muted-foreground text-sm">
                  {formatDate(apiKey.created_at)}
                </Table.Cell>
                <Table.Cell class="pr-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <span class="text-muted-foreground text-xs">
                      {apiKey.status === "ACTIVE" ? "已启用" : "已停用"}
                    </span>
                    <Switch checked={apiKey.status === "ACTIVE"} onCheckedChange={() => updateStatus(apiKey)} />
                  </div>
                </Table.Cell>
                <Table.Cell class="pr-4 text-right">
                  <Button
                    variant="destructive"
                    disabled={!page.data.userPermissions?.includes("api_keys.delete")}
                    size="sm"
                    onclick={() => openDeleteDialog(apiKey)}
                  >
                    <Trash2 class="h-4 w-4" />
                    删除
                  </Button>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
<Dialog.Root bind:open={showCreateDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>新建 API 密钥</Dialog.Title>
      <Dialog.Description>API 密钥用于验证 API 请求。每个密钥均为账户专用，请妥善保密。</Dialog.Description>
    </Dialog.Header>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        createNewAPIKey();
      }}
    >
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <Label for="newAPIKeyName">名称</Label>
          <Input id="newAPIKeyName" bind:value={newAPIKeyName} placeholder="例如：我的 API 密钥" required />
        </div>
      </div>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (showCreateDialog = false)}>取消</Button>
        <Button type="submit" disabled={creating}>
          {#if creating}
            <Loader class="h-4 w-4 animate-spin" />
          {/if}
          创建
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>删除 API 密钥</AlertDialog.Title>
      <AlertDialog.Description>
        确定要删除 API 密钥“{keyToDelete?.name}”吗？此操作无法撤销。
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={deleting}>取消</AlertDialog.Cancel>
      <AlertDialog.Action onclick={deleteApiKey} disabled={deleting}>
        {#if deleting}
          <Spinner class="h-4 w-4" />
        {/if}
        删除
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
