<template>
  <LoginPage v-if="!authenticated" @login-success="onLoginSuccess" />
  <CrisisDashboard v-else />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import CrisisDashboard from './components/CrisisDashboard.vue'
import LoginPage from './components/LoginPage.vue'
import { isAuthenticated } from './services/api'

const authenticated = ref(isAuthenticated())

function onLoginSuccess() {
  authenticated.value = true
}

function onLogout() {
  authenticated.value = false
}

onMounted(() => {
  window.addEventListener('emergency-logout', onLogout)
})

onUnmounted(() => {
  window.removeEventListener('emergency-logout', onLogout)
})
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
