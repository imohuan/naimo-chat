import { createRouter, createWebHistory } from 'vue-router';
import ChatPage from '@/modules/chat/pages/ChatPage.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatPage
    }
  ]
});

export default router;
