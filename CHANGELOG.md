# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
