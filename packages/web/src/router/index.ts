import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/icons",
  },
  {
    path: "/icons",
    name: "Icons",
    component: () => import("@/modules/icons/pages/IconsPage.vue"),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
