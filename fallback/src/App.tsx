import { deriveLegacyRoom, deriveRoom, generateSharedSecret } from "./chat-crypto";
import { ChatShell, type ChatShellProps } from "../../shared/chat-shell";

const openPrivateRoom: ChatShellProps["openPrivateRoom"] = async (secret, senderId, handlers) => {
  const [derived, legacy, { openRoom }] = await Promise.all([
    deriveRoom(secret),
    deriveLegacyRoom(secret),
    import("./mqtt-room"),
  ]);
  return openRoom({
    room: derived.room,
    key: derived.key,
    legacy,
    senderId,
    onStatus: handlers.onStatus,
    onMessage: handlers.onMessage,
  });
};

export default function App() {
  return <ChatShell createSharedSecret={generateSharedSecret} openPrivateRoom={openPrivateRoom} />;
}
