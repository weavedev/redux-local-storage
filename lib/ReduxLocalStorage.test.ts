import { ActionMap, ActionTypesFromActionMap, Reduxable, ReduxableState } from '@weavedev/reduxable';
import { Action, applyMiddleware, combineReducers, createStore, Reducer, Store } from 'redux';
import reduxSaga, { SagaIterator, SagaMiddleware } from 'redux-saga';
import { call, put } from 'redux-saga/effects';
import { ReduxLocalStorage } from './ReduxLocalStorage';

/**
 * Reporter
 */
type ConsoleType = 'error' | 'group' | 'groupCollapsed' | 'groupEnd' | 'log' | 'warn';
type ConsoleMessage = [ConsoleType, ...any[]];
type ConsoleReport = ConsoleMessage[];

const wrapConsole: (() => (() => ConsoleReport)) = (): (() => ConsoleReport) => {
    const report: ConsoleReport = [];
    const { error, group, groupCollapsed, groupEnd, log, warn }: typeof console = console;

    const reporter: ((k: ConsoleType) => ((...m: any[]) => void)) = (k: ConsoleType): ((...m: any[]) => void) => (...m: any[]): void => {
        report.push([k, ...m]);
    };

    console.error = reporter('error');
    console.group = reporter('group');
    console.groupCollapsed = reporter('groupCollapsed');
    console.groupEnd = reporter('groupEnd');
    console.log = reporter('log');
    console.warn = reporter('warn');

    return (): ConsoleReport => {
        console.error = error;
        console.group = group;
        console.groupCollapsed = groupCollapsed;
        console.groupEnd = groupEnd;
        console.log = log;
        console.warn = warn;

        return report;
    };
};

interface TestAction extends Action<'TEST'> {
    data: string;
}

interface TestState extends ReduxableState<string> {
    reducer: boolean;
}

interface TestActions extends ActionMap {
    testAction: TestAction;
}

/**
 * Fixture to test ReduxLocalStorage
 */
class Test extends Reduxable<TestState, TestActions, [string]> {
    public get actionMap(): TestActions {
        throw new Error('Test.actionMap should only be used as a TypeScript type provider');
    }

    public get actionTypeMap(): ActionTypesFromActionMap<TestActions> {
        return {
            testAction: 'TEST',
        };
    }

    public get defaultState(): TestState {
        return {
            data: '',
            reducer: false,
            updated: {},
        };
    }

    protected get internalReducer(): Reducer<TestState> {
        const context: Test = this;

        return (state: TestState = context.defaultState, action: Action): TestState => {
            const s: TestState = state.reducer ? state : { ...state, reducer: true };
            switch (action.type) {
                case 'TEST':
                    return {
                        ...s,
                        data: (<TestAction>action).data,
                    };
                default:
                    return s;
            }
        };
    }

    public get saga(): (() => Iterator<never>) {
        return function* (): Iterator<never> {/* Stub */};
    }

    public run(data: string): TestAction {
        return { type: 'TEST', data };
    }

    public get runSaga(): (data: string) => SagaIterator<TestState> {
        const context: Test = this;

        return function* (data: string): SagaIterator<TestState> {
            // Fire request
            yield put(context.run(data));

            return context.state;
        };
    }
}

let t: Test;
let rlswt: ReduxLocalStorage<Test>;
let rlsst: ReduxLocalStorage<Test>;
let rlsnt: ReduxLocalStorage<Test>;
let store: Store<{
    t: typeof t.state;
    rlswt: typeof rlswt.state;
    rlsst: typeof rlsst.state;
    rlsnt: typeof rlsnt.state;
}>;
let sagaMiddleware: SagaMiddleware;

beforeEach(() => {
    // Make sure local storage is clear
    window.localStorage.clear();

    t = new Test();
    rlswt = new ReduxLocalStorage(new Test(), 'rlswt', { triggers: ['TEST'] });
    rlsst = new ReduxLocalStorage(new Test(), 'rlsst');
    rlsnt = new ReduxLocalStorage(new Test(), 'rlsnt', { triggers: [] });
    sagaMiddleware = reduxSaga();
    store = createStore(
        combineReducers({
            t: t.reducer,
            rlswt: rlswt.reducer,
            rlsst: rlsst.reducer,
            rlsnt: rlsnt.reducer,
        }),
        applyMiddleware(sagaMiddleware),
    );
    sagaMiddleware.run(t.saga);
    sagaMiddleware.run(rlswt.saga);
    sagaMiddleware.run(rlsst.saga);
    sagaMiddleware.run(rlsnt.saga);
});

test('Should throw when accessing .actionMap', () => {
    expect(() => {
        console.log(rlswt.actionMap, 'never');
    }).toThrowError();
});

test('ReduxLocalStorage state should be equal to child state', () => {
    expect(store.getState().rlswt).toEqual(store.getState().t);
});

test('ReduxLocalStorage.actionTypeMap should be equal to child.actionTypeMap', () => {
    expect(rlswt.actionTypeMap).toEqual(t.actionTypeMap);
});

test('ReduxLocalStorage.run should be equal to child.run', () => {
    expect(rlswt.run('.run test string')).toEqual(t.run('.run test string'));
});

test('RunSaga should return result', (done: () => void) => {
    let result: typeof rlswt.state;

    sagaMiddleware.run(function* (): SagaIterator {
        result = <typeof rlswt.state>(yield call(rlswt.runSaga, 'running this saga'));
    });

    setTimeout(() => {
        expect(result.data).toEqual('running this saga');
        done();
    }, 10);
});

test('Should write to localStorage on relevant triggers', () => {
    // Dispatch action used by all reducers
    store.dispatch({ type: 'TEST', data: 'am i writing' });

    // Expect explicitly set triggers to cause a save
    expect(window.localStorage.getItem('rlswt')).toEqual(`{"data":"am i writing","reducer":true,"updated":{}}`);

    // Expect any state change to cause a save when the trigger option is undefined
    expect(window.localStorage.getItem('rlsst')).toEqual(`{"data":"am i writing","reducer":true,"updated":{}}`);

    // Expect explicitly excluded triggers to not be saved
    expect(window.localStorage.getItem('rlsnt')).toBeNull();
});

test('Should read from localStorage on init', () => {
    // Setup localStorage data
    window.localStorage.setItem('reader', `{"data":"i was already here","reducer":true,"updated":{}}`);

    // Create RLS
    const reader: ReduxLocalStorage<Test> = new ReduxLocalStorage(new Test(), 'reader');

    // Trigger init and make sure state was loaded
    expect(reader.reducer(undefined, { type: '@@' })).toEqual({ data: 'i was already here', reducer: true, updated: {} });
});

test('Should transform data before writing to localStorage when transform is set', () => {
    // Create RLS with transform
    const writeTransformer: ReduxLocalStorage<Test, string> = new ReduxLocalStorage(
        new Test(),
        'writeTransformer',
        {
            transform: {
                read: (s: string): TestState => ({ data: `Transformed read: ${s}`, reducer: true, updated: {} }),
                write: (s: TestState): string => `Transformed write: ${s.data}`,
            },
        },
    );

    // Trigger reducer
    writeTransformer.reducer({ data: '', reducer: true, updated: {} }, { type: 'TEST', data: 'new data' });

    // Make sure data was transformed and written to localStorage
    expect(window.localStorage.getItem('writeTransformer')).toEqual('"Transformed write: new data"');
});

test('Should transform data after reading from localStorage when transform is set', () => {
    // Setup localStorage data
    window.localStorage.setItem('readTransformer', '"read me"');

    // Create RLS with transform
    const readTransformer: ReduxLocalStorage<Test, string> = new ReduxLocalStorage(
        new Test(),
        'readTransformer',
        {
            transform: {
                read: (s: string): TestState => ({ data: `Transformed read: ${s}`, reducer: true, updated: {} }),
                write: (s: TestState): string => `Transformed write: ${s.data}`,
            },
        },
    );

    // Trigger init and make sure state was transformed and loadad
    expect(readTransformer.reducer(undefined, { type: '@@' })).toEqual({ data: 'Transformed read: read me', reducer: true, updated: {} });
});

test('Should warn when localStorage can not be unmarshalled', () => {
    // Setup localStorage data
    window.localStorage.setItem('broken', `{"broken":"JSON"`);

    // Create reporter
    const reporter: () => ConsoleReport = wrapConsole();

    // Create ReduxLocalStorage object
    const broken: ReduxLocalStorage<Test> = new ReduxLocalStorage(new Test(), 'broken');

    // Triggernig reducer should return defaultState as a fallback
    expect(broken.reducer(undefined, { type: '@@' })).toEqual({ data: '', reducer: true, updated: {} });

    // Load report
    const report: ConsoleReport = reporter();

    // Issue with localStorage data should warn in console
    expect(report[0][1]).toEqual('Could not unmarshal state from localStorage');
});

test('Should warn when state can not be marshalled', () => {
    // Create reporter
    const reporter: () => ConsoleReport = wrapConsole();

    // Create ReduxLocalStorage object
    const noMarsh: ReduxLocalStorage<Test> = new ReduxLocalStorage(new Test(), 'noMarsh');

    // Create circulair data object
    const data: {[key: string]: any} = { item: 5 };
    data.child = data;

    // If reducer processes non-marshallable data it should still return session state
    expect(noMarsh.reducer({ data: '', reducer: true, updated: {} }, { type: 'TEST', data })).toEqual({ data, reducer: true, updated: {} });

    // Load report
    const report: ConsoleReport = reporter();

    // Issue with localStorage data should warn in console
    expect(report[0][1]).toEqual('Could not marshal state to localStorage');
});
