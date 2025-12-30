import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Dashboard",
    component: () => import("./views/LlmDashboard/LlmDashboard.vue"),
    redirect: "/chat",
    children: [
      {
        path: "chat",
        name: "Chat",
        component: () => import("./views/LlmDashboard/wrappers/ChatPanelWrapper.vue"),
        meta: {
          cache: false,
        },
      },
      {
        path: "providers",
        name: "Providers",
        component: () => import("./views/LlmDashboard/wrappers/ProvidersPanelWrapper.vue"),
        meta: {
          cache: false,
        },
      },
      {
        path: "logger",
        name: "Logger",
        component: () => import("./views/LlmDashboard/Logger/LoggerPanel.vue"),
        meta: {
          cache: false,
        },
      },
      {
        path: "statusline",
        name: "StatusLine",
        component: () => import("./views/LlmDashboard/StatusLine/StatusLinePanel.vue"),
        meta: {
          cache: false,
        },
      },
      {
        path: "mcp",
        name: "MCP",
        component: () => import("./views/LlmDashboard/MCP/MCPPanel.vue"),
        meta: {
          cache: false,
        },
      },
    ],
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
  {
    path: "/immersive",
    name: "ImmersiveTest",
    component: () => import("./views/ImmersiveTest.vue"),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
