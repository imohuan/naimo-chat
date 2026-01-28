import { createRouter, createWebHashHistory } from 'vue-router';
import ChatPage from '@/modules/chat/pages/ChatPage.vue';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatPage
    }
  ]
});

export default router;
