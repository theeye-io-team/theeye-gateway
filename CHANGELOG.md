# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.18.3](https://github.com/theeye-io-team/theeye-gateway/compare/1.18.2...1.18.3) (2023-12-22)


### Bug Fixes

* capture all errors ([#48](https://github.com/theeye-io-team/theeye-gateway/issues/48)) ([0f58b5c](https://github.com/theeye-io-team/theeye-gateway/commit/0f58b5c66d3be92811c4f0101acd6b9147eda712))

### [1.18.2](https://github.com/theeye-io-team/theeye-gateway/compare/1.18.1...1.18.2) (2023-12-14)


### Bug Fixes

* capture error when cookie config is not set ([#44](https://github.com/theeye-io-team/theeye-gateway/issues/44)) ([da92155](https://github.com/theeye-io-team/theeye-gateway/commit/da921555412579ef7982ad535d5003ddfc5c56f4))
* ensure recipients values are strings ([#45](https://github.com/theeye-io-team/theeye-gateway/issues/45)) ([1d0bf07](https://github.com/theeye-io-team/theeye-gateway/commit/1d0bf07b9ed55c9f41da0d49b5da9601503d234d))
* send activation email with activation link ([#46](https://github.com/theeye-io-team/theeye-gateway/issues/46)) ([bb9d130](https://github.com/theeye-io-team/theeye-gateway/commit/bb9d130525a7f1fee9fc528d1f15434217b8b53d))

### [1.18.1](https://github.com/theeye-io-team/theeye-gateway/compare/1.18.0...1.18.1) (2023-11-29)


### Bug Fixes

* some events doesn't has a model ([408909a](https://github.com/theeye-io-team/theeye-gateway/commit/408909a5fec9e60945bb84ca1c943c7282646831))

## [1.18.0](https://github.com/theeye-io-team/theeye-gateway/compare/1.17.0...1.18.0) (2023-11-06)


### Features

* credential added to session token ([85af1a7](https://github.com/theeye-io-team/theeye-gateway/commit/85af1a731cbb5cf08a462894951281afbcc7862a))

## [1.17.0](https://github.com/theeye-io-team/theeye-gateway/compare/1.16.2...1.17.0) (2023-10-25)


### Features

* acl's using tag members and roles ([#40](https://github.com/theeye-io-team/theeye-gateway/issues/40)) ([e17d075](https://github.com/theeye-io-team/theeye-gateway/commit/e17d075d40804c9bfbecdac64958f4fc4414f6af))


### Bug Fixes

* doesn't filter socket notifications ([#43](https://github.com/theeye-io-team/theeye-gateway/issues/43)) ([35a3210](https://github.com/theeye-io-team/theeye-gateway/commit/35a3210334ff38aee092db6743727480acf0d03d))
* patch member tags ([#42](https://github.com/theeye-io-team/theeye-gateway/issues/42)) ([44d1007](https://github.com/theeye-io-team/theeye-gateway/commit/44d1007ac82c899b2a3de94e6a946ce8b83cee71))
* return status code 204 if logo is unavailable ([baa2d8d](https://github.com/theeye-io-team/theeye-gateway/commit/baa2d8d79f6028c55c243da870ee7af3c407cc0f))

### [1.16.2](https://github.com/theeye-io-team/theeye-gateway/compare/1.16.1...1.16.2) (2023-08-22)


### Bug Fixes

* added origin/url to token notification ([#41](https://github.com/theeye-io-team/theeye-gateway/issues/41)) ([3772c01](https://github.com/theeye-io-team/theeye-gateway/commit/3772c0162cc60b8de4b52fd205695c21de37dd38))

### [1.16.1](https://github.com/theeye-io-team/theeye-gateway/compare/1.16.0...1.16.1) (2023-08-15)


### Bug Fixes

* added validations and req dump ([738e348](https://github.com/theeye-io-team/theeye-gateway/commit/738e3481df23d739035a687b1a3f2bc2e3508669))
* customer change must change session cookie ([589d880](https://github.com/theeye-io-team/theeye-gateway/commit/589d8806145a6646550e88ba503a705636b23165))
* ldap w/basic auth ([#39](https://github.com/theeye-io-team/theeye-gateway/issues/39)) ([a38361d](https://github.com/theeye-io-team/theeye-gateway/commit/a38361d1afdb4db27b28cf5978c56bfcc505d141))

## [1.16.0](https://github.com/theeye-io-team/theeye-gateway/compare/1.15.1...1.16.0) (2023-07-28)


### Features

* map of tags ([#38](https://github.com/theeye-io-team/theeye-gateway/issues/38)) ([256b9bc](https://github.com/theeye-io-team/theeye-gateway/commit/256b9bc29bcbee88e57d33683b9d9448304072b6))
* **member:** member scope ([9c94573](https://github.com/theeye-io-team/theeye-gateway/commit/9c94573d3c684b3218c8956a58b5ab9a72917582))
* whitelabel logo ([#36](https://github.com/theeye-io-team/theeye-gateway/issues/36)) ([0257cf6](https://github.com/theeye-io-team/theeye-gateway/commit/0257cf6606c2bcc2ce806f932fe9f9964f83f457))

### [1.15.1](https://github.com/theeye-io-team/theeye-gateway/compare/1.15.0...1.15.1) (2023-07-19)


### Bug Fixes

* customer alias validation ([#37](https://github.com/theeye-io-team/theeye-gateway/issues/37)) ([8aaca04](https://github.com/theeye-io-team/theeye-gateway/commit/8aaca04a7d4db7f3b8a3cd9903bb28a1d9d6433f))

## [1.15.0](https://github.com/theeye-io-team/theeye-gateway/compare/1.14.0...1.15.0) (2023-07-14)


### Features

* fetch profile using scopes ([37e7b43](https://github.com/theeye-io-team/theeye-gateway/commit/37e7b4394f65a0f46739d1d0a3b45f7df057c297))

## [1.14.0](https://github.com/theeye-io-team/theeye-gateway/compare/1.13.0...1.14.0) (2023-07-12)


### Features

* configure new jwt verification flow ([fc74b6a](https://github.com/theeye-io-team/theeye-gateway/commit/fc74b6a421d88e929069175739d29c202643e3b2))
* **notifications:** jwt verify configurable ([2577719](https://github.com/theeye-io-team/theeye-gateway/commit/2577719f925a032f9a5441d7c2cd857ed9d11bd5))


### Bug Fixes

* register last access before jwt verify ([92d7f94](https://github.com/theeye-io-team/theeye-gateway/commit/92d7f940a0f55b37e023a31ea2370a127965b054))
* wait session.save before continue ([076f9d4](https://github.com/theeye-io-team/theeye-gateway/commit/076f9d4667a6d705084927532c53b1afdc9a6a43))

## [1.13.0](https://github.com/theeye-io-team/theeye-gateway/compare/1.12.9...1.13.0) (2023-07-11)


### Features

* cookie configurable better name ([#35](https://github.com/theeye-io-team/theeye-gateway/issues/35)) ([26f9ad2](https://github.com/theeye-io-team/theeye-gateway/commit/26f9ad24496f7600e6047cb70fa10e82cf970331))
* jwt pub/priv keys. cookies enabled ([#32](https://github.com/theeye-io-team/theeye-gateway/issues/32)) ([1afe73d](https://github.com/theeye-io-team/theeye-gateway/commit/1afe73dc87620466fe55f951251ea5d1e11336ab))
* standard-version ([ca1fd5f](https://github.com/theeye-io-team/theeye-gateway/commit/ca1fd5f6a31592929e3edf934e3ea4bfe83a0c35))


### Bug Fixes

* add prop validation ([50e12b4](https://github.com/theeye-io-team/theeye-gateway/commit/50e12b4f0fcdf1e1635a0a5606504b75607888df))
* error message ([e44cea0](https://github.com/theeye-io-team/theeye-gateway/commit/e44cea0856cae1891939280fa2783ad7b70f3858))
* socket CORS origin ([947f749](https://github.com/theeye-io-team/theeye-gateway/commit/947f7493baab34d693092b9f7c606c24a672a471))
