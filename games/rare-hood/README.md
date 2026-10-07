# Rare Hood

SDK version **v0.1.4**. Your Rare Friend is the hooded hero of a castle heist. Sneak past guards, stay out of their light beams, steal the pouches, and leave through the gate. Clearing a castle banks **simulated HOOD** for the browser session.

The SDK runtime supplies wallet connection, owned Friend selection, and the ownership check. This game does not add another wallet flow. Play requires a hardwired Rare Friends Generations NFT (generation 1 or higher) on Robinhood mainnet (chain 4663).

## Run it

From this FriendSDK checkout, with Node.js 22+:

```sh
npm run dev:game -- games/rare-hood --host 0.0.0.0 --port 4173
```

Open `http://localhost:4173` on this computer. On a phone on the same Wi-Fi, open `http://YOUR_LAN_IP:4173` in a browser that has the wallet. Connect, switch to Robinhood if asked, and select your Friend.

`game.json` is the chance-game file the CLI requires. Rare Hood does not buy, open, or redeem that consumable. Those outcome weights are not the heist. There is no RF payout and no prize reserve.

## Play

| Control | Action |
| --- | --- |
| WASD or arrow keys | Move |
| Shift | Sneak (slower, the alert meter fills more slowly) |
| E or Space | Steal a nearby pouch |
| Click a floor tile, or Q | Throw a coin. It lands along that line, up to a short range |
| On-screen stick, Steal, and Throw | Move, grab a pouch, or toss a coin forward on a phone. Tap the floor to pick the landing spot |

Each castle starts with a few coins (3 in the gatehouse, then 4, then 5). The marker shows where the coin will land. A cyan ring means the nearest guard in earshot will leave the patrol, walk there, look around, and then go back. A magenta ring means nobody hears it. Throwing is the decision: pull a guard off a door, or waste a coin.

Leaving without the alert meter ever filling adds **+3 simulated HOOD** for a quiet getaway. Every 10 seconds still on the clock when you reach the gate adds **+1 simulated HOOD**.

Each castle has a clock. It pauses while Settings is open and while the runtime menu is open. Hit zero and the heist fails, even if you already hold the pouches.

Guards walk a route, then switch to another route. Higher castles add guards, longer beams, faster walks, more frequent route changes, and a shorter clock. A beam that can see you fills the alert meter. Walls, pillars, and crates block the beam. The catch screen names what happened: the meter filled in a beam, you walked into a guard, or the clock hit zero. Steal every pouch, then step on the gate before time runs out.

Settings include mute and reduced motion. Reduced motion turns off beam flicker, spark particles, and screen shake. Gameplay pauses while the runtime menu is open and while Settings is open.

## Simulated HOOD

All HOOD in this preview is simulated. Nothing is transferred, and reloading the page clears the bank.

| Castle | Guards | Clock | Escape payout |
| --- | --- | --- | --- |
| 1 Gatehouse | 1 | 1:30 | 5 simulated HOOD |
| 2 Great Hall | 2 | 1:15 | 8 simulated HOOD |
| 3 Treasury | 3 | 1:02 | 12 simulated HOOD |
| 4 Dungeon | 3 | 0:52 | 16 simulated HOOD |
| 5 Throne Vault | 4 | 0:44 | 24 simulated HOOD |

Route changes are slower in the Gatehouse and happen on almost every loop in the Throne Vault. Beams get longer through the Treasury and wider in the Throne Vault. A quiet getaway adds 3 simulated HOOD, and leftover time adds 1 simulated HOOD per 10 seconds, on top of the castle payout. Coins reset every castle and are not banked.

## Art

Castle tiles, guards, beams, and effects are drawn in the game. The hero's face is the selected Friend's canonical sprite from the SDK artwork reader, with a hood and cape around it. If that artwork fails to load, a hooded stand-in is used and **Retry Friend art** tries again. SDK artwork terms are in `NOTICE.md` at the SDK root.
