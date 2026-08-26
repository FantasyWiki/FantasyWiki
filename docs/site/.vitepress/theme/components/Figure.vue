<script setup lang="ts">
import { withBase } from "vitepress";

/** An image with a caption, sized and bordered like every other figure. */
defineProps<{ src: string; alt: string; caption?: string }>();
</script>

<template>
  <figure class="fw-figure">
    <img :src="withBase(src)" :alt="alt" loading="lazy" />
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>
