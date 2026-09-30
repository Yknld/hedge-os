#!/usr/bin/env python3
"""Temporary localhost WebSocket server for the TradingView extension bridge."""

import asyncio
import json
import sys
from datetime import datetime

from websockets.asyncio.server import serve


HOST = "127.0.0.1"
PORT = 8765
clients = set()
client_sources = {}


def timestamp():
    return datetime.now().strftime("%H:%M:%S")


def log(message):
    print(f"[{timestamp()}] {message}", flush=True)


async def send_json(websocket, payload):
    await websocket.send(json.dumps(payload, separators=(",", ":")))


def recipients(source):
    return [client for client in clients if client_sources.get(client) == source]


async def publish_bridge_status():
    payload = {"type": "BRIDGE_STATUS", "relayConnected": True, "extensionConnected": bool(recipients("tradingview-extension"))}
    await asyncio.gather(*(send_json(client, payload) for client in recipients("hedge-os-app")), return_exceptions=True)


async def handle_client(websocket):
    clients.add(websocket)
    log(f"Bridge client connected from {websocket.remote_address}")
    try:
        async for raw_message in websocket:
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                log(f"Received invalid JSON: {raw_message!r}")
                continue

            message_type = message.get("type")
            if message_type == "HELLO":
                source = message.get("source")
                if source not in {"hedge-os-app", "tradingview-extension"}:
                    log(f"Rejected HELLO with unknown source={source!r}")
                    continue
                client_sources[websocket] = source
                log(f"HELLO source={source} version={message.get('version')}")
                await send_json(websocket, {"type": "HELLO_ACK"})
                await publish_bridge_status()
            elif message_type == "PING":
                await send_json(websocket, {"type": "PONG"})
            else:
                source = client_sources.get(websocket)
                targets = recipients("tradingview-extension" if source == "hedge-os-app" else "hedge-os-app")
                if source not in {"hedge-os-app", "tradingview-extension"}:
                    log(f"Ignored message before HELLO: {message_type}")
                else:
                    await asyncio.gather(*(send_json(client, message) for client in targets), return_exceptions=True)
                    log(f"{source} → {len(targets)} peer(s): {message_type}")
    except Exception as error:
        log(f"Connection ended: {error}")
    finally:
        clients.discard(websocket)
        client_sources.pop(websocket, None)
        await publish_bridge_status()
        log("Bridge client disconnected")


async def broadcast(payload):
    if not clients:
        log("No extension is connected; command was not sent")
        return
    encoded = json.dumps(payload, separators=(",", ":"))
    await asyncio.gather(*(client.send(encoded) for client in list(clients)))
    log(f"SENT {json.dumps(payload, indent=2)}")


async def command_prompt():
    log("Commands: status | send <JSON> | help | quit")
    while True:
        line = (await asyncio.to_thread(sys.stdin.readline)).strip()
        if not line:
            if sys.stdin.closed:
                return
            continue
        if line == "status":
            log(f"Connected extensions: {len(clients)}")
        elif line == "help":
            print(
                "Paste an order after 'send ', for example:\n"
                "send {\"id\":\"test-001\",\"type\":\"PLACE_ORDER\","
                "\"symbol\":\"MNQ\",\"side\":\"BUY\",\"quantity\":1,"
                "\"entryPrice\":24850.25,\"takeProfit\":24880.25,"
                "\"stopLoss\":24835.25}",
                flush=True,
            )
        elif line.startswith("send "):
            try:
                payload = json.loads(line[5:])
                if not isinstance(payload, dict):
                    raise ValueError("JSON must be an object")
                await broadcast(payload)
            except (json.JSONDecodeError, ValueError) as error:
                log(f"Command rejected: {error}")
        elif line in {"quit", "exit"}:
            log("Stopping server")
            return
        else:
            log("Unknown command. Use: status | send <JSON> | help | quit")


async def main():
    async with serve(handle_client, HOST, PORT, ping_interval=None):
        log(f"TradingView bridge test server listening on ws://{HOST}:{PORT}")
        await command_prompt()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("Stopped")
