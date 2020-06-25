# redux-local-storage

[![Build Status - Travis CI](https://img.shields.io/travis/weavedev/redux-local-storage.svg)](https://travis-ci.org/weavedev/redux-local-storage)
[![Test Coverage - Code Climate](https://img.shields.io/codeclimate/coverage/weavedev/redux-local-storage.svg)](https://codeclimate.com/github/weavedev/redux-local-storage/test_coverage)
[![GPL-3.0](https://img.shields.io/github/license/weavedev/redux-local-storage.svg)](https://github.com/weavedev/redux-local-storage/blob/master/LICENSE)
[![NPM](https://img.shields.io/npm/v/@weavedev/redux-local-storage.svg)](https://www.npmjs.com/package/@weavedev/redux-local-storage)

LocalStorage management wrapper for [reduxables](https://github.com/weavedev/reduxable/) like [redux-async](https://github.com/weavedev/redux-async/).

## Install

```
npm i @weavedev/redux-local-storage
```

## API documentation

We generate API documentation with [TypeDoc](https://typedoc.org).

[![API Documentation](https://img.shields.io/badge/API-Documentation-blue?style=for-the-badge&logo=typescript)](https://weavedev.github.io/redux-local-storage/)

## Usage

### Creating

In this example we wrap a [ReduxAsync](https://github.com/weavedev/redux-async/) object in a ReduxLocalStorage object to save state changes to localStorage and load existing state from localStorage on init.

```ts
import { ReduxAsync } from '@weavedev/redux-async';
import { ReduxLocalStorage } from '@weavedev/redux-local-storage';

export const storedResource = new ReduxLocalStorage(new ReduxAsync( ... ), 'localStorageKey');

// If you are also using our store package (@weavedev/store)
window.storeReducers.storedResource = storedResource.reducer;
window.storeSagas.storedResource = storedResource.saga;

declare global {
    interface StoreReducersMap {
        storedResource: typeof storedResource.reducer;
    }

    interface StoreActionsMap {
        storedResource: typeof storedResource.actions;
    }
}
```

### Options

You can change the saving behaviour by providing an options object.

```ts
export const storedResource = new ReduxLocalStorage(
    new ReduxAsync( ... ),
    'localStorageKey',
    reduxLocalStorageOptions,
);
```

#### Options object

```ts
{
    /**
     * Add a custom transformer between localStorage and the runtime state.
     * Usefull for objects that can not be serialized.
     */
    transform: {
        // Convert saved state to runtime state
        read: (s: string): MyAsyncState => ({ data: s }),

        // Convert runtime state to saved state
        write: (s: MyAsyncState): string => s.data,
    },

    /**
     * By default ReduxLocalStorage saves to localStorage whenever the state changed.
     * If you only want to save on specific action types you can provide an array.
     */
    triggers: ['MY_ASYNC_ACTION_TRIGGER', 'MY_ASYNC_ACTION_CALLBACK'],
}
```

## License

[GPL-3.0](https://github.com/weavedev/redux-local-storage/blob/master/LICENSE)

Made by [Paul Gerarts](https://github.com/gerarts) and [Weave](https://weave.nl)
