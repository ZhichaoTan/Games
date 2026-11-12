# Pikafish, built for the browser

`pikafish.js` is the [Pikafish](https://github.com/official-pikafish/Pikafish) xiangqi engine compiled to WebAssembly (single-threaded, the wasm is embedded in the script). The Xiangqi page loads it in a Web Worker when a player switches Pikafish on, and talks to it in UCI.

Pikafish is free software under the GNU General Public License v3 (see `COPYING.txt` and `AUTHORS`). This build and its source changes are offered under the same licence.

## What is here

| File | What it is |
| --- | --- |
| `pikafish.js` | The engine: Emscripten glue with the wasm inside, about 0.8 MB. |
| `net-0.bin` … `net-3.bin` | The engine's neural network `pikafish.nnue` (49,982,985 bytes) cut into four pieces of at most 12.5 MB, so each file stays well under GitHub's size limits. The page downloads the four pieces, joins them, and keeps the result in IndexedDB (`xq-pikafish`), so the 48 MB download happens once per browser. |
| `pikafish-web.patch` | Every change made to the Pikafish source for this build. |
| `COPYING.txt`, `AUTHORS` | Pikafish's licence and authors, unchanged. |

## Rebuilding

Source: Pikafish at commit `1c66b9b21cf2f280ce3b3ffa80c1c6609f2b29ff`, with `pikafish-web.patch` applied. Compiler: Emscripten 7.0.0.

```sh
git clone https://github.com/official-pikafish/Pikafish && cd Pikafish
git checkout 1c66b9b21cf2f280ce3b3ffa80c1c6609f2b29ff
git apply /path/to/pikafish-web.patch
cd src && make -j8 all ARCH=wasm32 COMP=gcc COMPCXX=em++ web=yes
```

The network is the `pikafish.nnue` that this commit's Makefile downloads (`make net`); split it with `split -b 12500000 -d -a 1 pikafish.nnue net-` and rename the pieces to `net-0.bin` … `net-3.bin`.

`node xiangqi/dev/pf.js` loads the engine in a headless browser, asks it for three lines from the opening position and plays a move against it.
