# VPW performance verification

Final measurements use immutable baseline `9312564` and the current main-worktree implementation after the approved corrections. All measurements ran sequentially on the same machine without concurrent test/build workloads. Each case uses 1,500 trials per calculation, one warmup and five measured runs; values below are medians.

Integrated modes include the production scenario builder, selected aligned historical data, compounded real growth, monthly targets, the actual `runVPWSimulation` dispatcher and percentile aggregation. No trial count or fidelity reduction.

| Allocation | Years until target age | Original (ms) | Current, zero extra years (ms) | Current, five extra years (ms) |
| --- | ---: | ---: | ---: | ---: |
| fixed-income | 20 | 214.9 | 10.3 | 8.8 |
| fixed-income | 40 | 435.6 | 22.0 | 17.6 |
| fixed-income | 60 | 663.8 | 36.3 | 29.8 |
| balanced-with-fii | 20 | 283.4 | 12.7 | 10.2 |
| balanced-with-fii | 40 | 599.3 | 24.4 | 21.6 |
| balanced-with-fii | 60 | 877.5 | 36.5 | 37.0 |
| equity-heavy | 20 | 211.4 | 11.5 | 9.7 |
| equity-heavy | 40 | 453.1 | 22.9 | 19.6 |
| equity-heavy | 60 | 649.9 | 33.7 | 32.7 |

All nine matched zero-extra-years cases meet the no-slowdown gate. Five extra years is a separate feature workload: the original implementation did not offer this behavior. The fixed target age means later retirement has fewer withdrawal years. The new block-sampling mode is also measured separately (the `integrated-blocks` and `integrated-blocks-extra` benchmark modes); five-extra-years block medians range from 7.4 to 27.2 ms.

Actual production worker probe, balanced portfolio over 60 years at 1,500 trials:

- Zero extra years: 41.6 ms calculation, 54.8 ms including startup/messages.
- Five extra years: 51.4 ms calculation, 65.6 ms including startup/messages.

The production worker entry is bundled unchanged in a Node Web Worker bridge. A 5 ms heartbeat continued on the Node main thread. This proves worker transport and off-thread execution, **not browser-page responsiveness**. Native Chrome access was not approved. Source delivery from localhost is verified; real-browser visual QA and responsiveness remain unverified.

The temporary benchmark scripts and raw reports were removed after verification. The recorded measurements are retained above.
