<script lang="ts">
  import "../layout.css";
  import "../kener.css";
  import "../manage.css";
  import { ModeWatcher } from "mode-watcher";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import BlendIcon from "@lucide/svelte/icons/blend";
  import MailboxIcon from "@lucide/svelte/icons/mailbox";
  import AppSidebar from "./manage/app-sidebar.svelte";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import GlobeIcon from "@lucide/svelte/icons/globe";
  import SirenIcon from "@lucide/svelte/icons/siren";
  import BellIcon from "@lucide/svelte/icons/bell";
  import CodeIcon from "@lucide/svelte/icons/code";
  import ChartSplineIcon from "@lucide/svelte/icons/chart-spline";
  import CloudAlertIcon from "@lucide/svelte/icons/cloud-alert";
  import House from "@lucide/svelte/icons/house";
  import BadgeIcon from "@lucide/svelte/icons/id-card";
  import ClockAlertIcon from "@lucide/svelte/icons/clock-alert";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import KeyIcon from "@lucide/svelte/icons/key";
  import UsersIcon from "@lucide/svelte/icons/users";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import Columns3CogIcon from "@lucide/svelte/icons/columns-3-cog";
  import SiteHeader from "./manage/site-header.svelte";
  import TemplateIcon from "@lucide/svelte/icons/layout-template";
  import clientResolver from "$lib/client/resolver.js";
  import DatabaseIcon from "@lucide/svelte/icons/database";

  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { ROUTE_PERMISSION_MAP } from "$lib/allPerms.js";

  let { children, data } = $props();

  // Navigation items - single source of truth
  const allNavItems = [
    { title: "站点配置", url: "/manage/app/site-configurations", icon: Settings2Icon },
    { title: "多语言设置", url: "/manage/app/internationalization", icon: GlobeIcon },
    { title: "外观定制", url: "/manage/app/customizations", icon: Columns3CogIcon },
    { title: "统计服务", url: "/manage/app/analytics-providers", icon: ChartSplineIcon },
    { title: "页面", url: "/manage/app/pages", icon: BookOpenIcon },
    { title: "监控项", url: "/manage/app/monitors", icon: BlendIcon },
    { title: "监控数据", url: "/manage/app/monitoring-data", icon: DatabaseIcon },
    { title: "故障事件", url: "/manage/app/incidents", icon: CloudAlertIcon },
    { title: "维护计划", url: "/manage/app/maintenances", icon: ClockAlertIcon },
    { title: "告警", url: "/manage/app/alerts", icon: SirenIcon },
    { title: "订阅", url: "/manage/app/subscriptions", icon: BellIcon },
    { title: "用户", url: "/manage/app/users", icon: UsersIcon },
    { title: "角色", url: "/manage/app/roles", icon: ShieldIcon },
    { title: "触发器", url: "/manage/app/triggers", icon: MailboxIcon },
    { title: "通知模板", url: "/manage/app/templates", icon: TemplateIcon },
    { title: "状态徽章", url: "/manage/app/badges", icon: BadgeIcon },
    { title: "嵌入代码", url: "/manage/app/embed", icon: CodeIcon },
    { title: "API 密钥", url: "/manage/app/api-keys", icon: KeyIcon }
  ];

  const navItems = allNavItems
    .filter((item) => {
      const routeId = `/(manage)${item.url}`;
      const requiredPermission = ROUTE_PERMISSION_MAP[routeId];
      if (requiredPermission === undefined) return false;
      if (requiredPermission === null) return true;
      return (data.userPermissions ?? []).includes(requiredPermission);
    })
    .map((item) => ({ ...item, url: clientResolver(resolve, item.url) }));

  // Derive page title from current URL
  let pageTitle = $derived(navItems.find((item) => page.url.pathname.startsWith(item.url))?.title || "管理后台");
</script>

<ModeWatcher defaultMode={data.defaultSiteTheme as "light" | "dark" | "system"} />
<Toaster />

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
  <title>{pageTitle} | Kener</title>
  <link rel="icon" href={clientResolver(resolve, "/logo96.png")} />
  {#if data.font?.cssSrc}
    <link rel="stylesheet" href={data.font.cssSrc} />
  {/if}
  {@html `
	<style>
		.kener-manage {
			--up: ${data.siteStatusColors.UP};
			--degraded: ${data.siteStatusColors.DEGRADED};
			--down: ${data.siteStatusColors.DOWN};
			--maintenance: ${data.siteStatusColors.MAINTENANCE};
			--accent: ${data.siteStatusColors.ACCENT || "#f4f4f5"};
			--accent-foreground: ${data.siteStatusColors.ACCENT_FOREGROUND || data.siteStatusColors.ACCENT || "#e96e2d"};
			${data.font?.family ? `--font-family:'${data.font.family}', sans-serif;` : ""}
		}
		:is(.dark) .kener-manage {
			--up: ${data.siteStatusColorsDark.UP};
			--degraded: ${data.siteStatusColorsDark.DEGRADED};
			--down: ${data.siteStatusColorsDark.DOWN};
			--maintenance: ${data.siteStatusColorsDark.MAINTENANCE};
			--accent: ${data.siteStatusColorsDark.ACCENT || "#27272a"};
			--accent-foreground: ${data.siteStatusColorsDark.ACCENT_FOREGROUND || data.siteStatusColorsDark.ACCENT || "#e96e2d"};
		}
	</style>`}
</svelte:head>
<main class="kener-manage">
  <Sidebar.Provider style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);">
    <AppSidebar variant="inset" {navItems} />
    <Sidebar.Inset>
      <SiteHeader title={pageTitle} />
      <div class="p-4">
        <div class="@container/main flex flex-1">
          <Tooltip.Provider>
            {@render children()}
          </Tooltip.Provider>
        </div>
      </div>
    </Sidebar.Inset>
  </Sidebar.Provider>
</main>

<style>
  /* Apply the global font family using the CSS variable */
  * {
    font-family: var(--font-family);
  }
</style>
