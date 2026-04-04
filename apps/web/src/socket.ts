import { io } from "socket.io-client";

// Single shared socket instance — connects to the same origin so Vite proxy
// forwards /socket.io traffic to the API on port 4000.
export const socket = io({ autoConnect: false });
