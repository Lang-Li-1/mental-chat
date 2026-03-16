<template>
  <CrisisDashboard />
</template>

<script setup lang="ts">
import CrisisDashboard from './components/CrisisDashboard.vue'
</script>

<style>
/* Global reset and base styles */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background-color: #f3f4f6;
  color: #1f2937;
  line-height: 1.5;
}

#app {
  width: 100%;
}
</style>
