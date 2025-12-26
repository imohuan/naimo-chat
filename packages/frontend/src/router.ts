import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Dashboard",
    component: () => import("./views/LlmDashboard/LlmDashboard.vue"),
  },
  {
    path: "/demo",
    name: "LlmDashboard",
    component: () => import("./views/Dashboard.vue"),
  },
  {
    path: "/demo",
    name: "Demo",
    component: () => import("./views/demo/index.vue"),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
