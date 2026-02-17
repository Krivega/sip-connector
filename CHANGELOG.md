# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [25.4.0](https://github.com/Krivega/sip-connector/compare/v25.3.0...v25.4.0) (2026-02-17)

### Features

- enhance recv quality management and event handling ([bc110d0](https://github.com/Krivega/sip-connector/commit/bc110d0dcdf94b65472f4244232dcfdb96440b15))

### Bug Fixes

- remove extraHeaders from session initialization to streamline parameters ([4b9aae0](https://github.com/Krivega/sip-connector/commit/4b9aae035c6cae887218c93a6c3f9d6e0068f5ee))

## [25.3.0](https://github.com/Krivega/sip-connector/compare/v25.2.5...v25.3.0) (2026-02-16)

### Features

- add purgatory state to call management and update related logic ([3e70998](https://github.com/Krivega/sip-connector/commit/3e7099833171bbdcb5f6c6e2a952d89c5bff4111))

### [25.2.5](https://github.com/Krivega/sip-connector/compare/v25.2.4...v25.2.5) (2026-02-16)

### Bug Fixes

- remove FAILED state handling from CallStateMachine and related components ([2aec326](https://github.com/Krivega/sip-connector/commit/2aec3260f48ccda15f72ca4e85a9ea9829e95a75))

### [25.2.4](https://github.com/Krivega/sip-connector/compare/v25.2.3...v25.2.4) (2026-02-13)

### Bug Fixes

- ensure selectSystemStatus returns CALL_ACTIVE for IN_ROOM regardless of connection and incoming/presentation statuses ([c2685f6](https://github.com/Krivega/sip-connector/commit/c2685f616818d0aa72a5f82159be64b75a758a7d))

### [25.2.3](https://github.com/Krivega/sip-connector/compare/v25.2.2...v25.2.3) (2026-02-13)

### Bug Fixes

- ensure system status remains CALL_ACTIVE when connection is DISCONNECTED during an active call ([eb1a939](https://github.com/Krivega/sip-connector/commit/eb1a9397438ab81f68b1cd278ecd3822999be970))

### [25.2.2](https://github.com/Krivega/sip-connector/compare/v25.2.1...v25.2.2) (2026-02-11)

### [25.2.1](https://github.com/Krivega/sip-connector/compare/v25.2.0...v25.2.1) (2026-02-09)

### Bug Fixes

- update getHeader to return the original value for BEARER_TOKEN instead of lowercase ([f473637](https://github.com/Krivega/sip-connector/commit/f473637f50f827356481aa502011a9ed84c11ad5))

## [25.2.0](https://github.com/Krivega/sip-connector/compare/v25.1.0...v25.2.0) (2026-02-09)

### Features

- enhance enter-room event to include optional bearerToken for improved authentication ([249f610](https://github.com/Krivega/sip-connector/commit/249f610b0eb1fd5706da473731a6e33cf8129265))

## [25.1.0](https://github.com/Krivega/sip-connector/compare/v25.0.0...v25.1.0) (2026-02-09)

### Features

- add getInRoomTokenOrThrow function and inRoomContext getter to CallStateMachine ([b28d411](https://github.com/Krivega/sip-connector/commit/b28d411dc22dc77954f688dfc1bafcdbfa54979e))
- add reception quality management UI and functionality, including new elements ([72582ec](https://github.com/Krivega/sip-connector/commit/72582ecc257832204faff77e47352870aa4f377a))
- add recvQuality management to CallManager and RecvSession, including event triggers ([a389dab](https://github.com/Krivega/sip-connector/commit/a389dab58573a227e822360ad873370836c6dc97))
- enhance documentation for recvQuality management, including new events and usage examples ([2c4fb58](https://github.com/Krivega/sip-connector/commit/2c4fb58ae70d2df11e6b5604c0fd79c477798c7f))

## [25.0.0](https://github.com/Krivega/sip-connector/compare/v24.0.1...v25.0.0) (2026-02-06)

### ⚠ BREAKING CHANGES

- remove TConnectionConfigurationWithUa and add authorizationUser to TConnectionConfiguration

### Bug Fixes

- remove TConnectionConfigurationWithUa and add authorizationUser to TConnectionConfiguration ([c2b683b](https://github.com/Krivega/sip-connector/commit/c2b683b37666705a1244c926c1da2ff42adf70d1))

### [24.0.1](https://github.com/Krivega/sip-connector/compare/v24.0.0...v24.0.1) (2026-02-05)

### Bug Fixes

- update IncomingCallManager to enforce required fields for remote caller data ([f53de19](https://github.com/Krivega/sip-connector/commit/f53de1905ddc00f40c7e51bcda32ebaba561cd82))

## [24.0.0](https://github.com/Krivega/sip-connector/compare/v23.3.1...v24.0.0) (2026-02-04)

### ⚠ BREAKING CHANGES

- remove ConferenceStateManager and integrate its functionality into CallManager and CallStateMachine

### Features

- enhance RecvSession and SipConnector tests to include token handling ([905e29f](https://github.com/Krivega/sip-connector/commit/905e29f1e045befc3afef55dbf63011cdc62a48d))
- implement DeferredCommandRunner for delayed execution of RecvSession start; handle token race conditions in CallManager ([2bbbcb9](https://github.com/Krivega/sip-connector/commit/2bbbcb9e6727e8a909eef0fc81bc53ea8f17e7bf))

- remove ConferenceStateManager and integrate its functionality into CallManager and CallStateMachine ([c86481a](https://github.com/Krivega/sip-connector/commit/c86481a4decc85c217a26a0e31a210973fb8d9b0))

### [23.3.1](https://github.com/Krivega/sip-connector/compare/v23.3.0...v23.3.1) (2026-02-01)

### Bug Fixes

- ensure token is required for sendOffer and handle missing token error ([5e8b61e](https://github.com/Krivega/sip-connector/commit/5e8b61e25c0690cf1f16b58652ee2f2243d03fe3))

## [23.3.0](https://github.com/Krivega/sip-connector/compare/v23.2.6...v23.3.0) (2026-02-01)

### Features

- implement repeatedCallsAsync for sendOffer in RecvSession to handle retries and cancellation ([7bb93d4](https://github.com/Krivega/sip-connector/commit/7bb93d40d4d3d5965e5688ea6607d89a5754ff41))

### [23.2.6](https://github.com/Krivega/sip-connector/compare/v23.2.5...v23.2.6) (2026-01-29)

### [23.2.5](https://github.com/Krivega/sip-connector/compare/v23.2.4...v23.2.5) (2026-01-26)

### Bug Fixes

- enhance setParametersToSender to support reset functionality for maxBitrate configuration ([986f453](https://github.com/Krivega/sip-connector/commit/986f4536a7fcbddfedb0d8c45995ab5939190a1c))

### [23.2.4](https://github.com/Krivega/sip-connector/compare/v23.2.3...v23.2.4) (2026-01-26)

### [23.2.3](https://github.com/Krivega/sip-connector/compare/v23.2.2...v23.2.3) (2026-01-26)

### Bug Fixes

- set minimum bitrate values to zero for audio and video in BitrateStateManager ([0e8a78e](https://github.com/Krivega/sip-connector/commit/0e8a78eeeaa5a2c8c7dd65285b5dcde7c865013a))

### [23.2.2](https://github.com/Krivega/sip-connector/compare/v23.2.1...v23.2.2) (2026-01-24)

### Bug Fixes

- update minimum bitrate values for audio and video in BitrateStateManager ([88d2266](https://github.com/Krivega/sip-connector/commit/88d2266ac58bc790f5484623691c64677785dc98))

### [23.2.1](https://github.com/Krivega/sip-connector/compare/v23.2.0...v23.2.1) (2026-01-24)

### Bug Fixes

- improve spectator role handling by adding synthetic spectator checks and bitrate adjustments ([09f3697](https://github.com/Krivega/sip-connector/commit/09f3697a00129196f2ac52e3f4caa0cf53f31108))

## [23.2.0](https://github.com/Krivega/sip-connector/compare/v23.1.2...v23.2.0) (2026-01-24)

### Features

- set min bitrate for sprectator ([2047c54](https://github.com/Krivega/sip-connector/commit/2047c5425701f5ed74b9f8d6ef296a8fbdf4aa79))

### [23.1.2](https://github.com/Krivega/sip-connector/compare/v23.1.1...v23.1.2) (2026-01-21)

### Bug Fixes

- participantName in enter room event ([8a1f133](https://github.com/Krivega/sip-connector/commit/8a1f133761466d5c0b642becdd0f29adf3fef2a9))

### [23.1.1](https://github.com/Krivega/sip-connector/compare/v23.1.0...v23.1.1) (2026-01-20)

### Bug Fixes

- recv contentedStream after start presentation ([872f0c2](https://github.com/Krivega/sip-connector/commit/872f0c2f392534a0be413dfe4adc99a66369fb29))

## [23.1.0](https://github.com/Krivega/sip-connector/compare/v23.0.0...v23.1.0) (2026-01-20)

### Features

- enhance StreamsManagerProvider to support contented streams based on codec availability ([853a8f5](https://github.com/Krivega/sip-connector/commit/853a8f5a95d9a91a71d4c05c89b086f0a305ec62))

### Bug Fixes

- renegotiate connection for spectator when main stream is not receiving frames ([#68](https://github.com/Krivega/sip-connector/issues/68)) ([3852e57](https://github.com/Krivega/sip-connector/commit/3852e57182352ac17696d2874b04d4f0c2fd721d))

## [23.0.0](https://github.com/Krivega/sip-connector/compare/v22.0.0...v23.0.0) (2026-01-19)

### ⚠ BREAKING CHANGES

- replace EHeader with EKeyHeader for consistent header management and update event handling logic

### Features

- add codec to `api:contented-stream:available` event and refactor types ([4dee373](https://github.com/Krivega/sip-connector/commit/4dee3738607b76c07b3bb0a0d52d399aea710202))
- add ContentedStreamManager ([46f6ba5](https://github.com/Krivega/sip-connector/commit/46f6ba5bca6eb5756afa2d68ce4fae4b8753c5e5))
- implement deduplication for remote-streams-changed events and enhance event handling in CallManager ([ea26ccb](https://github.com/Krivega/sip-connector/commit/ea26ccba2f21df03055bf22fa5774a670c79f1ce))
- introduce StreamsChangeTracker for efficient remote streams comparison and event emission in CallManager ([9b3c51b](https://github.com/Krivega/sip-connector/commit/9b3c51be81409ad4be1b66f5c0fcc99681c758b2))

### Bug Fixes

- collect stats from recv-session for spectator ([#67](https://github.com/Krivega/sip-connector/issues/67)) ([7bf159e](https://github.com/Krivega/sip-connector/commit/7bf159eb9fee448a8117aa4f671c61064553059a))
- update sendInfo calls in ApiManager to use EContentTypeSent for SHARE_STATE ([49f9ed0](https://github.com/Krivega/sip-connector/commit/49f9ed003fc523f8b3a8dbc5d5a0769f83bed7cb))

- replace EHeader with EKeyHeader for consistent header management and update event handling logic ([dcf97ca](https://github.com/Krivega/sip-connector/commit/dcf97ca43027625e51013c64eefce25acdd29431))

## [22.0.0](https://github.com/Krivega/sip-connector/compare/v21.0.0...v22.0.0) (2026-01-16)

### ⚠ BREAKING CHANGES

- standardize API event naming conventions and update event handling logic

- standardize API event naming conventions and update event handling logic ([3baa622](https://github.com/Krivega/sip-connector/commit/3baa622395603c15e3707bc14059ced306551635))

## [21.0.0](https://github.com/Krivega/sip-connector/compare/v20.6.1...v21.0.0) (2026-01-15)

### ⚠ BREAKING CHANGES

- rename event remote-streams-changed to remote-tracks-changed
- update remote stream handling to use TRemoteStreams type and improve stream management logic

### Features

- add event remote-streams-changed ([1148315](https://github.com/Krivega/sip-connector/commit/1148315c08ae0c6f4ee13465bdbd9a0f1d6c014e))
- add isAddedStream to addTrack return type ([ec32f30](https://github.com/Krivega/sip-connector/commit/ec32f30bfc1bdba5c7e7b54cdf4342117a12f999))
- add presentation tools in demo ([#66](https://github.com/Krivega/sip-connector/issues/66)) ([618498c](https://github.com/Krivega/sip-connector/commit/618498c8fd91a7cd077cafaeb797c2600f5ecb4f))

### Bug Fixes

- enhance remote streams management by introducing TRemoteStreamsChangeType and updating event structure ([66c2f70](https://github.com/Krivega/sip-connector/commit/66c2f707321d69a6ecfa92de41da5e99ad213abb))
- rename event remote-streams-changed to remote-tracks-changed ([f0d3bd4](https://github.com/Krivega/sip-connector/commit/f0d3bd41265bbef4ec29e9bc2591348827840f31))
- update remote stream handling to use TRemoteStreams type and improve stream management logic ([e3a51b1](https://github.com/Krivega/sip-connector/commit/e3a51b12c349af2209d109762bfce7635d24812f))

### [20.6.1](https://github.com/Krivega/sip-connector/compare/v20.6.0...v20.6.1) (2026-01-15)

### Bug Fixes

- update dependencies and improve registration failure handling in connection manager ([d8b5f4b](https://github.com/Krivega/sip-connector/commit/d8b5f4bad7d5d16dbea0e3d250a7af998a9ad311))

## [20.6.0](https://github.com/Krivega/sip-connector/compare/v20.5.0...v20.6.0) (2026-01-14)

### Features

- add system status management by introducing ESystemStatus and related selectors for combined connection and call states ([badebb0](https://github.com/Krivega/sip-connector/commit/badebb07e25f8c11954d99e7528ba8e769902caa))
- enhance logs management by updating UI behavior and adding disabled state handling ([7d340b4](https://github.com/Krivega/sip-connector/commit/7d340b4274d2884530df7c39559b3954e7a8a9e0))

## [20.5.0](https://github.com/Krivega/sip-connector/compare/v20.4.1...v20.5.0) (2026-01-14)

### Features

- add conference-state event handling to SipConnector and update event types ([b8aae2a](https://github.com/Krivega/sip-connector/commit/b8aae2a13e131e93345e070aec6dbefa97b7e82e))
- add LogsManager for event logging and UI integration ([6f31c5c](https://github.com/Krivega/sip-connector/commit/6f31c5c14c19e1b49ecaa94a0a01048e86d9bf56))
- integrate MainStreamHealthMonitor events into SipConnector and update event handling ([80571c0](https://github.com/Krivega/sip-connector/commit/80571c0b23c0f9c886a503259f6ab0da3b02b91d))
- introduce SessionManager for session state management and update related documentation ([ec4142a](https://github.com/Krivega/sip-connector/commit/ec4142aa78c89921778611922cde6e205633d5fa))

### Bug Fixes

- do not recover main stream when no received packets ([#65](https://github.com/Krivega/sip-connector/issues/65)) ([ea0c366](https://github.com/Krivega/sip-connector/commit/ea0c3666e8414d06288c2999ce39d35253eb16c3))

### [20.4.1](https://github.com/Krivega/sip-connector/compare/v20.4.0...v20.4.1) (2026-01-13)

### Bug Fixes

- add type annotations for actor references in Call, Connection, Incoming Call, and Presentation Managers ([a5a9713](https://github.com/Krivega/sip-connector/commit/a5a9713aae4b8e53dc6d94429e89ef7770833093))

## [20.4.0](https://github.com/Krivega/sip-connector/compare/v20.3.0...v20.4.0) (2026-01-13)

### Features

- introduce ConferenceStateManager for centralized conference state management ([528d066](https://github.com/Krivega/sip-connector/commit/528d06680f8a803b10a4d42fc00fc97f20e35873))

## [20.3.0](https://github.com/Krivega/sip-connector/compare/v20.2.1...v20.3.0) (2026-01-13)

### Features

- implement session management with XState ([#62](https://github.com/Krivega/sip-connector/issues/62)) ([8167595](https://github.com/Krivega/sip-connector/commit/81675956aa105300bb2ce392b62b16fa8e588f3e))

### Bug Fixes

- ensure consistent invocation of mayBeStopPresentationAndNotify method ([0f0f8ff](https://github.com/Krivega/sip-connector/commit/0f0f8ff5d2a43676e92cbeee04d11421639efdf8))
- not trigger event "stopped-presentation-by-server-command" for inactive share ([#64](https://github.com/Krivega/sip-connector/issues/64)) ([3874cb2](https://github.com/Krivega/sip-connector/commit/3874cb261cb6a8d3c716c9abc0d059ba669fb3c1))

### [20.2.1](https://github.com/Krivega/sip-connector/compare/v20.2.0...v20.2.1) (2026-01-13)

### Bug Fixes

- renegotiate when main stream has stopped due to no received or decoded inbound frames ([#63](https://github.com/Krivega/sip-connector/issues/63)) ([4f98f77](https://github.com/Krivega/sip-connector/commit/4f98f774bc4eb7d9f71dd21d725490666ca52f06))

## [20.2.0](https://github.com/Krivega/sip-connector/compare/v20.1.2...v20.2.0) (2025-12-29)

### Features

- enhance event handling for presentation stop commands ([9ee8dae](https://github.com/Krivega/sip-connector/commit/9ee8dae8f4f17ae3dd1f1fce52be3d12e6328954))

### [20.1.2](https://github.com/Krivega/sip-connector/compare/v20.1.1...v20.1.2) (2025-12-25)

### Bug Fixes

- add connected with configuration from out of call event ([#61](https://github.com/Krivega/sip-connector/issues/61)) ([25164ec](https://github.com/Krivega/sip-connector/commit/25164ecad8b4d22ebc98c9a132b0baaf9f2fbab7))

### [20.1.1](https://github.com/Krivega/sip-connector/compare/v20.1.0...v20.1.1) (2025-12-24)

### Bug Fixes

- do not disconnect or reconnect when call is active ([#60](https://github.com/Krivega/sip-connector/issues/60)) ([1b7da14](https://github.com/Krivega/sip-connector/commit/1b7da14e0dca457569b17845d39758b70f5ba239))

## [20.1.0](https://github.com/Krivega/sip-connector/compare/v20.0.0...v20.1.0) (2025-12-19)

### Features

- invoke stopPresentation on spectator move requests ([e6c0b71](https://github.com/Krivega/sip-connector/commit/e6c0b719f91ce0372d2562364b773c6e928861b2))

## [20.0.0](https://github.com/Krivega/sip-connector/compare/v19.9.0...v20.0.0) (2025-12-19)

### ⚠ BREAKING CHANGES

- rename sipServerUrl -> sipServerIp, sipWebSocketServerURL -> sipServerUrl, The required path is now added to sipServerUrl(ex sipWebSocketServerURL), removed setRemoteStreams, ontrack

### Features

- implement new spectator mode ([#57](https://github.com/Krivega/sip-connector/issues/57)) ([33d5d79](https://github.com/Krivega/sip-connector/commit/33d5d79137f35c59c41b6c464afd3bb3accec00f))

## [19.9.0](https://github.com/Krivega/sip-connector/compare/v19.8.3...v19.9.0) (2025-12-17)

### Features

- add audioId to participant move request event and update related tests ([e0787d6](https://github.com/Krivega/sip-connector/commit/e0787d6ad7448d8c2bf318575e744e16a8286262))
- add demo ([9490ba2](https://github.com/Krivega/sip-connector/commit/9490ba26fd670a758b23f33f9c9188312ad295cb))
- add participant role management and update call UI with status display ([e508e23](https://github.com/Krivega/sip-connector/commit/e508e23e2e9539ed2acc4ce38e9985ebf78fd13e))
- add use license management and update DOM structure with new license section ([ee04091](https://github.com/Krivega/sip-connector/commit/ee040915f4ea5875f8dd889938ef6d93c8344a75))
- differentiate spectator move requests with and without audioId in ApiManager ([5e2a520](https://github.com/Krivega/sip-connector/commit/5e2a52001f678029416024cb291f1cfae461463f))
- enhance RecvSession to add multiple video transceivers for content sharing ([296e52a](https://github.com/Krivega/sip-connector/commit/296e52a09136106ed537a35b8d8fbd67e2d257c0))
- implement RecvSession for handling incoming media sessions with audio and video transceivers ([897f176](https://github.com/Krivega/sip-connector/commit/897f1765fffe624a44f3405d7d2d0afe04a3000b))

### Bug Fixes

- make audioId optional in move-request-to-spectators event type ([9f5c0ba](https://github.com/Krivega/sip-connector/commit/9f5c0ba95245f8604fcfa12c906b92e713d28a5a))
- remove all ua listeners after disconnect ([#58](https://github.com/Krivega/sip-connector/issues/58)) ([312efd6](https://github.com/Krivega/sip-connector/commit/312efd65a581bf096e22567b6bda050926005ef2))

### [19.8.3](https://github.com/Krivega/sip-connector/compare/v19.8.2...v19.8.3) (2025-12-12)

### Bug Fixes

- resolve promise race in restart connection attempts ([#56](https://github.com/Krivega/sip-connector/issues/56)) ([eed884a](https://github.com/Krivega/sip-connector/commit/eed884a5ff8c37ef84a28424132ece11e99df582))

### [19.8.2](https://github.com/Krivega/sip-connector/compare/v19.8.1...v19.8.2) (2025-12-12)

### Bug Fixes

- handlers in onEnterPurgatory, onEnterConference in answerToIncomingCall and fix types events ([df6025c](https://github.com/Krivega/sip-connector/commit/df6025cd21f62690be2b65dd3e7330550155d24e))

### [19.8.1](https://github.com/Krivega/sip-connector/compare/v19.8.0...v19.8.1) (2025-12-11)

## [19.8.0](https://github.com/Krivega/sip-connector/compare/v19.7.1...v19.8.0) (2025-12-11)

### Features

- add event proxying for connection configuration in ConnectionFlow ([a96da0e](https://github.com/Krivega/sip-connector/commit/a96da0ed90b15fd7d648ea4d041249ab8b0eb84f))

### Bug Fixes

- update error handling in AutoConnectorManager to trigger stop attempts event ([9a19632](https://github.com/Krivega/sip-connector/commit/9a196325c04a52915472ff8282b5e8f55fc672db))

### [19.7.1](https://github.com/Krivega/sip-connector/compare/v19.7.0...v19.7.1) (2025-11-27)

### Bug Fixes

- restart auto connector when changed network interface or resumed from sleep mode ([#54](https://github.com/Krivega/sip-connector/issues/54)) ([650fbc9](https://github.com/Krivega/sip-connector/commit/650fbc9ddd78adcb4c4597abb991c8328a2ffd1a))

## [19.7.0](https://github.com/Krivega/sip-connector/compare/v19.6.0...v19.7.0) (2025-11-25)

### Features

- control ping server with network interfaces and puspend events ([#53](https://github.com/Krivega/sip-connector/issues/53)) ([515f0cc](https://github.com/Krivega/sip-connector/commit/515f0cc97e7df639c852889f23b975e09acfcc71))

## [19.6.0](https://github.com/Krivega/sip-connector/compare/v19.5.0...v19.6.0) (2025-10-22)

### Features

- enforce required fields in connection configuration ([8b8f59f](https://github.com/Krivega/sip-connector/commit/8b8f59fbaae2e61809163fdc762eccf09cdcc2ef))

## [19.5.0](https://github.com/Krivega/sip-connector/compare/v19.4.0...v19.5.0) (2025-10-22)

### Features

- add CONNECT_PARAMETERS_RESOLVE_SUCCESS event and enhance connection handling ([c74c19e](https://github.com/Krivega/sip-connector/commit/c74c19ec432e4067853e16ab963d90a11a3b20e2))

## [19.4.0](https://github.com/Krivega/sip-connector/compare/v19.3.0...v19.4.0) (2025-10-21)

### Features

- enhance connection management with TConnectionConfiguration and TConnectionConfigurationWithUa types ([d248331](https://github.com/Krivega/sip-connector/commit/d248331a952d60992c0f622cd5b3fe734b035bde))

## [19.3.0](https://github.com/Krivega/sip-connector/compare/v19.2.2...v19.3.0) (2025-10-21)

### Features

- introduce TParametersConnection type and update related components ([2c17717](https://github.com/Krivega/sip-connector/commit/2c177178e148cc8b5064dc663ff014752bcd9237))

### [19.2.2](https://github.com/Krivega/sip-connector/compare/v19.2.1...v19.2.2) (2025-10-17)

### Bug Fixes

- ensure attempts state is finished on various connection errors ([6c14702](https://github.com/Krivega/sip-connector/commit/6c147020e0d12c46ddbfc9ff2c8ee4a11d46df5c))

### [19.2.1](https://github.com/Krivega/sip-connector/compare/v19.2.0...v19.2.1) (2025-10-16)

### Bug Fixes

- update event names and handling in AutoConnectorManager ([2abf40b](https://github.com/Krivega/sip-connector/commit/2abf40bc2b430814f5634d57762014758792c3ce))

## [19.2.0](https://github.com/Krivega/sip-connector/compare/v19.1.0...v19.2.0) (2025-10-16)

### Features

- add event for connection parameters resolution failure ([83485ea](https://github.com/Krivega/sip-connector/commit/83485ea1c8c2945c74c09e2ed4a79e11f43e1a5c))

## [19.1.0](https://github.com/Krivega/sip-connector/compare/v19.0.1...v19.1.0) (2025-10-15)

### Features

- remove parameters not exist error handling and introduce canRetryOnError option ([fa61313](https://github.com/Krivega/sip-connector/commit/fa613131608604d86725774769a120818c1e6f5d))

### [19.0.1](https://github.com/Krivega/sip-connector/compare/v19.0.0...v19.0.1) (2025-10-08)

### Bug Fixes

- condition for reconnect ([#52](https://github.com/Krivega/sip-connector/issues/52)) ([1d231a7](https://github.com/Krivega/sip-connector/commit/1d231a7d31e919b08fdd21bb4db008e69e2799f8))

## [19.0.0](https://github.com/Krivega/sip-connector/compare/v18.0.0...v19.0.0) (2025-09-25)

### ⚠ BREAKING CHANGES

- add auto connector manager (#51)

### Features

- add auto connector manager ([#51](https://github.com/Krivega/sip-connector/issues/51)) ([44f245f](https://github.com/Krivega/sip-connector/commit/44f245f0d7a89b56c4b9e3d72e83365699a18a4e))

## [18.0.0](https://github.com/Krivega/sip-connector/compare/v17.0.0...v18.0.0) (2025-09-23)

### ⚠ BREAKING CHANGES

- remove handle event SPECTATOR_OVER_SFU

### Bug Fixes

- remove handle event SPECTATOR_OVER_SFU ([be7bcc8](https://github.com/Krivega/sip-connector/commit/be7bcc8a4adf1451ef10fcb9d0706f793f9a4e59))
- set typed events for CallManager ([627db50](https://github.com/Krivega/sip-connector/commit/627db50fd691ab5edbb7dd188169e3f8e71a49b3))

## [17.0.0](https://github.com/Krivega/sip-connector/compare/v16.2.0...v17.0.0) (2025-09-19)

### ⚠ BREAKING CHANGES

- Added getTransceivers and addTransceiver methods to ICallStrategy interface

### Features

- add TransceiverManager and auto presentation transceiver handling ([ded6e37](https://github.com/Krivega/sip-connector/commit/ded6e374b2d9bca0d0c4c73d46ce2523e79084ed))

## [16.2.0](https://github.com/Krivega/sip-connector/compare/v16.1.0...v16.2.0) (2025-09-12)

### Features

- add auto restart ICE-connection on restart event from server ([5a4c8c7](https://github.com/Krivega/sip-connector/commit/5a4c8c702a6cbbc6bc9026f8aed3a1425d9dfe18))
- add restart event ([56f3241](https://github.com/Krivega/sip-connector/commit/56f3241d2d797bb1b49ef230184b7a1a6eae673f))

## [16.1.0](https://github.com/Krivega/sip-connector/compare/v16.0.3...v16.1.0) (2025-09-01)

### Features

- add connection Queue manager ([#49](https://github.com/Krivega/sip-connector/issues/49)) ([16ff779](https://github.com/Krivega/sip-connector/commit/16ff779a92e5212dc9c0238f1e5eac462fd33b8d))

### [16.0.3](https://github.com/Krivega/sip-connector/compare/v16.0.2...v16.0.3) (2025-08-29)

### Bug Fixes

- type onBeforeProgressCall ([f0b534a](https://github.com/Krivega/sip-connector/commit/f0b534ac86b6ea56091727f2ff5b0e7bb8cbbfa9))

### [16.0.2](https://github.com/Krivega/sip-connector/compare/v16.0.1...v16.0.2) (2025-08-26)

### Bug Fixes

- fixed errors calling presentation stop if presentation start was not waited for ([7edd37f](https://github.com/Krivega/sip-connector/commit/7edd37f12f010efec92286af20a43fcf9cf4ab1d))

### [16.0.1](https://github.com/Krivega/sip-connector/compare/v16.0.0...v16.0.1) (2025-08-26)

## [16.0.0](https://github.com/Krivega/sip-connector/compare/v15.3.1...v16.0.0) (2025-08-20)

### ⚠ BREAKING CHANGES

- remove simulcastEncodings from SipConnectorFacade
- move videoSendingBalancer to SipConnector

### Features

- add adaptive polling ([19c6484](https://github.com/Krivega/sip-connector/commit/19c6484ef3b463d74b95977cf46c381f906ae5c0))
- add support maxBitrate to PresentationManager ([f5d7a4b](https://github.com/Krivega/sip-connector/commit/f5d7a4b0ac337a2c02ade61a09378338abcb358f))
- add supports preferred codecs in SipConnector ([d84bc71](https://github.com/Krivega/sip-connector/commit/d84bc71c83d86fb5454aabfd1c4d3ccda9842c40))
- handle change track for video balance ([81ea495](https://github.com/Krivega/sip-connector/commit/81ea495128bb727941e89261bf544aa8997dbcee))
- move videoSendingBalancer to SipConnector ([56a75c5](https://github.com/Krivega/sip-connector/commit/56a75c5a6d132c70f43e7dc9b6d9e5665e3b9933))
- start balance video after start call ([1a5214d](https://github.com/Krivega/sip-connector/commit/1a5214d3705612d15d5eef1d40d770188116980a))

- remove simulcastEncodings from SipConnectorFacade ([2ad97cc](https://github.com/Krivega/sip-connector/commit/2ad97ccaaec66011f44ede2858b87deb60cc914e))

### [15.3.1](https://github.com/Krivega/sip-connector/compare/v15.3.0...v15.3.1) (2025-08-14)

### Bug Fixes

- export types TInboundStats, TOutboundStats ([122c64c](https://github.com/Krivega/sip-connector/commit/122c64cc6bfceb1d997a3cad81acf9c93a223349))

## [15.3.0](https://github.com/Krivega/sip-connector/compare/v15.2.0...v15.3.0) (2025-08-14)

### Features

- add send info to server with stats (availableIncomingBitrate) ([25959fd](https://github.com/Krivega/sip-connector/commit/25959fd08f336fdc68c216f80e0de45ad580af98))

## [15.2.0](https://github.com/Krivega/sip-connector/compare/v15.1.0...v15.2.0) (2025-08-14)

### Features

- add StatsManager ([d382a6c](https://github.com/Krivega/sip-connector/commit/d382a6c472ba6b65f201dd801eb8babfd9123ef7))
- add StatsPeerConnection ([a9d62dc](https://github.com/Krivega/sip-connector/commit/a9d62dca9999c95cbb3cc3d0d09d54f12f8c7a4a))

## [15.1.0](https://github.com/Krivega/sip-connector/compare/v15.0.0...v15.1.0) (2025-08-13)

### Features

- add support event participant:move-request-to-spectators-over-sfu ([e145403](https://github.com/Krivega/sip-connector/commit/e145403e33858edd081a8ad71072273739356ac2))

## [15.0.0](https://github.com/Krivega/sip-connector/compare/v14.1.1...v15.0.0) (2025-08-04)

### ⚠ BREAKING CHANGES

- V15 (#47)

### Features

- V15 ([#47](https://github.com/Krivega/sip-connector/issues/47)) ([57f5ad5](https://github.com/Krivega/sip-connector/commit/57f5ad5b49af40f94ca1eec6e6ef212b7d04e213))

## [14.1.0-alpha.13](https://github.com/Krivega/sip-connector/compare/v14.1.1...v14.1.0-alpha.13) (2025-08-04)

### Bug Fixes

- set max bitrate ([b8b5488](https://github.com/Krivega/sip-connector/commit/b8b5488d330b2ab6b9b809fb55dfb3d740805423))

## [14.1.0-alpha.12](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.11...v14.1.0-alpha.12) (2025-08-01)

### Bug Fixes

- replaceMediaStream ([53c498a](https://github.com/Krivega/sip-connector/commit/53c498afc3fbfb5f510c7c695e8f7df63ec64530))

## [14.1.0-alpha.11](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.10...v14.1.0-alpha.11) (2025-07-31)

### Bug Fixes

- add tests ([ec8f618](https://github.com/Krivega/sip-connector/commit/ec8f618e163f2ae2fceb479b75ce82abd9864f51))

## [14.1.0-alpha.10](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.9...v14.1.0-alpha.10) (2025-07-28)

### Bug Fixes

- ontrack ([e6ac300](https://github.com/Krivega/sip-connector/commit/e6ac30091aa1c95b0b8447edd56ddb2e2f387245))

## [14.1.0-alpha.9](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.8...v14.1.0-alpha.9) (2025-07-28)

### Bug Fixes

- ontrack ([ceebc89](https://github.com/Krivega/sip-connector/commit/ceebc897cb71acae13a5c57d2341cfe2e313cabc))

## [14.1.0-alpha.8](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.7...v14.1.0-alpha.8) (2025-07-28)

### Features

- export TJsSIP ([85afe22](https://github.com/Krivega/sip-connector/commit/85afe221adbf0871456d63d1b807c0f72ba1d560))

## [14.1.0-alpha.7](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.6...v14.1.0-alpha.7) (2025-07-28)

### Features

- export EMimeTypesVideoCodecs ([bc034e9](https://github.com/Krivega/sip-connector/commit/bc034e9bb8776f7779207e86ff15e7ba680f08e8))

## [14.1.0-alpha.6](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.5...v14.1.0-alpha.6) (2025-07-28)

## [14.1.0-alpha.5](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.4...v14.1.0-alpha.5) (2025-07-28)

### Features

- export TContentHint ([60d5637](https://github.com/Krivega/sip-connector/commit/60d5637c50fad9e9cceccffa3d7525ec555e9894))

## [14.1.0-alpha.4](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.3...v14.1.0-alpha.4) (2025-07-28)

### Features

- export TCustomError ([6e34edc](https://github.com/Krivega/sip-connector/commit/6e34edc2d7bf577fc8b9cbb954b6192adf254a6c))

## [14.1.0-alpha.3](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.2...v14.1.0-alpha.3) (2025-07-28)

### Features

- export ECallCause ([e2d0fa6](https://github.com/Krivega/sip-connector/commit/e2d0fa69bc1d480b0e2a6f7245a587b8af8407e8))
- export EUseLicense ([128db55](https://github.com/Krivega/sip-connector/commit/128db554c99593cf0c3153a8ca945b8fca16b9c2))

## [14.1.0-alpha.2](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.1...v14.1.0-alpha.2) (2025-07-26)

## [14.1.0-alpha.1](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.0...v14.1.0-alpha.1) (2025-07-26)

## [14.1.0-alpha.0](https://github.com/Krivega/sip-connector/compare/v14.1.0...v14.1.0-alpha.0) (2025-07-26)

### Features

- add ApiManager ([ff2861d](https://github.com/Krivega/sip-connector/commit/ff2861dd2d038f310fb8d13e28f8a51f8abb3cc6))
- add CallManager ([8de9cef](https://github.com/Krivega/sip-connector/commit/8de9cef60041fe33457f6095e8867b1237d0c626))
- add CallManager ([40810cd](https://github.com/Krivega/sip-connector/commit/40810cdf524554086b4f3fa25f64318754997e6e))
- add CallManager and IncomingCallManager ([cb4636a](https://github.com/Krivega/sip-connector/commit/cb4636adfd2273aefe86280cb4fa6d42ddd857b5))
- add ConfigurationManager and ConnectionFlow for enhanced SIP connection management ([43b6ee7](https://github.com/Krivega/sip-connector/commit/43b6ee779e165b8dba4ea11a46d3b8d8856e3786))
- add ConfigurationManager and ConnectionFlow for enhanced SIP connection management ([9fbbc8d](https://github.com/Krivega/sip-connector/commit/9fbbc8db6dff8c5a903be8cf09e7f0bd1f127507))
- implement ConnectionManager and IncomingCallManager for SIP handling ([3b89b75](https://github.com/Krivega/sip-connector/commit/3b89b75a7846a3223dda5f1f69809f46e53cec7e))
- integrate XState for connection state management in ConnectionManager ([07dcda7](https://github.com/Krivega/sip-connector/commit/07dcda7a3a66ad8a6c665f204b8ebec51bc2303c))
- refactor ConnectionManager to use RegistrationManager and UAFactory for improved SIP handling ([aa982f9](https://github.com/Krivega/sip-connector/commit/aa982f9cc05b10aff511b372ea2e407b0fcfffbb))

### Bug Fixes

- resolve unsubscribe function initialization and improve UA event handling in ConnectionFlow and UAFactory ([a4ccd53](https://github.com/Krivega/sip-connector/commit/a4ccd53a1ee408ebe36f75053f330990a466b04a))
- update jest configuration and improve error handling in ConnectionManager tests ([7e3cc9b](https://github.com/Krivega/sip-connector/commit/7e3cc9b47353d4c129058e07df4abc667252ef9c))

## [14.1.0-alpha.12](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.11...v14.1.0-alpha.12) (2025-08-01)

### Bug Fixes

- replaceMediaStream ([53c498a](https://github.com/Krivega/sip-connector/commit/53c498afc3fbfb5f510c7c695e8f7df63ec64530))

## [14.1.0-alpha.11](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.10...v14.1.0-alpha.11) (2025-07-31)

### Bug Fixes

- add tests ([ec8f618](https://github.com/Krivega/sip-connector/commit/ec8f618e163f2ae2fceb479b75ce82abd9864f51))

## [14.1.0-alpha.10](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.9...v14.1.0-alpha.10) (2025-07-28)

### Bug Fixes

- ontrack ([e6ac300](https://github.com/Krivega/sip-connector/commit/e6ac30091aa1c95b0b8447edd56ddb2e2f387245))

## [14.1.0-alpha.9](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.8...v14.1.0-alpha.9) (2025-07-28)

### Bug Fixes

- ontrack ([ceebc89](https://github.com/Krivega/sip-connector/commit/ceebc897cb71acae13a5c57d2341cfe2e313cabc))

## [14.1.0-alpha.8](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.7...v14.1.0-alpha.8) (2025-07-28)

### Features

- export TJsSIP ([85afe22](https://github.com/Krivega/sip-connector/commit/85afe221adbf0871456d63d1b807c0f72ba1d560))

## [14.1.0-alpha.7](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.6...v14.1.0-alpha.7) (2025-07-28)

### Features

- export EMimeTypesVideoCodecs ([bc034e9](https://github.com/Krivega/sip-connector/commit/bc034e9bb8776f7779207e86ff15e7ba680f08e8))

## [14.1.0-alpha.6](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.5...v14.1.0-alpha.6) (2025-07-28)

## [14.1.0-alpha.5](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.4...v14.1.0-alpha.5) (2025-07-28)

### Features

- export TContentHint ([60d5637](https://github.com/Krivega/sip-connector/commit/60d5637c50fad9e9cceccffa3d7525ec555e9894))

## [14.1.0-alpha.4](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.3...v14.1.0-alpha.4) (2025-07-28)

### Features

- export TCustomError ([6e34edc](https://github.com/Krivega/sip-connector/commit/6e34edc2d7bf577fc8b9cbb954b6192adf254a6c))

## [14.1.0-alpha.3](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.2...v14.1.0-alpha.3) (2025-07-28)

### Features

- export ECallCause ([e2d0fa6](https://github.com/Krivega/sip-connector/commit/e2d0fa69bc1d480b0e2a6f7245a587b8af8407e8))
- export EUseLicense ([128db55](https://github.com/Krivega/sip-connector/commit/128db554c99593cf0c3153a8ca945b8fca16b9c2))

## [14.1.0-alpha.2](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.1...v14.1.0-alpha.2) (2025-07-26)

## [14.1.0-alpha.1](https://github.com/Krivega/sip-connector/compare/v14.1.0-alpha.0...v14.1.0-alpha.1) (2025-07-26)

## [14.1.0-alpha.0](https://github.com/Krivega/sip-connector/compare/v14.1.0...v14.1.0-alpha.0) (2025-07-26)

### Features

- add ApiManager ([ff2861d](https://github.com/Krivega/sip-connector/commit/ff2861dd2d038f310fb8d13e28f8a51f8abb3cc6))
- add CallManager ([8de9cef](https://github.com/Krivega/sip-connector/commit/8de9cef60041fe33457f6095e8867b1237d0c626))
- add CallManager ([40810cd](https://github.com/Krivega/sip-connector/commit/40810cdf524554086b4f3fa25f64318754997e6e))
- add CallManager and IncomingCallManager ([cb4636a](https://github.com/Krivega/sip-connector/commit/cb4636adfd2273aefe86280cb4fa6d42ddd857b5))
- add ConfigurationManager and ConnectionFlow for enhanced SIP connection management ([43b6ee7](https://github.com/Krivega/sip-connector/commit/43b6ee779e165b8dba4ea11a46d3b8d8856e3786))
- add ConfigurationManager and ConnectionFlow for enhanced SIP connection management ([9fbbc8d](https://github.com/Krivega/sip-connector/commit/9fbbc8db6dff8c5a903be8cf09e7f0bd1f127507))
- implement ConnectionManager and IncomingCallManager for SIP handling ([3b89b75](https://github.com/Krivega/sip-connector/commit/3b89b75a7846a3223dda5f1f69809f46e53cec7e))
- integrate XState for connection state management in ConnectionManager ([07dcda7](https://github.com/Krivega/sip-connector/commit/07dcda7a3a66ad8a6c665f204b8ebec51bc2303c))
- refactor ConnectionManager to use RegistrationManager and UAFactory for improved SIP handling ([aa982f9](https://github.com/Krivega/sip-connector/commit/aa982f9cc05b10aff511b372ea2e407b0fcfffbb))

### Bug Fixes

- resolve unsubscribe function initialization and improve UA event handling in ConnectionFlow and UAFactory ([a4ccd53](https://github.com/Krivega/sip-connector/commit/a4ccd53a1ee408ebe36f75053f330990a466b04a))
- update jest configuration and improve error handling in ConnectionManager tests ([7e3cc9b](https://github.com/Krivega/sip-connector/commit/7e3cc9b47353d4c129058e07df4abc667252ef9c))

### [14.1.1](https://github.com/Krivega/sip-connector/compare/v14.0.1...v14.1.1) (2025-08-04)

### [14.0.1](https://github.com/Krivega/sip-connector/compare/v14.1.0...v14.0.1) (2025-08-04)

### [14.0.1-0](https://github.com/Krivega/sip-connector/compare/v14.0.0...v14.0.1-0) (2025-07-15)

### [14.0.1-0](https://github.com/Krivega/sip-connector/compare/v14.0.0...v14.0.1-0) (2025-07-15)

## [14.1.0](https://github.com/Krivega/sip-connector/compare/v14.0.0...v14.1.0) (2025-07-15)

### Features

- hasCanceledStartPresentationError ([d2c0458](https://github.com/Krivega/sip-connector/commit/d2c04584d62134b0be93d853f6dbb1ba8c87f498))

## [14.0.0](https://github.com/Krivega/sip-connector/compare/v13.3.1...v14.0.0) (2025-02-13)

### ⚠ BREAKING CHANGES

- use named export
- rename session to rtcSession

### Bug Fixes

- support ff 109 and lower ([17dcd84](https://github.com/Krivega/sip-connector/commit/17dcd8437f01ad22b96c4a00373b537bccf3cd6f))

- rename session to rtcSession ([fd2e956](https://github.com/Krivega/sip-connector/commit/fd2e956267b4d05e3f1fe8e40452a5d4568872ac))
- use named export ([c8a48ab](https://github.com/Krivega/sip-connector/commit/c8a48abf675b3c9982c8a4e9e799b85750fe3959))

### [13.3.1](https://github.com/Krivega/sip-connector/compare/v13.3.0...v13.3.1) (2024-12-19)

### Bug Fixes

- work with codecs ([1c8f9f5](https://github.com/Krivega/sip-connector/commit/1c8f9f576266692b81763348f03e41f6bda8c167))

## [13.3.0](https://github.com/Krivega/sip-connector/compare/v13.2.0...v13.3.0) (2024-12-07)

### Features

- add proxy methods to SipConnectorFacade ([feda083](https://github.com/Krivega/sip-connector/commit/feda0832d17921675cee934a2d3bb7f923f0cc4c))

## [13.2.0](https://github.com/Krivega/sip-connector/compare/v13.1.0...v13.2.0) (2024-12-07)

### Features

- add proxy methods to SipConnectorFacade ([a8ecdf3](https://github.com/Krivega/sip-connector/commit/a8ecdf36a1a185a206ca07135a5f012322a0e23b))

## [13.1.0](https://github.com/Krivega/sip-connector/compare/v13.0.0...v13.1.0) (2024-12-05)

### Features

- add methods to SipConnectorFacade ([16c447e](https://github.com/Krivega/sip-connector/commit/16c447e4db75a985d88d5e66b3583022510ea1f6))

## [13.0.0](https://github.com/Krivega/sip-connector/compare/v12.2.0...v13.0.0) (2024-12-02)

### ⚠ BREAKING CHANGES

- rename videoMode, audioMode to directionVideo, directionAudio

### Features

- add offerToReceiveAudio, offerToReceiveVideo to call methods ([cb2fabe](https://github.com/Krivega/sip-connector/commit/cb2fabe5c96f2ee85f5ca92841b5b414d5c824a5))

## [12.2.0](https://github.com/Krivega/sip-connector/compare/v12.1.0...v12.2.0) (2024-12-01)

### Features

- extends simulcastEncodings ([70e1ffb](https://github.com/Krivega/sip-connector/commit/70e1ffbb87724bc69c47f3949fedb1ac2694b859))

## [12.1.0](https://github.com/Krivega/sip-connector/compare/v12.0.0...v12.1.0) (2024-11-12)

### Features

- add EMimeTypesVideoCodecs ([0690a9b](https://github.com/Krivega/sip-connector/commit/0690a9b50559352404416cb75c75b8821b32e6a0))

## [12.0.0](https://github.com/Krivega/sip-connector/compare/v11.6.1...v12.0.0) (2024-11-12)

### ⚠ BREAKING CHANGES

- move tools to SipConnectorFacade

### Features

- move tools to SipConnectorFacade ([31aefb4](https://github.com/Krivega/sip-connector/commit/31aefb4a53613f4b106f06f767f1c9027eca8e6b))

### [11.6.1](https://github.com/Krivega/sip-connector/compare/v11.6.0...v11.6.1) (2024-11-11)

## [11.6.0](https://github.com/Krivega/sip-connector/compare/v11.5.0...v11.6.0) (2024-11-11)

### Features

- add excludeMimeTypesVideoCodecs to call methods ([770b876](https://github.com/Krivega/sip-connector/commit/770b8764219a9899ee9403f01044c3e970963506))

## [11.5.0](https://github.com/Krivega/sip-connector/compare/v11.4.0...v11.5.0) (2024-11-08)

### Features

- add preferredMimeTypesVideoCodecs to call methods ([1257845](https://github.com/Krivega/sip-connector/commit/12578453be03db87a6708f10a2a169942378bb41))

## [11.4.0](https://github.com/Krivega/sip-connector/compare/v11.3.0...v11.4.0) (2024-11-06)

### Features

- add tool resolveReplaceMediaStream ([ad37f34](https://github.com/Krivega/sip-connector/commit/ad37f34e840f191c60714de0106c21bcb7ac3bc2))

## [11.3.0](https://github.com/Krivega/sip-connector/compare/v11.2.0...v11.3.0) (2024-11-06)

### Features

- add degradationPreference options to call tools ([a26d663](https://github.com/Krivega/sip-connector/commit/a26d663e7c5ed807d79b6dd96f5fef6a1399e6d8))

## [11.2.0](https://github.com/Krivega/sip-connector/compare/v11.1.0...v11.2.0) (2024-11-06)

### Features

- update participant move request ([#46](https://github.com/Krivega/sip-connector/issues/46)) ([fa31651](https://github.com/Krivega/sip-connector/commit/fa3165136b228cd13dc2f8b550bdc95399628bdd))

## [11.1.0](https://github.com/Krivega/sip-connector/compare/v11.0.0...v11.1.0) (2024-10-26)

### Features

- add simulcastEncodings option to call methods ([d4479ef](https://github.com/Krivega/sip-connector/commit/d4479efb2a19e60ea782e62fde8337d0e3e2eebe))

## [11.0.0](https://github.com/Krivega/sip-connector/compare/v10.0.1...v11.0.0) (2024-10-25)

### ⚠ BREAKING CHANGES

- add sendEncodings option to call methods

### Features

- add sendEncodings option to call methods ([83d99a6](https://github.com/Krivega/sip-connector/commit/83d99a680b149d4703c527e8ec3f70cebe40e387))

### [10.0.1](https://github.com/Krivega/sip-connector/compare/v10.0.0...v10.0.1) (2024-10-25)

### Bug Fixes

- setParametersToSender ([32fc267](https://github.com/Krivega/sip-connector/commit/32fc2678a0050911576105921cc099c513ccf4ca))

## [10.0.0](https://github.com/Krivega/sip-connector/compare/v9.2.1...v10.0.0) (2024-10-25)

### ⚠ BREAKING CHANGES

- add setParametersToSender to call methods

### Features

- add setParametersToSender to call methods ([f8e9e5d](https://github.com/Krivega/sip-connector/commit/f8e9e5d6c2608c3e8176dd6f12dee45bd3aa83d0))

### [9.2.1](https://github.com/Krivega/sip-connector/compare/v9.2.0...v9.2.1) (2024-10-11)

## [9.2.0](https://github.com/Krivega/sip-connector/compare/v9.1.0...v9.2.0) (2024-09-24)

### Features

- add remoteAddress and extraHeaders to checkTelephony ([b25c8d2](https://github.com/Krivega/sip-connector/commit/b25c8d2690e043e3c76b84fef3e05bd1e31982fe))

## [9.1.0](https://github.com/Krivega/sip-connector/compare/v9.0.0...v9.1.0) (2024-09-10)

### Features

- add content hint parameter for call, answer and replace media stream methods ([#45](https://github.com/Krivega/sip-connector/issues/45)) ([c2f8ef4](https://github.com/Krivega/sip-connector/commit/c2f8ef44ce40cab34a4dadfbbc28edae2acfd6c2))

## [9.0.0](https://github.com/Krivega/sip-connector/compare/v8.3.0...v9.0.0) (2024-08-28)

### ⚠ BREAKING CHANGES

- update api of tools

### Features

- update api of tools ([ed82493](https://github.com/Krivega/sip-connector/commit/ed824938c791cd831ceb1a360e245e2db6f34604))

## [8.3.0](https://github.com/Krivega/sip-connector/compare/v8.2.1...v8.3.0) (2024-08-28)

### Features

- add contentHint to presentation ([9818c4f](https://github.com/Krivega/sip-connector/commit/9818c4fe3d522429673d5dcb03893b0f19418754))
- set by default degradationPreference = 'maintain-resolution' for presentation ([8c0de6d](https://github.com/Krivega/sip-connector/commit/8c0de6dc51fdf1e8feaf3160158e4e2fb9765b05))

### [8.2.1](https://github.com/Krivega/sip-connector/compare/v8.2.0...v8.2.1) (2024-07-11)

### Bug Fixes

- sendPresentationWithDuplicatedCalls ([107de54](https://github.com/Krivega/sip-connector/commit/107de54e407167dbf57095c2c1295b274b98a6bf))

## [8.2.0](https://github.com/Krivega/sip-connector/compare/v8.1.0...v8.2.0) (2024-07-05)

### Features

- add options param to resolveStartPresentation ([#43](https://github.com/Krivega/sip-connector/issues/43)) ([c572f25](https://github.com/Krivega/sip-connector/commit/c572f259b55c039918ce5cac2a6e35a7ce1da807))

## [8.1.0](https://github.com/Krivega/sip-connector/compare/v8.0.0...v8.1.0) (2024-07-05)

### Features

- start presentation with retry ([#42](https://github.com/Krivega/sip-connector/issues/42)) ([a6dc727](https://github.com/Krivega/sip-connector/commit/a6dc72722bc87a6b02e847791d8742f7d6cb4082))

## [8.0.0](https://github.com/Krivega/sip-connector/compare/v7.0.10...v8.0.0) (2024-07-03)

### ⚠ BREAKING CHANGES

- use sdp_semantics: 'unified-plan' by default

### Features

- use sdp_semantics: 'unified-plan' by default ([21c52b1](https://github.com/Krivega/sip-connector/commit/21c52b117a82c68274078a140dff60f7652027bb))

### [7.0.10](https://github.com/Krivega/sip-connector/compare/v7.0.9...v7.0.10) (2024-07-03)

### Bug Fixes

- forbidden symbols in app name ([#41](https://github.com/Krivega/sip-connector/issues/41)) ([9b2aff8](https://github.com/Krivega/sip-connector/commit/9b2aff867ab2da1024e2a974300789f2bf725303))

### [7.0.9](https://github.com/Krivega/sip-connector/compare/v7.0.8...v7.0.9) (2024-06-21)

### Bug Fixes

- stringify error message when message is object ([#40](https://github.com/Krivega/sip-connector/issues/40)) ([3d1f9ba](https://github.com/Krivega/sip-connector/commit/3d1f9baf58f7a8581519c6f3c4dc6692879d9b99))

### [7.0.8](https://github.com/Krivega/sip-connector/compare/v7.0.7...v7.0.8) (2024-06-17)

### Bug Fixes

- compare websocket response with error instead array of errors ([#39](https://github.com/Krivega/sip-connector/issues/39)) ([f1fa602](https://github.com/Krivega/sip-connector/commit/f1fa602d2ae2b6913c470fcab2f7092ccfe860f2))

### [7.0.7](https://github.com/Krivega/sip-connector/compare/v7.0.6...v7.0.7) (2024-06-17)

### Bug Fixes

- repeat connect request when handshake websocket opening has failed ([#38](https://github.com/Krivega/sip-connector/issues/38)) ([a6cbc8a](https://github.com/Krivega/sip-connector/commit/a6cbc8a4ca2ecfdde53eb4ad08a6b46999dc3763))

### [7.0.6](https://github.com/Krivega/sip-connector/compare/v7.0.5...v7.0.6) (2024-05-21)

### Bug Fixes

- exports cjs ([14977a6](https://github.com/Krivega/sip-connector/commit/14977a6ec885a3caec5eecaf7d62a7ba819f97fd))

### [7.0.5](https://github.com/Krivega/sip-connector/compare/v7.0.4...v7.0.5) (2024-05-19)

### [7.0.4](https://github.com/Krivega/sip-connector/compare/v7.0.3...v7.0.4) (2024-05-19)

### [7.0.3](https://github.com/Krivega/sip-connector/compare/v7.0.2...v7.0.3) (2024-05-08)

### Bug Fixes

- use async terminate ([f88598f](https://github.com/Krivega/sip-connector/commit/f88598f6335a9801b3ed888885a3e2d5e59b55f2))

### [7.0.2](https://github.com/Krivega/sip-connector/compare/v7.0.1...v7.0.2) (2024-04-24)

### Bug Fixes

- trigger main-cam-control event by RESUME_MAIN_CAM or PAUSE_MAIN_CAM infos ([#37](https://github.com/Krivega/sip-connector/issues/37)) ([559fde4](https://github.com/Krivega/sip-connector/commit/559fde4aa769d6f063ff6b7c1e8599bb29846486))

### [7.0.1](https://github.com/Krivega/sip-connector/compare/v7.0.0...v7.0.1) (2024-04-24)

### Bug Fixes

- enterRoom data format changed ([#36](https://github.com/Krivega/sip-connector/issues/36)) ([eb0c0ce](https://github.com/Krivega/sip-connector/commit/eb0c0ce21ab848a663af5a876ff2e3d497dd7f79))

## [7.0.0](https://github.com/Krivega/sip-connector/compare/v6.25.0...v7.0.0) (2024-04-17)

### ⚠ BREAKING CHANGES

- add X-WEBRTC-PARTICIPANT-NAME to enterroom (#35)

### Features

- add X-WEBRTC-PARTICIPANT-NAME to enterroom ([#35](https://github.com/Krivega/sip-connector/issues/35)) ([1973f1d](https://github.com/Krivega/sip-connector/commit/1973f1dca6ea9717ff6eb802858479a165d2443e))

## [6.25.0](https://github.com/Krivega/sip-connector/compare/v6.24.3...v6.25.0) (2024-04-09)

### Features

- add move-request-to-spectators session event ([#34](https://github.com/Krivega/sip-connector/issues/34)) ([854b4c2](https://github.com/Krivega/sip-connector/commit/854b4c20ccfc0e2b885e91289137ddcab025b4c4))

### [6.24.3](https://github.com/Krivega/sip-connector/compare/v6.24.2...v6.24.3) (2024-03-21)

### Bug Fixes

- add x-webrtc-share-state prefix to sending must-stop-presentation header ([#33](https://github.com/Krivega/sip-connector/issues/33)) ([0991904](https://github.com/Krivega/sip-connector/commit/09919048f62d7780f1a5e1213b897caa99afe7c7))

### [6.24.2](https://github.com/Krivega/sip-connector/compare/v6.24.1...v6.24.2) (2024-03-20)

### Bug Fixes

- stop incoming presentation in p2p-call before start outgoing presentation ([#32](https://github.com/Krivega/sip-connector/issues/32)) ([e3c179a](https://github.com/Krivega/sip-connector/commit/e3c179a52d4913cd9ae0a3339bddb90a9a93a769))

### [6.24.1](https://github.com/Krivega/sip-connector/compare/v6.24.0...v6.24.1) (2024-02-27)

### Bug Fixes

- some types ([af115de](https://github.com/Krivega/sip-connector/commit/af115de2723fa08c9e8e3bb5dce80064b91e2263))

## [6.24.0](https://github.com/Krivega/sip-connector/compare/v6.23.0...v6.24.0) (2024-02-27)

### Features

- add ua in promise of resolveConnectToServer ([ace335f](https://github.com/Krivega/sip-connector/commit/ace335f531e0dee5906144389000ffe485d985c9))

## [6.23.0](https://github.com/Krivega/sip-connector/compare/v6.22.3...v6.23.0) (2024-02-07)

### Features

- add method for check available of telephony ([#31](https://github.com/Krivega/sip-connector/issues/31)) ([b1e0164](https://github.com/Krivega/sip-connector/commit/b1e01646d44f34479313089e084d1282ad495611))

### [6.22.3](https://github.com/Krivega/sip-connector/compare/v6.22.2...v6.22.3) (2024-02-05)

### Bug Fixes

- dependencies ([825bcde](https://github.com/Krivega/sip-connector/commit/825bcde4b34c35fe570f3db8a976b8f59dced2a6))

### [6.22.2](https://github.com/Krivega/sip-connector/compare/v6.22.1...v6.22.2) (2024-02-02)

### Bug Fixes

- dependencies ([21234b4](https://github.com/Krivega/sip-connector/commit/21234b43d1e698337e4358d285ddf34fbf87eb5b))

### [6.22.1](https://github.com/Krivega/sip-connector/compare/v6.22.0...v6.22.1) (2024-01-31)

### Bug Fixes

- support chrome 91 ([5e8eccc](https://github.com/Krivega/sip-connector/commit/5e8eccc6a28ff905683c6eec23271c79f17ff3e2))

## [6.22.0](https://github.com/Krivega/sip-connector/compare/v6.21.7...v6.22.0) (2023-11-27)

### Features

- change accept and request word processing ([#30](https://github.com/Krivega/sip-connector/issues/30)) ([89df992](https://github.com/Krivega/sip-connector/commit/89df99229ab241d92110e224ed9681efcceca72d))

### [6.21.7](https://github.com/Krivega/sip-connector/compare/v6.21.6...v6.21.7) (2023-10-25)

### Bug Fixes

- types ([0712b9f](https://github.com/Krivega/sip-connector/commit/0712b9ff6ffa112f7d72e0e1dead80941e84b477))

### [6.21.6](https://github.com/Krivega/sip-connector/compare/v6.21.5...v6.21.6) (2023-10-24)

### [6.21.5](https://github.com/Krivega/sip-connector/compare/v6.21.4...v6.21.5) (2023-10-24)

### [6.21.4](https://github.com/Krivega/sip-connector/compare/v6.21.3...v6.21.4) (2023-10-24)

### [6.21.3](https://github.com/Krivega/sip-connector/compare/v6.21.2...v6.21.3) (2023-10-24)

### [6.21.2](https://github.com/Krivega/sip-connector/compare/v6.21.1...v6.21.2) (2023-10-24)

### [6.21.1](https://github.com/Krivega/sip-connector/compare/v6.21.0...v6.21.1) (2023-10-24)

## [6.21.0](https://github.com/Krivega/sip-connector/compare/v6.20.1...v6.21.0) (2023-10-24)

### Features

- export doMock ([3b9d625](https://github.com/Krivega/sip-connector/commit/3b9d625dea4f6355c0453f6cc60f4587c1ebf8bf))
- export doMock ([eac1412](https://github.com/Krivega/sip-connector/commit/eac14122df13de4247d111df34bd46cb978f9642))

### [6.20.1](https://github.com/Krivega/sip-connector/compare/v6.20.0...v6.20.1) (2023-10-24)

### Bug Fixes

- types ([1c8abc3](https://github.com/Krivega/sip-connector/commit/1c8abc3f7290311345d7ba02587534b76a86e3ff))

## [6.20.0](https://github.com/Krivega/sip-connector/compare/v6.19.0...v6.20.0) (2023-10-24)

### Features

- export constants ([c52e585](https://github.com/Krivega/sip-connector/commit/c52e585c32b4880ed9b450e0cf63e27e79a28934))

## [6.19.0](https://github.com/Krivega/sip-connector/compare/v6.18.0...v6.19.0) (2023-10-24)

### Features

- improve types ([8ceaa21](https://github.com/Krivega/sip-connector/commit/8ceaa2114b2b08c820de1df7ecc104d48f8b831e))

## [6.18.0](https://github.com/Krivega/sip-connector/compare/v6.17.0...v6.18.0) (2023-10-08)

### Features

- getUserAgent ([fd17f21](https://github.com/Krivega/sip-connector/commit/fd17f21f8d99aaede3c485fad6666f935ce0c7a3))

## [6.17.0](https://github.com/Krivega/sip-connector/compare/v6.16.0...v6.17.0) (2023-10-08)

### Features

- getExtraHeaders ([402b55b](https://github.com/Krivega/sip-connector/commit/402b55ba822016b196ed50ff750d44db70d1e835))

## [6.16.0](https://github.com/Krivega/sip-connector/compare/v6.15.0...v6.16.0) (2023-09-21)

### Features

- add tools ([ab701ad](https://github.com/Krivega/sip-connector/commit/ab701ad5f69ff1992af65f19a4449c8ae722321b))

## [6.15.0](https://github.com/Krivega/sip-connector/compare/v6.14.0...v6.15.0) (2023-09-21)

### Features

- add tools ([e79e8a9](https://github.com/Krivega/sip-connector/commit/e79e8a9342aec7a9a396c01fd948974b97ad91a6))

## [6.14.0](https://github.com/Krivega/sip-connector/compare/v6.13.4...v6.14.0) (2023-09-21)

### Features

- add tools ([84499d7](https://github.com/Krivega/sip-connector/commit/84499d77d3782c4705934c2847240227c9d99182))

### [6.13.4](https://github.com/Krivega/sip-connector/compare/v6.13.3...v6.13.4) (2023-09-12)

### [6.13.3](https://github.com/Krivega/sip-connector/compare/v6.13.2...v6.13.3) (2023-09-12)

### [6.13.2](https://github.com/Krivega/sip-connector/compare/v6.13.1...v6.13.2) (2023-08-24)

### [6.13.1](https://github.com/Krivega/sip-connector/compare/v6.13.0...v6.13.1) (2023-08-24)

## [6.13.0](https://github.com/Krivega/sip-connector/compare/v6.12.0...v6.13.0) (2023-08-24)

### Features

- add setBitrateByTrackResolution to videoSendingBalancer ([1776067](https://github.com/Krivega/sip-connector/commit/177606718a7a206268a1b8a8694bb6d3183e36fc))

### Bug Fixes

- rename **mocks** to **fixtures** ([c3784dd](https://github.com/Krivega/sip-connector/commit/c3784dd6f0338cba3a09c4c34c5b81db672cb0ba))

## [6.12.0](https://github.com/Krivega/sip-connector/compare/v6.11.0...v6.12.0) (2023-07-26)

### Features

- add factor of max bitrate for av1 codec ([25d5aa9](https://github.com/Krivega/sip-connector/commit/25d5aa90930922e286ee4ca249744c88afe24d52))

## [6.11.0](https://github.com/Krivega/sip-connector/compare/v6.10.0...v6.11.0) (2023-07-14)

### Features

- add updatePresentation ([4f0a037](https://github.com/Krivega/sip-connector/commit/4f0a037d56349326db6f2b6af0ac9bf318d9b470))

## [6.10.0](https://github.com/Krivega/sip-connector/compare/v6.9.2...v6.10.0) (2023-07-03)

### Features

- add sendRefusalToTurnOnCam and sendRefusalToTurnOnMic ([3c63f66](https://github.com/Krivega/sip-connector/commit/3c63f66e44e52c9038e02e6d4d5abab97917087b))

### [6.9.2](https://github.com/Krivega/sip-connector/compare/v6.9.1...v6.9.2) (2023-06-20)

### Bug Fixes

- stop presentation when start in progress ([c1d2802](https://github.com/Krivega/sip-connector/commit/c1d2802d2b823478738649cddd51b824e1c4b2e5))

### [6.9.1](https://github.com/Krivega/sip-connector/compare/v6.9.0...v6.9.1) (2023-06-06)

## [6.9.0](https://github.com/Krivega/sip-connector/compare/v6.8.0...v6.9.0) (2023-05-29)

### Features

- process use license info ([#27](https://github.com/Krivega/sip-connector/issues/27)) ([12c5d42](https://github.com/Krivega/sip-connector/commit/12c5d4241cad1f0ee075a27674a917d92e68d914))

## [6.8.0](https://github.com/Krivega/sip-connector/compare/v6.7.1...v6.8.0) (2023-05-14)

### Features

- add offerToReceiveAudio, offerToReceiveVideo to params of call ([371546f](https://github.com/Krivega/sip-connector/commit/371546f22674b6b49f308a8530cc74882bc8b6b4))

### [6.7.1](https://github.com/Krivega/sip-connector/compare/v6.7.0...v6.7.1) (2023-04-05)

## [6.7.0](https://github.com/Krivega/sip-connector/compare/v6.6.1...v6.7.0) (2023-02-27)

### Features

- implement process media sync info event ([#26](https://github.com/Krivega/sip-connector/issues/26)) ([73c914e](https://github.com/Krivega/sip-connector/commit/73c914e70822ee20f67248d472b2cd6885abfbc1))

### [6.6.1](https://github.com/Krivega/sip-connector/compare/v6.6.0...v6.6.1) (2022-12-06)

### Bug Fixes

- trigger terminated incoming session when failed from local ([#25](https://github.com/Krivega/sip-connector/issues/25)) ([3744114](https://github.com/Krivega/sip-connector/commit/3744114437024f7038c85d58a0144ebf4963ef30))

## [6.6.0](https://github.com/Krivega/sip-connector/compare/v6.5.0...v6.6.0) (2022-11-29)

### Features

- add ping and sendOptions ([8a8daf6](https://github.com/Krivega/sip-connector/commit/8a8daf65f47d2b833ad9c7538a403030a6e5ab37))

## [6.5.0](https://github.com/Krivega/sip-connector/compare/v6.4.4...v6.5.0) (2022-11-14)

### Features

- add notify sync media state mode ([#24](https://github.com/Krivega/sip-connector/issues/24)) ([f00737e](https://github.com/Krivega/sip-connector/commit/f00737ea6a14154ac00e353069d1a73c042cc6ad))

### [6.4.4](https://github.com/Krivega/sip-connector/compare/v6.4.3...v6.4.4) (2022-11-14)

### Bug Fixes

- return promise in sendChannels ([48297e8](https://github.com/Krivega/sip-connector/commit/48297e86a05b8c5e48223fd8d40fbca393880def))

### [6.4.3](https://github.com/Krivega/sip-connector/compare/v6.4.2...v6.4.3) (2022-11-08)

### Bug Fixes

- do not trigger FAILED_INCOMING_CALL for declined ([04d5fb7](https://github.com/Krivega/sip-connector/commit/04d5fb75d5e20b317af4b8d998e58688aaa50f70))

### [6.4.2](https://github.com/Krivega/sip-connector/compare/v6.4.1...v6.4.2) (2022-10-13)

### [6.4.1](https://github.com/Krivega/sip-connector/compare/v6.4.0...v6.4.1) (2022-10-07)

## [6.4.0](https://github.com/Krivega/sip-connector/compare/v6.3.3...v6.4.0) (2022-10-07)

### Features

- add degradationPreference options to call, answer and startPresentation ([fa91573](https://github.com/Krivega/sip-connector/commit/fa91573c53a53219df5beb25bdcc9542386b5d3e))

### [6.3.3](https://github.com/Krivega/sip-connector/compare/v6.3.2...v6.3.3) (2022-08-28)

### [6.3.2](https://github.com/Krivega/sip-connector/compare/v6.3.1...v6.3.2) (2022-08-12)

### Bug Fixes

- calls without mics or cams ([113d8ff](https://github.com/Krivega/sip-connector/commit/113d8ff18ee2be318fc11aa0f78fdea361b38836))

### [6.3.1](https://github.com/Krivega/sip-connector/compare/v6.3.0...v6.3.1) (2022-08-08)

## [6.3.0](https://github.com/Krivega/sip-connector/compare/v6.2.0...v6.3.0) (2022-08-08)

### Features

- add videoMode, audioMode options to answer ([30ca8e5](https://github.com/Krivega/sip-connector/commit/30ca8e50a49fb284de83af499e5d60e15dcaeb59))

## [6.2.0](https://github.com/Krivega/sip-connector/compare/v6.1.0...v6.2.0) (2022-08-05)

### Features

- add videoMode, audioMode options to call ([0b9d3db](https://github.com/Krivega/sip-connector/commit/0b9d3db2ad92641f508a83e4d4945c172e7d3a29))

## [6.1.0](https://github.com/Krivega/sip-connector/compare/v6.0.2...v6.1.0) (2022-07-11)

### Features

- move userAgent to params of connect ([#23](https://github.com/Krivega/sip-connector/issues/23)) ([12093af](https://github.com/Krivega/sip-connector/commit/12093af714f896cfed91596875146baf64236efd))

### [6.0.2](https://github.com/Krivega/sip-connector/compare/v6.0.1...v6.0.2) (2022-06-07)

### [6.0.1](https://github.com/Krivega/sip-connector/compare/v6.0.0...v6.0.1) (2022-05-31)

### Bug Fixes

- **videoSendingBalancer:** call MAX_MAIN_CAM_RESOLUTION, PAUSE_MAIN_CAM ([00a96e0](https://github.com/Krivega/sip-connector/commit/00a96e08540785da212141db03e1f037fc322ca9))

## [6.0.0](https://github.com/Krivega/sip-connector/compare/v5.6.1...v6.0.0) (2022-05-27)

### ⚠ BREAKING CHANGES

- disable autoSubscription

- feat!(videoSendingBalancer): add reBalance ([a40c96e](https://github.com/Krivega/sip-connector/commit/a40c96e3f0b5d3a20f0f923ade8c65e8029df722))

### [5.6.1](https://github.com/Krivega/sip-connector/compare/v5.6.0...v5.6.1) (2022-05-19)

### Bug Fixes

- return promise from sendMediaState method for handling reject ([#20](https://github.com/Krivega/sip-connector/issues/20)) ([1c44f2a](https://github.com/Krivega/sip-connector/commit/1c44f2a4f707ee3f5d0009b1d9e2c11157ec0f14))

## [5.6.0](https://github.com/Krivega/sip-connector/compare/v5.5.2...v5.6.0) (2022-05-17)

### Features

- add onceRace, onceRaceSession ([f056c76](https://github.com/Krivega/sip-connector/commit/f056c760727bf3b4be1ea9070d22efe770172069))

### [5.5.2](https://github.com/Krivega/sip-connector/compare/v5.5.1...v5.5.2) (2022-05-13)

### [5.5.1](https://github.com/Krivega/sip-connector/compare/v5.5.0...v5.5.1) (2022-05-13)

## [5.5.0](https://github.com/Krivega/sip-connector/compare/v5.4.0...v5.5.0) (2022-05-12)

### Features

- **sip-connector:** added remote control media state info handlers ([#18](https://github.com/Krivega/sip-connector/issues/18)) ([bcbeff3](https://github.com/Krivega/sip-connector/commit/bcbeff3bdb3215ba7ac2a200fd5be6992e64091f))

## [5.4.0](https://github.com/Krivega/sip-connector/compare/v5.3.1...v5.4.0) (2022-05-11)

### Features

- add option forceRenegotiation to replaceMediaStream ([4409d4c](https://github.com/Krivega/sip-connector/commit/4409d4ccd2992ec7f512c4af8ffb9821ad5ab603))

### [5.3.1](https://github.com/Krivega/sip-connector/compare/v5.3.0...v5.3.1) (2022-05-06)

### Bug Fixes

- move some session events into ua events ([#19](https://github.com/Krivega/sip-connector/issues/19)) ([f17daaf](https://github.com/Krivega/sip-connector/commit/f17daaf832f35c441d6da3c84b21c16e2e10325d))

## [5.3.0](https://github.com/Krivega/sip-connector/compare/v5.2.0...v5.3.0) (2022-04-22)

### Features

- process decline unmute in askPermission function ([#17](https://github.com/Krivega/sip-connector/issues/17)) ([863538d](https://github.com/Krivega/sip-connector/commit/863538dd8893dae502f48856acee28ad0051307d))

## [5.2.0](https://github.com/Krivega/sip-connector/compare/v5.1.7...v5.2.0) (2022-04-14)

### Features

- added info messages and requests to enable cam and mic ([#16](https://github.com/Krivega/sip-connector/issues/16)) ([9242579](https://github.com/Krivega/sip-connector/commit/92425798140be6e7913d3d49ddac3f4c452e030a))

### [5.1.7](https://github.com/Krivega/sip-connector/compare/v5.1.6...v5.1.7) (2022-03-24)

### [5.1.6](https://github.com/Krivega/sip-connector/compare/v5.1.5...v5.1.6) (2022-03-11)

### Bug Fixes

- correct value max bitrate ([47c9926](https://github.com/Krivega/sip-connector/commit/47c992694fb60f22e8f1edbf939276cefb123610))

### [5.1.5](https://github.com/Krivega/sip-connector/compare/v5.1.4...v5.1.5) (2022-03-03)

### [5.1.4](https://github.com/Krivega/sip-connector/compare/v5.1.3...v5.1.4) (2022-02-14)

### Bug Fixes

- stopPresentation before hengUp ([627753f](https://github.com/Krivega/sip-connector/commit/627753ff8a44aad28826d59716e430166005945d))

### [5.1.3](https://github.com/Krivega/sip-connector/compare/v5.1.2...v5.1.3) (2022-02-14)

### Bug Fixes

- restore session after terminate from server ([ff3de59](https://github.com/Krivega/sip-connector/commit/ff3de591db0b5d50b02edc90e384f5a4d54959e9))

### [5.1.2](https://github.com/Krivega/sip-connector/compare/v5.1.1...v5.1.2) (2022-02-09)

### [5.1.1](https://github.com/Krivega/sip-connector/compare/v5.1.0...v5.1.1) (2022-02-07)

## [5.1.0](https://github.com/Krivega/sip-connector/compare/v5.0.1...v5.1.0) (2022-02-07)

### Features

- participant token issued notify ([#14](https://github.com/Krivega/sip-connector/issues/14)) ([d9426ee](https://github.com/Krivega/sip-connector/commit/d9426ee63370d5dab108dba966c579601eae6eca))

### [5.0.1](https://github.com/Krivega/sip-connector/compare/v5.0.0...v5.0.1) (2021-11-12)

### Bug Fixes

- check codec in videoSendingBalance ([b7a66a8](https://github.com/Krivega/sip-connector/commit/b7a66a88d9681913eabcccde281d2ed3e72c2d71))

## [5.0.0](https://github.com/Krivega/sip-connector/compare/v4.1.0...v5.0.0) (2021-11-12)

### ⚠ BREAKING CHANGES

- change params for videoSendingBalancer

### Features

- add ignore codec for balancer ([#13](https://github.com/Krivega/sip-connector/issues/13)) ([d4dd76d](https://github.com/Krivega/sip-connector/commit/d4dd76d35912337484449aa3c97e960ec047696b))

- change params for videoSendingBalancer ([77b4a7b](https://github.com/Krivega/sip-connector/commit/77b4a7bd594b61b7d5bcc49c2033be524a6cfd6a))

## [4.1.0](https://github.com/Krivega/sip-connector/compare/v4.0.1...v4.1.0) (2021-11-11)

### Features

- new events to session ([#12](https://github.com/Krivega/sip-connector/issues/12)) ([c447eeb](https://github.com/Krivega/sip-connector/commit/c447eeb2cbe262813882792bbb77b4c642ea8c1c))

### [4.0.1](https://github.com/Krivega/sip-connector/compare/v4.0.0...v4.0.1) (2021-11-09)

### Bug Fixes

- remove throttle from VideoSendingBalancer ([eed38a3](https://github.com/Krivega/sip-connector/commit/eed38a38a6e77b56080d8226f3b659a10804e0f1))

## [4.0.0](https://github.com/Krivega/sip-connector/compare/v3.1.1...v4.0.0) (2021-11-08)

### ⚠ BREAKING CHANGES

- move some events to session

### Bug Fixes

- move some events to session ([c635045](https://github.com/Krivega/sip-connector/commit/c6350453f967805eab721961ec58202efc13d46e))

### [3.1.1](https://github.com/Krivega/sip-connector/compare/v3.1.0...v3.1.1) (2021-11-02)

### Bug Fixes

- add params to connect ([0916ebb](https://github.com/Krivega/sip-connector/commit/0916ebb4f385ed2cb284f80ee8dd052aa688dec5))

## [3.1.0](https://github.com/Krivega/sip-connector/compare/v3.0.0...v3.1.0) (2021-11-02)

### Features

- add params to connect ([64830cc](https://github.com/Krivega/sip-connector/commit/64830cc16a230168c331e7ff07533e9ff7413ec7))

## [3.0.0](https://github.com/Krivega/sip-connector/compare/v2.9.0...v3.0.0) (2021-11-01)

### ⚠ BREAKING CHANGES

- start/end presentation for p2p

### Features

- start/end presentation for p2p ([95db761](https://github.com/Krivega/sip-connector/commit/95db7612588a205ea5baeaccee1d730807be7c30))

## [2.9.0](https://github.com/Krivega/sip-connector/compare/v2.8.0...v2.9.0) (2021-10-29)

### Features

- set optional send headers for presentation ([c1a2332](https://github.com/Krivega/sip-connector/commit/c1a23324618b71103c6b88734cf3b5c6b594e81b))

## [2.8.0](https://github.com/Krivega/sip-connector/compare/v2.7.0...v2.8.0) (2021-10-28)

### Features

- add onSetParameters to VideoSendingBalancer ([d5624db](https://github.com/Krivega/sip-connector/commit/d5624db42fe395a94a8c8935c6f7c93f6bbdfd6a))

## [2.7.0](https://github.com/Krivega/sip-connector/compare/v2.6.1...v2.7.0) (2021-10-18)

### Features

- add subscribe, unsubscribe to resolveVideoSendingBalancer ([f3cb8d5](https://github.com/Krivega/sip-connector/commit/f3cb8d59ded5f7fca16a34cdc7583d567e02629d))

### [2.6.1](https://github.com/Krivega/sip-connector/compare/v2.6.0...v2.6.1) (2021-10-06)

### Bug Fixes

- set max bitrate ([1e7cefd](https://github.com/Krivega/sip-connector/commit/1e7cefddd743160588c9eac907efefb8688e5aad))

## [2.6.0](https://github.com/Krivega/sip-connector/compare/v2.5.1...v2.6.0) (2021-10-05)

### Features

- add control bitrate to videoSendingBalancer‎ ([2ee9a7a](https://github.com/Krivega/sip-connector/commit/2ee9a7a748b90db97f2cc09e686524ad6233b648))

### [2.5.1](https://github.com/Krivega/sip-connector/compare/v2.5.0...v2.5.1) (2021-09-09)

### Bug Fixes

- handle disconnect error ([63cf844](https://github.com/Krivega/sip-connector/commit/63cf844e28d3a89f02565eeeb0101c547e0c15b9))

## [2.5.0](https://github.com/Krivega/sip-connector/compare/v2.4.1...v2.5.0) (2021-09-01)

### Features

- add event participant:canceling-word-request ([676e0b2](https://github.com/Krivega/sip-connector/commit/676e0b21444259caa4dd21431e6f1db975a3bd07))

### [2.4.1](https://github.com/Krivega/sip-connector/compare/v2.4.0...v2.4.1) (2021-09-01)

### Bug Fixes

- conference for reqests to move participant ([31ccba7](https://github.com/Krivega/sip-connector/commit/31ccba7cb49f5230fd62b174a8ff559218d9a12b))

## [2.4.0](https://github.com/Krivega/sip-connector/compare/v2.3.3...v2.4.0) (2021-08-31)

### Features

- add events for handle reqests to move participant ([91d4022](https://github.com/Krivega/sip-connector/commit/91d40220f2124677314bba79ea67b686d25d84c1))

### [2.3.3](https://github.com/Krivega/sip-connector/compare/v2.3.2...v2.3.3) (2021-08-27)

### [2.3.2](https://github.com/Krivega/sip-connector/compare/v2.3.1...v2.3.2) (2021-08-20)

### [2.3.1](https://github.com/Krivega/sip-connector/compare/v2.3.0...v2.3.1) (2021-07-28)

### Bug Fixes

- notify ([8e0f7d0](https://github.com/Krivega/sip-connector/commit/8e0f7d0b4b865f14649754a8584bec8764f9ea9d))

## [2.3.0](https://github.com/Krivega/sip-connector/compare/v2.2.1...v2.3.0) (2021-07-28)

### Features

- **sip-connector:** add participant events listeners ([#9](https://github.com/Krivega/sip-connector/issues/9)) ([14f7647](https://github.com/Krivega/sip-connector/commit/14f7647f7df2d6f2190439bafb94747ce0266f0f))

### [2.2.1](https://github.com/Krivega/sip-connector/compare/v2.2.0...v2.2.1) (2021-07-07)

### Bug Fixes

- hangUp for only active session ([#8](https://github.com/Krivega/sip-connector/issues/8)) ([60c53a6](https://github.com/Krivega/sip-connector/commit/60c53a6d227161cd6ea75c19fe5b026f9811d2be))

## [2.2.0](https://github.com/Krivega/sip-connector/compare/v2.1.0...v2.2.0) (2021-05-17)

### Features

- add maxBitrate to startPresentation ([bbafd3d](https://github.com/Krivega/sip-connector/commit/bbafd3de8b1d1bb49ef7271aa6b0a04d8a2d5132))

## [2.1.0](https://github.com/Krivega/sip-connector/compare/v2.0.0...v2.1.0) (2021-05-12)

### Features

- **sip-connector:** listen info and notify messages for channels ([#6](https://github.com/Krivega/sip-connector/issues/6)) ([b43692d](https://github.com/Krivega/sip-connector/commit/b43692d8e6f12ab1540c3d9757a389c1cc992b78))

### Bug Fixes

- add options to replaceMediaStream ([6f3be97](https://github.com/Krivega/sip-connector/commit/6f3be97fd40858667c04e02f45d6a947fbd10cd6))

## [2.0.0](https://github.com/Krivega/sip-connector/compare/v1.0.1...v2.0.0) (2021-04-30)

### ⚠ BREAKING CHANGES

- sdpSemantics removed from constructor

### Features

- move param sdpSemantics to connect ([e12214f](https://github.com/Krivega/sip-connector/commit/e12214f1cb806733b733ebf66897fff1407c5bb2))

### [1.0.1](https://github.com/Krivega/sip-connector/compare/v1.0.0...v1.0.1) (2021-04-27)

### Bug Fixes

- send remoteAddress in headers ([684387a](https://github.com/Krivega/sip-connector/commit/684387aee65798009acf376b8e4884daa28f98ec))

## [1.0.0](https://github.com/Krivega/sip-connector/compare/v0.1.4...v1.0.0) (2021-04-27)

### ⚠ BREAKING CHANGES

- remove public method start

### Bug Fixes

- **sip-connector:** set correct context for generate audio stream method ([#4](https://github.com/Krivega/sip-connector/issues/4)) ([4463ec5](https://github.com/Krivega/sip-connector/commit/4463ec5a240227feaea68ca69015e2c499572505))
- send extraheaders when connect ([d0c88ec](https://github.com/Krivega/sip-connector/commit/d0c88ec6a9904caa1c210847f8cf7c19d6fff270))

### [0.1.4](https://github.com/Krivega/sip-connector/compare/v0.1.3...v0.1.4) (2021-04-26)

### Features

- **sip-connector:** add only-audio-mode support + module test ([cece1a0](https://github.com/Krivega/sip-connector/commit/cece1a001bae7956306391fb567c477474bb52f2))

### [0.1.3](https://github.com/Krivega/sip-connector/compare/v0.1.2...v0.1.3) (2021-04-26)

### Bug Fixes

- race condition vdeoSendingBalancer after disconnect ([e8db447](https://github.com/Krivega/sip-connector/commit/e8db447c756fb46f4769da677fe938f40f107edd))

### [0.1.2](https://github.com/Krivega/sip-connector/compare/v0.1.1...v0.1.2) (2021-04-23)

### Bug Fixes

- conflict videoSendingBalancer‎ with output info ([76221c4](https://github.com/Krivega/sip-connector/commit/76221c4cab8a4d16ffdcf69453bfbb40338da9c2))

### [0.1.1](https://github.com/Krivega/sip-connector/compare/v0.1.0...v0.1.1) (2021-04-23)

### Bug Fixes

- add export resolveVideoSendingBalancer to index ([9ea20f5](https://github.com/Krivega/sip-connector/commit/9ea20f5e95bf32a04ff5cb0dd25912bdeb9e8b56))

## [0.1.0](https://github.com/Krivega/sip-connector/compare/v0.0.3...v0.1.0) (2021-04-23)

### Features

- add videoSendingBalancer‎ ([54181e3](https://github.com/Krivega/sip-connector/commit/54181e3479fa17955b19fe599ae411db311d7762))

### [0.0.3](https://github.com/Krivega/sip-connector/compare/v0.0.2...v0.0.3) (2021-04-20)

### 0.0.2 (2021-04-19)
