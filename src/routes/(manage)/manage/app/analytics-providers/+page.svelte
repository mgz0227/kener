<script lang="ts">
  import ProviderSettingsPanel from "$lib/components/manage/ProviderSettingsPanel.svelte";
  import type { ProviderDefinition } from "$lib/client/types/provider-settings.js";

  const analyticsProviders: ProviderDefinition[] = [
    {
      label: "Google Analytics",
      logo: "/ga.png",
      key: "analytics.googleTagManager",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        { label: "Measurement ID", type: "text", placeholder: "G-S05E5E5E5E5", required: true, value: "" },
        {
          label: "Transport URL",
          type: "text",
          placeholder: "https://www.google-analytics.com",
          required: false,
          value: ""
        },
        {
          label: "Script Host",
          type: "text",
          placeholder: "https://www.googletagmanager.com",
          required: false,
          value: ""
        }
      ]
    },
    {
      label: "Plausible",
      logo: "/plausible.png",
      key: "analytics.plausible",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        { label: "Domain", type: "text", placeholder: "kener.ing", required: true, value: "" },
        {
          label: "API",
          type: "text",
          placeholder: "https://plausible.io/api/event",
          required: true,
          value: "https://plausible.io/api/event"
        },
        {
          label: "Script Source",
          type: "text",
          placeholder: "https://plausible.io/js/script.pageview-props.tagged-events.js",
          required: true,
          value: "https://plausible.io/js/script.pageview-props.tagged-events.js"
        }
      ]
    },
    {
      label: "MixPanel",
      logo: "/mx.png",
      key: "analytics.mixpanel",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        { label: "Project Token", type: "text", placeholder: "你的项目令牌", required: true, value: "" },
        { label: "API Host", type: "text", placeholder: "https://api.mixpanel.com", required: false, value: "" }
      ]
    },
    {
      label: "Amplitude",
      logo: "/amplitude.png",
      key: "analytics.amplitude",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        {
          label: "Amplitude API Key",
          type: "text",
          placeholder: "Amplitude 项目的 API 密钥",
          required: true,
          value: ""
        },
        {
          label: "Server URL",
          type: "text",
          placeholder: "https://api2.amplitude.com/2/httpapi",
          required: false,
          value: ""
        }
      ]
    },
    {
      label: "Microsoft Clarity",
      logo: "/clarity.png",
      key: "analytics.clarity",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        {
          label: "Project ID",
          type: "text",
          placeholder: "Microsoft Clarity 项目 ID",
          required: true,
          value: ""
        }
      ]
    },
    {
      label: "Umami",
      logo: "/umami.png",
      key: "analytics.umami",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        {
          label: "Website ID",
          type: "text",
          placeholder: "Umami 脚本和域名对应的网站 ID",
          required: true,
          value: ""
        },
        {
          label: "Script URL",
          type: "text",
          placeholder: "https://cloud.umami.is/script.js",
          required: true,
          value: "https://cloud.umami.is/script.js"
        }
      ]
    },
    {
      label: "PostHog",
      logo: "/posthog.png",
      key: "analytics.posthog",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        { label: "API Key", type: "text", placeholder: "phc_xxxxxxxxxxxxxxxxxxxx", required: true, value: "" },
        {
          label: "API Host",
          type: "text",
          placeholder: "https://us.i.posthog.com",
          required: true,
          value: "https://us.i.posthog.com"
        }
      ]
    },
    {
      label: "OpenPanel",
      logo: "/openpanel.png",
      key: "analytics.openpanel",
      isEnabled: false,
      activeInSite: false,
      requirements: [
        {
          label: "Client ID",
          type: "text",
          placeholder: "OpenPanel 项目的客户端 ID",
          required: true,
          value: ""
        },
        {
          label: "API URL",
          type: "text",
          placeholder: "https://api.openpanel.dev",
          required: true,
          value: "https://api.openpanel.dev"
        },
        {
          label: "Script URL",
          type: "text",
          placeholder: "https://openpanel.dev/op1.js",
          required: true,
          value: "https://openpanel.dev/op1.js"
        }
      ]
    }
  ];
</script>

<ProviderSettingsPanel
  initialProviders={analyticsProviders}
  description="在此添加统计服务的 ID 或密钥，可以同时启用多个统计服务。"
  learnMoreUrl="https://kener.ing/docs/v4/analytics"
/>
