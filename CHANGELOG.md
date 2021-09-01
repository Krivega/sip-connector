# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
