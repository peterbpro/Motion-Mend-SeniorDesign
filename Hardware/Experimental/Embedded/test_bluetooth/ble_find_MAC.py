from bleak import BleakScanner

# Scan to find MAC//UUID addresss currently broadcasting over bluetooth
async def scan():
    devices = await BleakScanner.discover()
    for d in devices:
        print(d)

import asyncio
asyncio.run(scan())
