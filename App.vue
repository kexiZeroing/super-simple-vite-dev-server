<template>
  <div>
    <span class="bold">Hello</span>
    <span class="red">Vite and Vue</span>
    <br>
    <img src="/vue.svg" alt="Vue logo">
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