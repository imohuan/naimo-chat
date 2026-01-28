import mitt from "mitt";
import type { Events } from "@/types";

export const emitter = mitt<Events>();
