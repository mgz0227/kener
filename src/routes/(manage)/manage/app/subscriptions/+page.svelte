<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { toast } from "svelte-sonner";
  import LocalTime from "$lib/components/LocalTime.svelte";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { page as pageData } from "$app/state";
  import Bell from "@lucide/svelte/icons/bell";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import Wrench from "@lucide/svelte/icons/wrench";
  import Mail from "@lucide/svelte/icons/mail";
  import Rss from "@lucide/svelte/icons/rss";

  import type { SubscriptionsConfig } from "$lib/server/types/db.js";
  import AlertCircleIcon from "@lucide/svelte/icons/octagon-alert";

  // Config state
  let config = $state<SubscriptionsConfig>({
    enable: false,
    methods: {
      emails: {
        incidents: true,
        maintenances: true
      }
    }
  });
  let loadingConfig = $state(true);
  let savingConfig = $state(false);

  // RSS feed visibility — same site_data key as Site Configurations →
  // Sub Menu Options. Loaded/saved separately because it's independent of
  // the email-subscription toggles below.
  let subMenuOptions = $state<{
    showShareBadgeMonitor: boolean;
    showShareEmbedMonitor: boolean;
    showRssFeed: boolean;
  }>({
    showShareBadgeMonitor: true,
    showShareEmbedMonitor: true,
    showRssFeed: true
  });
  let savingRssToggle = $state(false);

  async function fetchSubMenuOptions() {
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getSiteDataByKey", data: { key: "subMenuOptions" } })
      });
      const data = await res.json();
      if (data && !data.error) {
        subMenuOptions = {
          showShareBadgeMonitor: data.showShareBadgeMonitor ?? true,
          showShareEmbedMonitor: data.showShareEmbedMonitor ?? true,
          showRssFeed: data.showRssFeed ?? true
        };
      }
    } catch {
      // Defaults already in state; silently fall through.
    }
  }

  async function toggleRssFeed(value: boolean) {
    const previous = subMenuOptions.showRssFeed;
    subMenuOptions.showRssFeed = value;
    savingRssToggle = true;
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { subMenuOptions: JSON.stringify(subMenuOptions) }
        })
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      toast.success("RSS 订阅源设置已保存");
    } catch {
      subMenuOptions.showRssFeed = previous;
      toast.error("保存 RSS 订阅源设置失败");
    } finally {
      savingRssToggle = false;
    }
  }

  // Subscribers state
  interface Subscriber {
    user_id: number;
    method_id: number;
    email: string;
    incidents_enabled: boolean;
    maintenances_enabled: boolean;
    incidents_subscription_id: number | null;
    maintenances_subscription_id: number | null;
    created_at: string;
  }

  let subscribers = $state<Subscriber[]>([]);
  let loadingSubscribers = $state(true);
  let page = $state(1);
  let limit = $state(10);
  let total = $state(0);
  let totalPages = $state(0);

  // Add subscriber dialog
  let showAddDialog = $state(false);
  let addingSubscriber = $state(false);
  let newEmail = $state("");
  let newIncidents = $state(true);
  let newMaintenances = $state(true);
  let addError = $state("");

  // Delete confirmation
  let showDeleteDialog = $state(false);
  let deletingSubscriber = $state<Subscriber | null>(null);
  let isDeleting = $state(false);

  // Updating toggles
  let updatingToggle = $state<Record<string, boolean>>({});

  // Fetch config
  async function fetchConfig() {
    loadingConfig = true;
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getSubscriptionsConfig" })
      });
      config = await res.json();
    } catch (error) {
      toast.error("加载配置失败");
    } finally {
      loadingConfig = false;
    }
  }

  // Save config
  async function saveConfig() {
    savingConfig = true;
    try {
      await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSubscriptionsConfig",
          data: config
        })
      });
      toast.success("配置已保存");
    } catch (error) {
      toast.error("保存配置失败");
    } finally {
      savingConfig = false;
    }
  }

  // Fetch subscribers
  async function fetchSubscribers() {
    loadingSubscribers = true;
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getAdminSubscribers",
          data: { page, limit }
        })
      });
      const result = await res.json();
      if (!result.error) {
        subscribers = result.subscribers || [];
        total = result.total || 0;
        totalPages = result.totalPages || 0;
      }
    } catch (error) {
      toast.error("加载订阅者失败");
    } finally {
      loadingSubscribers = false;
    }
  }

  // Toggle subscription status
  async function toggleSubscription(subscriber: Subscriber, eventType: "incidents" | "maintenances", enabled: boolean) {
    const key = `${subscriber.method_id}-${eventType}`;
    updatingToggle[key] = true;

    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminUpdateSubscriptionStatus",
          data: {
            methodId: subscriber.method_id,
            eventType,
            enabled
          }
        })
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        // Revert toggle
        if (eventType === "incidents") {
          subscriber.incidents_enabled = !enabled;
        } else {
          subscriber.maintenances_enabled = !enabled;
        }
      } else {
        // Update local state
        if (eventType === "incidents") {
          subscriber.incidents_enabled = enabled;
        } else {
          subscriber.maintenances_enabled = enabled;
        }
      }
    } catch (error) {
      toast.error("更新订阅失败");
      // Revert
      if (eventType === "incidents") {
        subscriber.incidents_enabled = !enabled;
      } else {
        subscriber.maintenances_enabled = !enabled;
      }
    } finally {
      updatingToggle[key] = false;
    }
  }

  // Add subscriber
  async function addSubscriber() {
    if (!newEmail.trim()) {
      addError = "电子邮箱为必填项";
      return;
    }

    addingSubscriber = true;
    addError = "";

    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminAddSubscriber",
          data: {
            email: newEmail.trim(),
            incidents: newIncidents,
            maintenances: newMaintenances
          }
        })
      });
      const result = await res.json();
      if (result.error) {
        addError = result.error;
      } else {
        showAddDialog = false;
        resetAddForm();
        toast.success("订阅者添加成功");
        await fetchSubscribers();
      }
    } catch (error) {
      addError = "添加订阅者失败";
    } finally {
      addingSubscriber = false;
    }
  }

  function resetAddForm() {
    newEmail = "";
    newIncidents = true;
    newMaintenances = true;
    addError = "";
  }

  // Delete subscriber
  async function deleteSubscriber() {
    if (!deletingSubscriber) return;

    isDeleting = true;
    try {
      const res = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminDeleteSubscriber",
          data: { methodId: deletingSubscriber.method_id }
        })
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        showDeleteDialog = false;
        deletingSubscriber = null;
        toast.success("订阅者已删除");
        await fetchSubscribers();
      }
    } catch (error) {
      toast.error("删除订阅者失败");
    } finally {
      isDeleting = false;
    }
  }

  function confirmDelete(subscriber: Subscriber) {
    deletingSubscriber = subscriber;
    showDeleteDialog = true;
  }

  function goToPage(newPage: number) {
    page = newPage;
    fetchSubscribers();
  }

  function handleConfigChange() {
    saveConfig();
  }

  onMount(() => {
    fetchConfig();
    fetchSubMenuOptions();
    fetchSubscribers();
  });
</script>

<div class="container mx-auto space-y-6 py-6">
  <!-- Settings Card -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <Bell class="h-5 w-5" />
        订阅设置
      </Card.Title>
      <Card.Description>配置状态页的订阅选项</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if pageData.data.canSendEmail === false}
        <Alert.Root variant="destructive">
          <AlertCircleIcon />
          <Alert.Title>电子邮件尚未配置</Alert.Title>
          <Alert.Description>
            <p>
              请查看电子邮件设置文档，点击<a
                class="underline"
                href={clientResolver(resolve, "https://kener.ing/docs/v4/setup/email-setup")}>这里</a
              >。
            </p>
          </Alert.Description>
        </Alert.Root>
      {/if}
      {#if loadingConfig}
        <div class="flex justify-center py-10">
          <Spinner />
        </div>
      {:else}
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <Label for="enable-subscriptions" class="mb-0">启用订阅</Label>
            <Switch
              id="enable-subscriptions"
              checked={config.enable}
              onCheckedChange={(e) => {
                config.enable = e;
                config.methods.emails.incidents = e;
                config.methods.emails.maintenances = e;
                handleConfigChange();
              }}
            />
          </div>

          {#if config.enable}
            <div class="space-y-4 border-l-2 pl-4">
              <p class="flex items-center gap-2 text-sm font-semibold">
                <Mail class="h-4 w-4" />
                电子邮件通知
              </p>
              <div class="space-y-4 pl-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <AlertTriangle class="h-4 w-4 text-orange-500" />
                    <Label for="enable-email-incidents" class="mb-0">事件更新</Label>
                  </div>
                  <Switch
                    id="enable-email-incidents"
                    checked={config.methods.emails.incidents}
                    onCheckedChange={(e) => {
                      config.methods.emails.incidents = e;
                      handleConfigChange();
                    }}
                  />
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Wrench class="h-4 w-4 text-blue-500" />
                    <Label for="enable-email-maintenances" class="mb-0">维护更新</Label>
                  </div>
                  <Switch
                    id="enable-email-maintenances"
                    checked={config.methods.emails.maintenances}
                    onCheckedChange={(e) => {
                      config.methods.emails.maintenances = e;
                      handleConfigChange();
                    }}
                  />
                </div>
              </div>
            </div>
          {/if}

          <!-- RSS feed visibility — independent of the email enable flag.
               Mirrors the same site_data key used in Site Configurations →
               Sub Menu Options, so toggling here updates both places. -->
          <div class="space-y-4 border-l-2 pl-4">
            <p class="flex items-center gap-2 text-sm font-semibold">
              <Rss class="h-4 w-4" />
              RSS 订阅源
            </p>
            <div class="space-y-4 pl-4">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <Label for="enable-rss-feed" class="mb-0">显示 RSS 订阅源链接</Label>
                  <p class="text-muted-foreground text-xs">
                    在公开页面页眉中添加 RSS 图标。无论是否启用，订阅源路由 (<code class="text-xs">/rss.xml</code>)
                    均可访问。
                  </p>
                </div>
                <Switch
                  id="enable-rss-feed"
                  checked={subMenuOptions.showRssFeed}
                  disabled={savingRssToggle}
                  onCheckedChange={toggleRssFeed}
                />
              </div>
            </div>
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Subscribers Card -->
  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <div>
          <Card.Title>订阅者</Card.Title>
          <Card.Description>管理接收通知的电子邮件订阅者</Card.Description>
        </div>
        <div class="flex items-center gap-2">
          {#if loadingSubscribers}
            <Spinner class="size-5" />
          {/if}
          <Button onclick={() => (showAddDialog = true)}>
            <PlusIcon class="h-4 w-4" />
            添加订阅者
          </Button>
        </div>
      </div>
    </Card.Header>
    <Card.Content>
      <div class="ktable rounded-xl border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>电子邮箱</Table.Head>
              <Table.Head class="text-center">
                <div class="flex items-center justify-center gap-1">
                  <AlertTriangle class="h-4 w-4 text-orange-500" />
                  事件
                </div>
              </Table.Head>
              <Table.Head class="text-center">
                <div class="flex items-center justify-center gap-1">
                  <Wrench class="h-4 w-4 text-blue-500" />
                  维护
                </div>
              </Table.Head>
              <Table.Head>订阅时间</Table.Head>
              <Table.Head class="w-20 text-center">操作</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#if loadingSubscribers && subscribers.length === 0}
              <Table.Row>
                <Table.Cell colspan={5} class="py-8 text-center">
                  <div class="flex items-center justify-center gap-2">
                    <Spinner class="size-4" />
                    <span class="text-muted-foreground text-sm">正在加载订阅者...</span>
                  </div>
                </Table.Cell>
              </Table.Row>
            {:else if subscribers.length === 0}
              <Table.Row>
                <Table.Cell colspan={5} class="text-muted-foreground py-8 text-center">
                  暂无订阅者，请在上方添加第一个订阅者。
                </Table.Cell>
              </Table.Row>
            {:else}
              {#each subscribers as subscriber (subscriber.method_id)}
                <Table.Row>
                  <Table.Cell class="font-medium">{subscriber.email}</Table.Cell>
                  <Table.Cell class="text-center">
                    <Switch
                      checked={subscriber.incidents_enabled}
                      disabled={updatingToggle[`${subscriber.method_id}-incidents`]}
                      onCheckedChange={(e) => toggleSubscription(subscriber, "incidents", e)}
                    />
                  </Table.Cell>
                  <Table.Cell class="text-center">
                    <Switch
                      checked={subscriber.maintenances_enabled}
                      disabled={updatingToggle[`${subscriber.method_id}-maintenances`]}
                      onCheckedChange={(e) => toggleSubscription(subscriber, "maintenances", e)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <LocalTime value={subscriber.created_at} format="yyyy-MM-dd" />
                  </Table.Cell>
                  <Table.Cell class="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="text-destructive hover:bg-destructive/10 h-8 w-8"
                      onclick={() => confirmDelete(subscriber)}
                    >
                      <Trash2Icon class="h-4 w-4" />
                    </Button>
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
        <div class="mt-4 flex items-center justify-between">
          <span class="text-muted-foreground text-sm">显示第 {startItem}-{endItem} 项，共 {total} 项</span>
          {#if totalPages > 1}
            <div class="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled={page === 1} onclick={() => goToPage(page - 1)}>
                <ChevronLeftIcon class="size-4" />
              </Button>
              <div class="flex items-center gap-1">
                {#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNum (pageNum)}
                  {#if pageNum === 1 || pageNum === totalPages || (pageNum >= page - 1 && pageNum <= page + 1)}
                    <Button
                      variant={pageNum === page ? "default" : "ghost"}
                      size="sm"
                      onclick={() => goToPage(pageNum)}
                    >
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
    </Card.Content>
  </Card.Root>
</div>

<!-- Add Subscriber Dialog -->
<Dialog.Root bind:open={showAddDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>添加订阅者</Dialog.Title>
      <Dialog.Description>添加用于接收通知的电子邮件订阅者</Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label for="new-email">电子邮箱地址</Label>
        <Input
          id="new-email"
          type="email"
          placeholder="subscriber@example.com"
          bind:value={newEmail}
          disabled={addingSubscriber}
        />
      </div>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <AlertTriangle class="h-4 w-4 text-orange-500" />
            <Label for="new-incidents" class="mb-0">订阅事件</Label>
          </div>
          <Switch id="new-incidents" bind:checked={newIncidents} disabled={addingSubscriber} />
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Wrench class="h-4 w-4 text-blue-500" />
            <Label for="new-maintenances" class="mb-0">订阅维护</Label>
          </div>
          <Switch id="new-maintenances" bind:checked={newMaintenances} disabled={addingSubscriber} />
        </div>
      </div>
      {#if addError}
        <Alert.Root variant="destructive">
          <Alert.Description>{addError}</Alert.Description>
        </Alert.Root>
      {/if}
    </div>
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => {
          showAddDialog = false;
          resetAddForm();
        }}
        disabled={addingSubscriber}
      >
        取消
      </Button>
      <Button onclick={addSubscriber} disabled={addingSubscriber}>
        {#if addingSubscriber}
          <Spinner class="size-4" />
          添加中...
        {:else}
          添加订阅者
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={showDeleteDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>删除订阅者</Dialog.Title>
      <Dialog.Description>确定要删除此订阅者吗？此操作无法撤销。</Dialog.Description>
    </Dialog.Header>
    {#if deletingSubscriber}
      <div class="py-4">
        <p class="text-sm">
          <span class="text-muted-foreground">电子邮箱：</span>
          <span class="font-medium">{deletingSubscriber.email}</span>
        </p>
      </div>
    {/if}
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => {
          showDeleteDialog = false;
          deletingSubscriber = null;
        }}
        disabled={isDeleting}
      >
        取消
      </Button>
      <Button variant="destructive" onclick={deleteSubscriber} disabled={isDeleting}>
        {#if isDeleting}
          <Spinner class="size-4" />
          删除中...
        {:else}
          删除
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
