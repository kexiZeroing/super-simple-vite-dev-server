<template>
  <div class="red">
    Hello {{ text }}
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

<style scoped>

</style>