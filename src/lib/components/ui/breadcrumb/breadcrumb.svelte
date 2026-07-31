<script lang="ts">
  import type { WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<nav bind:this={ref} data-slot="breadcrumb" class={className} aria-label="面包屑导航" {...restProps}>
  {@render children?.()}
</nav>
