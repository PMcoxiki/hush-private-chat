import { deriveRoom, generateSharedSecret } from "./chat-crypto";
import { ChatShell, type ChatShellProps } from "../../shared/chat-shell";

const openPrivateRoom: ChatShellProps["openPrivateRoom"] = async (secret, senderId, handlers) => {
  const [derived, { openRoom }] = await Promise.all([
    deriveRoom(secret),
    import("./mqtt-room"),
  ]);
  return openRoom({
    room: derived.room,
    key: derived.key,
    senderId,
    onStatus: handlers.onStatus,
    onMessage: handlers.onMessage,
  });
};

export default function App() {
  return <ChatShell createSharedSecret={generateSharedSecret} openPrivateRoom={openPrivateRoom} />;
}
