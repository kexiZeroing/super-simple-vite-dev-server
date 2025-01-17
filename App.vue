<template>
  <div>
    <span class="bold">Hello</span>
    <span class="red">Vite and Vue</span>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'App',

  setup() {
    const text = ref('vite')
    return { text }
  }
}
</script>

<style>
.bold {
  font-weight: bold;
}
</style>