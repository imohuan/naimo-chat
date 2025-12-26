import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useUserStore = defineStore("user", () => {
  const name = ref<string>("");
  const email = ref<string>("");

  const isLoggedIn = computed(() => !!name.value);

  function setUser(userName: string, userEmail: string) {
    name.value = userName;
    email.value = userEmail;
  }

  function clearUser() {
    name.value = "";
    email.value = "";
  }

  return {
    name,
    email,
    isLoggedIn,
    setUser,
    clearUser,
  };
});
