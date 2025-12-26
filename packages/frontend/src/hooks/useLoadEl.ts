import { onMounted, ref } from "vue";

export function useLoadEl(idOrClass: string) {
  const load = ref(false)
  onMounted(() => {
    const interval = setInterval(() => {
      const el = document.querySelector(idOrClass)
      if (el) {
        load.value = true
        clearInterval(interval)
      }
    }, 100)
  });
  return load;
}