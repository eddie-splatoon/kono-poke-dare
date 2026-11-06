"use client";

import { GameScreen } from "@/components/game-screen";
import { createBrowserGameSession } from "@/composition/create-game-session";

const session = createBrowserGameSession();

export function GameClient() {
  return <GameScreen session={session} />;
}
